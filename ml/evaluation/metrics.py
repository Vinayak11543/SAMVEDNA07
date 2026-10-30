"""
metrics.py — Comprehensive evaluation metrics for landslide risk prediction

Computes:
- Precision, Recall, F1
- ROC-AUC
- PR-AUC (Average Precision)
- Brier Score & Calibration Curve
- Confusion Matrix
"""

import os
import json
import logging
from typing import Dict, Any, Tuple
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.metrics import (
    precision_score,
    recall_score,
    f1_score,
    accuracy_score,
    roc_auc_score,
    average_precision_score,
    roc_curve,
    precision_recall_curve,
    confusion_matrix,
    brier_score_loss,
)
from sklearn.calibration import calibration_curve

logger = logging.getLogger("ml.metrics")


def evaluate_landslide_model(
    y_true: np.ndarray,
    y_pred_proba: np.ndarray,
    threshold: float = 0.5,
) -> Dict[str, Any]:
    """
    Computes rigorous evaluation metrics on the held-out test set.
    All metrics are computed strictly from real predictions.
    """
    y_true = np.asarray(y_true).astype(int)
    y_pred_proba = np.asarray(y_pred_proba).astype(float)
    y_pred = (y_pred_proba >= threshold).astype(int)

    cm = confusion_matrix(y_true, y_pred)
    tn, fp, fn, tp = cm.ravel()

    prec = float(precision_score(y_true, y_pred, zero_division=0))
    rec = float(recall_score(y_true, y_pred, zero_division=0))
    f1 = float(f1_score(y_true, y_pred, zero_division=0))
    acc = float(accuracy_score(y_true, y_pred))
    roc_auc = float(roc_auc_score(y_true, y_pred_proba))
    pr_auc = float(average_precision_score(y_true, y_pred_proba))
    brier = float(brier_score_loss(y_true, y_pred_proba))

    # Specificity
    specificity = float(tn / (tn + fp)) if (tn + fp) > 0 else 0.0

    metrics = {
        "evaluation_threshold": threshold,
        "test_samples": int(len(y_true)),
        "true_positives": int(tp),
        "false_positives": int(fp),
        "true_negatives": int(tn),
        "false_negatives": int(fn),
        "accuracy": round(acc, 4),
        "precision": round(prec, 4),
        "recall_sensitivity": round(rec, 4),
        "specificity": round(specificity, 4),
        "f1_score": round(f1, 4),
        "roc_auc": round(roc_auc, 4),
        "pr_auc": round(pr_auc, 4),
        "brier_score_loss": round(brier, 4),
        "positive_class_ratio": round(float(y_true.mean()), 4),
    }

    logger.info(f"Evaluation Metrics: F1={f1:.4f}, ROC-AUC={roc_auc:.4f}, PR-AUC={pr_auc:.4f}, Recall={rec:.4f}, Precision={prec:.4f}")
    return metrics


def plot_evaluation_curves(
    y_true: np.ndarray,
    y_pred_proba: np.ndarray,
    output_dir: str,
) -> Dict[str, str]:
    """Generates and saves ROC, PR, Calibration, and Confusion Matrix figures."""
    os.makedirs(output_dir, exist_ok=True)
    figures_saved = {}

    y_true = np.asarray(y_true).astype(int)
    y_pred_proba = np.asarray(y_pred_proba).astype(float)
    y_pred = (y_pred_proba >= 0.5).astype(int)

    # 1. Confusion Matrix
    cm = confusion_matrix(y_true, y_pred)
    plt.figure(figsize=(5, 4))
    plt.imshow(cm, interpolation="nearest", cmap="Blues")
    plt.title("Confusion Matrix (Holdout Test Set)")
    plt.colorbar()
    tick_marks = np.arange(2)
    plt.xticks(tick_marks, ["Non-Landslide", "Landslide"])
    plt.yticks(tick_marks, ["Non-Landslide", "Landslide"])
    thresh = cm.max() / 2.0
    for i in range(2):
        for j in range(2):
            plt.text(j, i, format(cm[i, j], "d"), horizontalalignment="center",
                     color="white" if cm[i, j] > thresh else "black")
    plt.ylabel("Ground Truth")
    plt.xlabel("Predicted Label")
    plt.tight_layout()
    cm_path = os.path.join(output_dir, "confusion_matrix.png")
    plt.savefig(cm_path, dpi=200)
    plt.close()
    figures_saved["confusion_matrix"] = cm_path

    # 2. ROC Curve
    fpr, tpr, _ = roc_curve(y_true, y_pred_proba)
    roc_auc = roc_auc_score(y_true, y_pred_proba)
    plt.figure(figsize=(6, 5))
    plt.plot(fpr, tpr, color="#2563eb", lw=2, label=f"XGBoost ROC (AUC = {roc_auc:.3f})")
    plt.plot([0, 1], [0, 1], color="#9ca3af", lw=1.5, linestyle="--", label="Random Classifier")
    plt.xlim([0.0, 1.0])
    plt.ylim([0.0, 1.05])
    plt.xlabel("False Positive Rate (1 - Specificity)")
    plt.ylabel("True Positive Rate (Recall)")
    plt.title("Receiver Operating Characteristic (ROC) Curve")
    plt.legend(loc="lower right")
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    roc_path = os.path.join(output_dir, "roc_curve.png")
    plt.savefig(roc_path, dpi=200)
    plt.close()
    figures_saved["roc_curve"] = roc_path

    # 3. Precision-Recall Curve
    prec, rec, _ = precision_recall_curve(y_true, y_pred_proba)
    pr_auc = average_precision_score(y_true, y_pred_proba)
    plt.figure(figsize=(6, 5))
    plt.plot(rec, prec, color="#10b981", lw=2, label=f"XGBoost PR (PR-AUC = {pr_auc:.3f})")
    plt.axhline(y=y_true.mean(), color="#9ca3af", linestyle="--", label=f"Baseline Prevalance ({y_true.mean():.2f})")
    plt.xlim([0.0, 1.0])
    plt.ylim([0.0, 1.05])
    plt.xlabel("Recall")
    plt.ylabel("Precision")
    plt.title("Precision-Recall (PR) Curve")
    plt.legend(loc="lower left")
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    pr_path = os.path.join(output_dir, "pr_curve.png")
    plt.savefig(pr_path, dpi=200)
    plt.close()
    figures_saved["pr_curve"] = pr_path

    # 4. Calibration Curve
    prob_true, prob_pred = calibration_curve(y_true, y_pred_proba, n_bins=8, strategy="uniform")
    plt.figure(figsize=(6, 5))
    plt.plot(prob_pred, prob_true, marker="o", color="#8b5cf6", lw=2, label="XGBoost Calibration")
    plt.plot([0, 1], [0, 1], linestyle="--", color="#9ca3af", label="Perfect Calibration")
    plt.xlabel("Mean Predicted Probability")
    plt.ylabel("Fraction of Positives (Empirical)")
    plt.title("Reliability Diagram / Calibration Curve")
    plt.legend(loc="upper left")
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    calib_path = os.path.join(output_dir, "calibration_curve.png")
    plt.savefig(calib_path, dpi=200)
    plt.close()
    figures_saved["calibration_curve"] = calib_path

    return figures_saved
