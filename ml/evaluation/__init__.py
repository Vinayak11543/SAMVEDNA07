"""
SAMVEDNA ML Evaluation Package
Provides metrics calculation, ROC/PR curves, calibration assessment, and SHAP explainability.
"""
from .metrics import evaluate_landslide_model, plot_evaluation_curves
from .explainability import compute_shap_explanations

__all__ = [
    'evaluate_landslide_model',
    'plot_evaluation_curves',
    'compute_shap_explanations'
]

