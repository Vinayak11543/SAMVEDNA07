"""
train_xgboost.py — Production training pipeline for Landslide Risk Model

- Ingests NASA GLC Indian landslide events
- Synthesizes geographically buffered non-landslide samples
- Enriches events with SRTM DEM morphometry and ERA5/GPM IMERG historical weather
- Applies Spatial & Temporal Leakage-Free splitting
- Fits scikit-learn preprocessing ColumnTransformer
- Optimizes XGBoost hyperparameters via Stratified Cross-Validation
- Evaluates full test metrics (Precision, Recall, F1, ROC-AUC, PR-AUC, Brier score)
- Computes SHAP explainability values and figures
- Persists model artifact, preprocessor, and model_metadata.json
"""

import os
import sys
import json
import logging
import datetime
from typing import Dict, Any, Tuple
import joblib
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.model_selection import StratifiedKFold, RandomizedSearchCV

# Add ml root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from preprocessing.ingestion import (
    NasaGlcIngestor,
    NrscAtlasIngestor,
    DemElevationFetcher,
    HistoricalRainfallFetcher,
)
from preprocessing.feature_pipeline import (
    LandslideFeaturePipeline,
    generate_non_landslide_samples,
    build_preprocessing_pipeline,
    NUMERIC_FEATURES,
    CATEGORICAL_FEATURES,
)
from preprocessing.spatial_split import SpatialTemporalSplitter
from evaluation.metrics import evaluate_landslide_model, plot_evaluation_curves
from evaluation.explainability import compute_shap_explanations

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ml.training")

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MODELS_DIR = os.path.join(BASE_DIR, "models")
REPORTS_DIR = os.path.join(BASE_DIR, "reports")
FIGURES_DIR = os.path.join(REPORTS_DIR, "figures")
PROCESSED_DATA_DIR = os.path.join(BASE_DIR, "data", "processed")


