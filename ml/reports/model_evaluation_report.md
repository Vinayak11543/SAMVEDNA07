# SAMVEDNA Machine Learning Model Evaluation Report
**Model Name:** SAMVEDNA XGBoost Landslide Risk Model  
**Version:** 1.0.0  
**Algorithm:** Extreme Gradient Boosting (`XGBClassifier`) with Scikit-Learn Preprocessing  
**Status:** VALIDATED — Trained on Real Empirical Inventories  
**Evaluation Date:** October 2026  

---

## 1. Executive Summary

This report presents the empirical performance of the primary machine learning model developed for the SAMVEDNA disaster-impact architecture. The model was trained and evaluated on real-world Indian landslide events from the **NASA Global Landslide Catalog (GLC)**, enriched with **Copernicus / SRTM 30m Digital Elevation Models** and **ERA5 / NASA GPM IMERG historical reanalysis**.

All metrics documented below were computed on a strictly held-out test partition governed by a **15.0 km spatial buffer** and regional tectonic block separation to prevent spatial autocorrelation leakage.

---

## 2. Model Architecture & Hyperparameters

- **Algorithm:** Gradient Boosted Decision Trees (XGBoost 3.4.1)
- **Objective Function:** `binary:logistic` (Log-loss)
- **Class Imbalance Strategy:** `scale_pos_weight = 2.94` (ratio of non-landslide to landslide samples)
- **Tuning Strategy:** 3-Fold Stratified Spatial Cross-Validation (`RandomizedSearchCV`, 45 total fits)
- **Optimal Hyperparameters Selected:**
  - `n_estimators`: 100
  - `max_depth`: 5
  - `learning_rate`: 0.03
  - `subsample`: 1.0
  - `colsample_bytree`: 0.8
  - `gamma`: 0.1
  - `min_child_weight`: 1

---

## 3. Empirical Evaluation Metrics (Held-Out Test Set)

The evaluation set comprises **187 independent geographic locations** across India with zero overlap or spatial proximity ($\ge 15.0$ km) to the training points.

| Metric | Computed Value | Description / Operational Interpretation |
| :--- | :--- | :--- |
| **ROC-AUC** | **0.9674** | High discriminative capability across all risk threshold operating points |
| **PR-AUC (Avg Precision)** | **0.9079** | Precision-Recall curve area; critical benchmark for imbalanced hazard detection |
| **F1 Score** | **0.8936** | Harmonic mean of precision and recall at threshold $\tau = 0.50$ |
| **Recall (Sensitivity)** | **0.9403** (94.03%) | Successfully flags 63 out of 67 actual landslide failure events |
| **Precision** | **0.8514** (85.14%) | Out of 74 triggered warnings, 63 were confirmed true landslide sites |
| **Specificity** | **0.9083** (90.83%) | Correctly identifies 109 out of 120 stable, non-failing slopes |
| **Accuracy** | **0.9198** (91.98%) | Overall correct classification rate |
| **Brier Score Loss** | **0.0628** | Mean squared difference between predicted probabilities and ground truth (lower is better, $<0.10$ denotes excellent calibration) |

---

## 4. Confusion Matrix Breakdown

Evaluated at decision threshold $\tau = 0.50$:

```
                         PREDICTED NEGATIVE    PREDICTED POSITIVE
ACTUAL NON-LANDSLIDE:           109 (TN)               11 (FP)
ACTUAL LANDSLIDE:                 4 (FN)               63 (TP)
```

- **True Positives (63):** Correctly classified landslide sites under intense monsoonal rainfall on steep Himalayan/Western Ghat slopes.
- **False Negatives (4):** Landslides that failed under moderate rainfall where localized geological shear planes or human cut-slopes were the primary unmeasured failure triggers.
- **False Positives (11):** Steep terrain receiving heavy rain that held without macroscopic slope failure during that specific observation window.
- **True Negatives (109):** Stable valleys, plains, and low-gradient terrain correctly classified as low hazard.

---

## 5. SHAP (TreeExplainer) Interpretability & Feature Ranking

Global feature importances were computed using **SHAP TreeExplainer** on the test partition. The top predictive features ranked by Mean Absolute SHAP Impact ($E[|\text{SHAP value}|]$) are:

1. **`slope_deg` (Topographic Slope Gradient):** Strongest non-linear predictor. Terrain gradients $> 28^\circ$ drastically elevate failure probability when moisture thresholds are breached.
2. **`soil_moisture_pct` (Volumetric Pore Water Saturation):** Primary soil-mechanics driver. Saturation $> 75\%$ reduces effective normal stress along shear surfaces.
3. **`rainfall_24h_mm` (24-Hour Rainfall Accumulation):** Main dynamic atmospheric trigger initiating rapid debris flows and translational slides.
4. **`elevation_m` (Altitude a.m.s.l.):** Orographic precipitation capture index and periglacial regolith proxy in the Higher Himalayas.
5. **`antecedent_rainfall_7d_mm` (7-Day Antecedent Precipitation):** Prolonged saturation proxy pre-conditioning slopes prior to the trigger event.
6. **`rainfall_intensity_mm_h` (Peak Hourly Precipitation Rate):** Determines infiltration-excess vs saturation-excess overland runoff.
7. **`distance_to_drainage_m`:** Slopes adjacent to toe-cutting torrential rivers show elevated toe-erosion vulnerability.
8. **`plan_curvature` / `profile_curvature`:** Convergent hollows focus subsurface pore-water pressure.

---

## 6. Generated Evaluation Artifacts

All evaluation plots have been saved to `ml/reports/figures/`:
- `roc_curve.png`: Receiver Operating Characteristic curve with 0.967 AUC.
- `pr_curve.png`: Precision-Recall curve demonstrating sustained high precision across high recall tiers.
- `calibration_curve.png`: Reliability diagram showing predicted probabilities closely tracking empirical observation frequencies.
- `confusion_matrix.png`: Annotated 2x2 confusion matrix.
- `shap_summary.png`: Beeswarm and feature magnitude ranking plot.

---

## 7. Operational Limitations & Boundary Conditions
1. **Inclinometer Tilt Integration:** In the offline training dataset, ground inclinometer tilt is marked as missing (`NaN`) because satellite inventory databases do not have downhole sensors. During real-time API inference (Phase C), when physical telemetry tilt is provided, it is ingested through the preprocessor's missing-indicator channel.
2. **Micro-topography & Anthropogenic Cuts:** Road cuts and unchecked excavation below 30m resolution may induce localized failures not captured by regional 30m DEM derivatives.
3. **Warning Classification:** In the user-facing interface, risk levels must be presented as **probabilistic assessments** with stated confidence intervals, never as absolute physical certainties.
