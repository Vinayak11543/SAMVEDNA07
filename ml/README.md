# SAMVEDNA Machine Learning Pipeline

An independent, production-grade machine learning pipeline for landslide hazard susceptibility and dynamic risk prediction across the Indian Himalayas and mountainous corridors.

---

## Directory Architecture

```
ml/
├── data/
│   ├── raw/
│   │   ├── nasa_glc.csv                  # NASA Global Landslide Catalog (11k global, 1.2k India)
│   │   └── nrsc_landslide_atlas.csv      # (Optional) NRSC Landslide Atlas manual import
│   ├── processed/
│   │   ├── enriched_dataset.parquet      # Processed feature table with DEM & meteorology
│   │   ├── elevation_cache.json          # Cached Copernicus / SRTM elevations
│   │   └── weather_cache.json            # Cached ERA5 / GPM IMERG reanalysis
├── notebooks/
│   └── 01_eda_and_data_quality.ipynb     # Exploratory analysis & spatial visualization
├── preprocessing/
│   ├── __init__.py
│   ├── ingestion.py                      # Data loaders (NASA GLC, NRSC Atlas, Open-Meteo DEM & Weather)
│   ├── feature_pipeline.py               # Morphometry, hydrology, and scikit-learn ColumnTransformer
│   └── spatial_split.py                  # Spatial block & 15km buffer leakage-free splitting
├── training/
│   ├── __init__.py
│   └── train_xgboost.py                  # Hyperparameter tuning (CV) & artifact persistence
├── evaluation/
│   ├── __init__.py
│   ├── metrics.py                        # Precision, Recall, F1, ROC-AUC, PR-AUC, Calibration, CM
│   └── explainability.py                 # SHAP TreeExplainer feature importance and figures
├── models/
│   ├── landslide_xgb_model.json          # Serialized production XGBoost model
│   ├── preprocessor.joblib               # Serialized Scikit-Learn feature pipeline
│   └── model_metadata.json               # Full model metadata, metrics, and parameters
├── reports/
│   ├── data_quality_report.md            # Ingestion audit and NRSC manual import manual
│   ├── model_evaluation_report.md        # Detailed empirical performance analysis
│   └── figures/
│       ├── confusion_matrix.png
│       ├── roc_curve.png
│       ├── pr_curve.png
│       ├── calibration_curve.png
│       └── shap_summary.png
├── requirements.txt                      # Pipeline dependencies
└── README.md                             # Documentation
```

---

## Quickstart & Replication

### 1. Install Dependencies
```bash
pip install -r ml/requirements.txt
```

### 2. Run the Full Training Pipeline
```bash
python ml/training/train_xgboost.py
```
This script will:
1. Load and deduplicate Indian landslide events from `ml/data/raw/nasa_glc.csv`.
2. Generate spatially buffered non-landslide samples (>3 km away from landslide scars).
3. Query and cache Copernicus/SRTM DEM elevations and Open-Meteo historical precipitation/soil moisture.
4. Apply spatial block holdout with a 15.0 km exclusion buffer to prevent spatial autocorrelation leakage.
5. Perform 3-fold cross-validated hyperparameter optimization using `RandomizedSearchCV`.
6. Compute holdout evaluation metrics (Precision, Recall, F1, ROC-AUC, PR-AUC, Brier score).
7. Generate SHAP TreeExplainer importance plots in `ml/reports/figures/`.
8. Persist `landslide_xgb_model.json`, `preprocessor.joblib`, and `model_metadata.json`.

---

## Features Utilized

| Feature | Type | Source | Description |
| :--- | :--- | :--- | :--- |
| `slope_deg` | Continuous | Copernicus DEM | Topographic gradient (degrees) |
| `soil_moisture_pct` | Continuous | ERA5 / GPM | Volumetric soil pore saturation (0–100%) |
| `rainfall_24h_mm` | Continuous | ERA5 / GPM | 24-hour antecedent rainfall accumulation |
| `elevation_m` | Continuous | Copernicus DEM | Altitude above mean sea level |
| `antecedent_rainfall_7d_mm` | Continuous | ERA5 / GPM | 7-day cumulative precipitation |
| `rainfall_intensity_mm_h` | Continuous | ERA5 / GPM | Peak hourly rainfall rate |
| `rainfall_1h_mm` | Continuous | ERA5 / GPM | 1-hour rainfall accumulation |
| `rainfall_3h_mm` | Continuous | ERA5 / GPM | 3-hour rainfall accumulation |
| `aspect_deg` | Continuous | Copernicus DEM | Terrain compass orientation (0°–360°) |
| `plan_curvature` | Continuous | Copernicus DEM | Contour curvature orthogonal to slope |
| `profile_curvature` | Continuous | Copernicus DEM | Vertical slope profile curvature |
| `distance_to_drainage_m` | Continuous | Hydrological proxy | Proximity to nearest stream / drainage channel |
| `land_cover` | Categorical | Land use map | Primary land cover classification |
| `geology` | Categorical | Regional lithology | Tectonic / geological bedrock formation |
| `ground_tilt_deg` | Continuous | Field Inclinometer | Real-time inclinometer tilt (NaN in satellite catalog) |

---

## Manual Import: NRSC Landslide Atlas of India
To augment the dataset with NRSC/ISRO records:
1. Download vector records from ISRO Bhuvan (`https://bhuvan.nrsc.gov.in/`).
2. Export to `ml/data/raw/nrsc_landslide_atlas.csv`.
3. Required columns: `event_id`, `latitude`, `longitude`, `state`, `district`, `year`, `landslide_type`.
4. Rerun `python ml/training/train_xgboost.py`. The pipeline automatically detects, validates, and merges the records.