def prepare_dataset(
    sample_limit: int = 400,
    neg_ratio: float = 2.0,
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Ingests and prepares real historical landslide events + non-landslide samples.
    Enriches with DEM terrain morphometry and ERA5/GPM IMERG weather data.
    """
    os.makedirs(PROCESSED_DATA_DIR, exist_ok=True)
    cache_dataset_path = os.path.join(PROCESSED_DATA_DIR, "enriched_dataset.parquet")

    if os.path.exists(cache_dataset_path):
        logger.info(f"Loading pre-cached enriched dataset from {cache_dataset_path}...")
        df = pd.read_parquet(cache_dataset_path)
        metadata = {
            "source": "Cached enriched dataset",
            "total_records": len(df),
            "positive_events": int((df["label"] == 1).sum()),
            "negative_samples": int((df["label"] == 0).sum()),
        }
        return df, metadata

    # 1. Ingest real NASA GLC events
    ingestor = NasaGlcIngestor()
    glc_events = ingestor.load_india_events(deduplicate=True)

    # Optional merge with NRSC if available
    nrsc_ingestor = NrscAtlasIngestor()
    if nrsc_ingestor.is_available():
        nrsc_events = nrsc_ingestor.load()
        if nrsc_events is not None:
            glc_events = pd.concat([glc_events, nrsc_events], ignore_index=True)
            logger.info(f"Combined NASA GLC and NRSC Atlas: {len(glc_events)} total events.")

    # Apply sample limit if specified (to stay within API rate limits while maintaining statistical power)
    if sample_limit and len(glc_events) > sample_limit:
        glc_events = glc_events.sample(n=sample_limit, random_state=42).reset_index(drop=True)
        logger.info(f"Subsampled to {sample_limit} representative positive events across India.")

    # 2. Generate spatially buffered negative samples
    neg_df = generate_non_landslide_samples(
        glc_events,
        negative_to_positive_ratio=neg_ratio,
        min_distance_km=3.0,
        seed=42,
    )

    combined_raw = pd.concat([glc_events, neg_df], ignore_index=True)

    # 3. Enrich with DEM and Weather
    elevation_fetcher = DemElevationFetcher()
    weather_fetcher = HistoricalRainfallFetcher()
    feature_pipeline = LandslideFeaturePipeline(elevation_fetcher, weather_fetcher)

    enriched_df = feature_pipeline.enrich_records(combined_raw)

    # Save cache
    try:
        enriched_df.to_parquet(cache_dataset_path)
        logger.info(f"Enriched dataset cached at {cache_dataset_path}")
    except Exception as e:
        logger.warning(f"Could not cache parquet: {e}")

    meta = {
        "nasa_events_used": len(glc_events),
        "negative_samples": len(neg_df),
        "total_records": len(enriched_df),
        "negative_positive_ratio": neg_ratio,
    }
    return enriched_df, meta


def train_and_evaluate_pipeline(
    sample_limit: int = 400,
    tune_hyperparameters: bool = True,
) -> Dict[str, Any]:
    """
    Executes the entire end-to-end training and evaluation pipeline:
    1. Dataset preparation
    2. Spatial-Temporal Split
    3. Preprocessor fit
    4. XGBoost hyperparameter search & training
    5. Evaluation & curve plotting
    6. SHAP analysis
    7. Artifact persistence
    """
    os.makedirs(MODELS_DIR, exist_ok=True)
    os.makedirs(FIGURES_DIR, exist_ok=True)
    os.makedirs(REPORTS_DIR, exist_ok=True)

    logger.info("=" * 60)
    logger.info("STARTING SAMVEDNA LANDSLIDE MODEL TRAINING PIPELINE")
    logger.info("=" * 60)

    # 1. Prepare data
    df, prep_meta = prepare_dataset(sample_limit=sample_limit)

    # 2. Spatial & Temporal Leakage-Free Split
    splitter = SpatialTemporalSplitter(buffer_km=15.0, test_ratio=0.25, seed=42)
    train_df, test_df, split_meta = splitter.split_geographic_and_temporal(df)

    # 3. Fit Preprocessing Pipeline
    preprocessor = build_preprocessing_pipeline()

    feature_cols = NUMERIC_FEATURES + CATEGORICAL_FEATURES
    X_train_raw = train_df[feature_cols]
    y_train = train_df["label"].values
    X_test_raw = test_df[feature_cols]
    y_test = test_df["label"].values

    logger.info(f"Fitting preprocessor on training data ({len(X_train_raw)} samples)...")
    preprocessor.fit(X_train_raw)

    X_train = preprocessor.transform(X_train_raw)
    X_test = preprocessor.transform(X_test_raw)

    # Extract transformed feature names
    cat_encoder = preprocessor.named_steps["preprocessor"].named_transformers_["cat"].named_steps["encoder"]
    encoded_cat_names = list(cat_encoder.get_feature_names_out(CATEGORICAL_FEATURES))
    # Numeric features plus any missing indicators
    num_imputer = preprocessor.named_steps["preprocessor"].named_transformers_["num"].named_steps["imputer"]
    num_names = list(NUMERIC_FEATURES)
    if hasattr(num_imputer, "indicator_") and num_imputer.indicator_ is not None:
        for idx in num_imputer.indicator_.features_:
            num_names.append(f"{NUMERIC_FEATURES[idx]}_missing")

    all_transformed_feature_names = num_names + encoded_cat_names

    # 4. Handle Class Imbalance & Train XGBoost
    n_neg = int((y_train == 0).sum())
    n_pos = int((y_train == 1).sum())
    scale_pos_weight = float(n_neg / max(n_pos, 1))
    logger.info(f"Class distribution: {n_pos} positive, {n_neg} negative. scale_pos_weight={scale_pos_weight:.2f}")

    base_xgb = xgb.XGBClassifier(
        objective="binary:logistic",
        eval_metric="logloss",
        scale_pos_weight=scale_pos_weight,
        random_state=42,
        n_jobs=-1,
    )

    if tune_hyperparameters:
        logger.info("Performing Hyperparameter Tuning via RandomizedSearchCV (Stratified 3-Fold)...")
        param_dist = {
            "n_estimators": [100, 150, 200, 250],
            "max_depth": [3, 4, 5, 6],
            "learning_rate": [0.03, 0.05, 0.1, 0.15],
            "subsample": [0.7, 0.8, 0.9, 1.0],
            "colsample_bytree": [0.6, 0.8, 1.0],
            "gamma": [0.0, 0.1, 0.3],
            "min_child_weight": [1, 3, 5],
        }

        cv = StratifiedKFold(n_splits=3, shuffle=True, random_state=42)
        search = RandomizedSearchCV(
            estimator=base_xgb,
            param_distributions=param_dist,
            n_iter=15,
            scoring="roc_auc",
            cv=cv,
            random_state=42,
            n_jobs=-1,
            verbose=1,
        )
        search.fit(X_train, y_train)
        best_model = search.best_estimator_
        best_params = search.best_params_
        logger.info(f"Best Hyperparameters: {best_params} (CV ROC-AUC: {search.best_score_:.4f})")
    else:
        best_model = base_xgb
        best_model.fit(X_train, y_train)
        best_params = best_model.get_params()

    # 5. Evaluate on Holdout Test Set
    logger.info("Evaluating model on independent held-out test set...")
    y_test_proba = best_model.predict_proba(X_test)[:, 1]
    metrics = evaluate_landslide_model(y_test, y_test_proba, threshold=0.5)

    # Plot curves
    figs = plot_evaluation_curves(y_test, y_test_proba, output_dir=FIGURES_DIR)

    # 6. Compute SHAP explainability
    shap_results = compute_shap_explanations(
        model=best_model,
        X_sample=X_test[:min(100, len(X_test))],
        feature_names=all_transformed_feature_names,
        output_dir=FIGURES_DIR,
    )

    # 7. Persist Artifacts
    model_json_path = os.path.join(MODELS_DIR, "landslide_xgb_model.json")
    best_model.save_model(model_json_path)

    preprocessor_path = os.path.join(MODELS_DIR, "preprocessor.joblib")
    joblib.dump(preprocessor, preprocessor_path)

    metadata = {
        "model_name": "SAMVEDNA XGBoost Landslide Risk Model",
        "model_version": "1.0.0",
        "training_timestamp_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "algorithm": "XGBoost Classifier (Gradient Boosted Decision Trees)",
        "framework_versions": {
            "xgboost": xgb.__version__,
            "scikit_learn": joblib.__version__,
            "numpy": np.__version__,
            "pandas": pd.__version__,
        },
        "dataset_provenance": {
            "primary_inventory": "NASA Global Landslide Catalog (GLC) / COOLR",
            "region": "India (Himalayan Arc, Western Ghats, Northeast India)",
            "dem_source": "Copernicus / SRTM 30m Digital Elevation Model",
            "weather_reanalysis": "Open-Meteo Historical Archive (GPM IMERG / ERA5)",
            "non_landslide_sampling": "Spatially buffered (>3 km) negative sampling across stable baseline topography",
            "train_samples": int(split_meta["train_samples"]),
            "test_samples": int(split_meta["test_samples"]),
            "leakage_prevention": "Geographic block holdout with 15 km spatial exclusion buffer",
        },
        "features": {
            "input_raw_features": feature_cols,
            "transformed_feature_count": len(all_transformed_feature_names),
            "top_shap_features": shap_results["top_features"],
        },
        "best_hyperparameters": best_params,
        "evaluation_metrics_holdout": metrics,
        "artifacts": {
            "model_file": "ml/models/landslide_xgb_model.json",
            "preprocessor_file": "ml/models/preprocessor.joblib",
            "metadata_file": "ml/models/model_metadata.json",
        },
        "status": "VALIDATED_TRAINED_MODEL_AVAILABLE",
    }

    metadata_path = os.path.join(MODELS_DIR, "model_metadata.json")
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    logger.info("=" * 60)
    logger.info("TRAINING PIPELINE COMPLETE")
    logger.info(f"Model saved: {model_json_path}")
    logger.info(f"Preprocessor saved: {preprocessor_path}")
    logger.info(f"Metadata saved: {metadata_path}")
    logger.info(f"ROC-AUC: {metrics['roc_auc']}, PR-AUC: {metrics['pr_auc']}, F1: {metrics['f1_score']}")
    logger.info("=" * 60)

    return metadata


if __name__ == "__main__":
    train_and_evaluate_pipeline()

