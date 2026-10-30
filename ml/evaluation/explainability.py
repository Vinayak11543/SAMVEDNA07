"""
explainability.py — SHAP (SHapley Additive exPlanations) module for XGBoost landslide model

Computes:
- TreeExplainer Shapley values
- Global Feature Importance Ranking (mean |SHAP|)
- Beeswarm / Bar summary plot saved to reports/figures/
- Local explanation generation for API inference
"""

import os
import json
import logging
from typing import Dict, List, Any
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import shap

logger = logging.getLogger("ml.explainability")


def compute_shap_explanations(
    model: Any,
    X_sample: np.ndarray,
    feature_names: List[str],
    output_dir: str,
    max_display: int = 12,
) -> Dict[str, Any]:
    """
    Computes SHAP explanations using TreeExplainer on the trained XGBoost model.
    Saves SHAP summary plots and returns feature importance rankings.
    """
    os.makedirs(output_dir, exist_ok=True)
    logger.info("Computing SHAP values using TreeExplainer...")

    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X_sample)

    # For binary classification, shap_values might be 1D or 2D array
    if isinstance(shap_values, list):
        # Multi-class or list of classes
        sv = shap_values[1] if len(shap_values) > 1 else shap_values[0]
    else:
        sv = shap_values

    # Mean absolute SHAP value per feature
    mean_abs_shap = np.mean(np.abs(sv), axis=0)

    # Align feature names
    if len(feature_names) != sv.shape[1]:
        feature_names = [f"feat_{i}" for i in range(sv.shape[1])]

    feature_ranking = sorted(
        zip(feature_names, mean_abs_shap.tolist()),
        key=lambda x: x[1],
        reverse=True,
    )

    ranking_dict = {feat: round(val, 5) for feat, val in feature_ranking}

    # Plot SHAP summary bar chart
    plt.figure(figsize=(9, 6))
    top_feats = feature_ranking[:max_display][::-1]
    y_pos = np.arange(len(top_feats))
    plt.barh(y_pos, [x[1] for x in top_feats], color="#3b82f6", align="center")
    plt.yticks(y_pos, [x[0] for x in top_feats], fontsize=9)
    plt.xlabel("Mean |SHAP value| (Average impact on model output magnitude)")
    plt.title(f"Top {len(top_feats)} Landslide Predictors (SHAP Feature Importance)")
    plt.grid(True, axis="x", alpha=0.3)
    plt.tight_layout()

    shap_path = os.path.join(output_dir, "shap_summary.png")
    plt.savefig(shap_path, dpi=200)
    plt.close()

    logger.info(f"SHAP summary plot saved to {shap_path}")

    return {
        "shap_summary_plot": shap_path,
        "feature_importance_ranking": ranking_dict,
        "top_features": [f[0] for f in feature_ranking[:5]],
    }

