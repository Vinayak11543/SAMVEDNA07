"""
ml_service.py — ML inference and sensor registry service for SAMVEDNA API
"""

import os
import json
import logging
import datetime
from typing import Dict, List, Optional, Any, Tuple
import joblib
import numpy as np
import pandas as pd
import xgboost as xgb

from config import settings
from impact_engine import query_local_dem, GeospatialImpactEngine

logger = logging.getLogger("ml.service")


class MLInferenceService:
    """Manages model loading, telemetry feature assembly, inference, and fallback."""

    def __init__(self):
        self.model: Optional[xgb.XGBClassifier] = None
        self.preprocessor: Optional[Any] = None
        self.metadata: Optional[Dict[str, Any]] = None
        self.model_available: bool = False
        self.sensors_registry: Dict[str, Dict[str, Any]] = {}
        self.impact_engine = GeospatialImpactEngine(model_version=settings.VERSION)

        self._load_sensors_registry()
        self._load_model_artifacts()

    def _load_sensors_registry(self):
        """Loads all 41 baseline sensors from src/data/sensors.json into an in-memory lookup."""
        if os.path.exists(settings.SENSORS_PATH):
            try:
                with open(settings.SENSORS_PATH, "r", encoding="utf-8") as f:
                    sensors_list = json.load(f)
                    for s in sensors_list:
                        self.sensors_registry[s["id"]] = s
                logger.info(f"Loaded {len(self.sensors_registry)} sensors into registry from {settings.SENSORS_PATH}")
            except Exception as e:
                logger.error(f"Failed to load sensors.json: {e}")
        else:
            logger.warning(f"sensors.json not found at {settings.SENSORS_PATH}")

    def _load_model_artifacts(self):
        """Loads XGBoost model and preprocessing pipeline if available."""
        has_model = os.path.exists(settings.MODEL_PATH)
        has_preproc = os.path.exists(settings.PREPROCESSOR_PATH)
        has_meta = os.path.exists(settings.METADATA_PATH)

        if has_model and has_preproc:
            try:
                logger.info(f"Loading trained XGBoost model from {settings.MODEL_PATH}...")
                model = xgb.XGBClassifier()
                model.load_model(settings.MODEL_PATH)
                self.model = model

                logger.info(f"Loading preprocessor from {settings.PREPROCESSOR_PATH}...")
                self.preprocessor = joblib.load(settings.PREPROCESSOR_PATH)

                if has_meta:
                    with open(settings.METADATA_PATH, "r", encoding="utf-8") as f:
                        self.metadata = json.load(f)
                else:
                    self.metadata = {"model_name": "SAMVEDNA XGBoost", "version": "1.0.0"}

                self.model_available = True
                logger.info("XGBoost Landslide Model and Preprocessor loaded successfully!")
            except Exception as e:
                logger.error(f"Failed to load ML artifacts: {e}")
                self.model_available = False
        else:
            logger.warning(
                f"ML model artifacts missing: model={has_model}, preprocessor={has_preproc}. "
                "API will run in fallback rule-based mode."
            )
            self.model_available = False

    def get_sensor_by_id(self, sensor_id: str) -> Optional[Dict[str, Any]]:
        return self.sensors_registry.get(sensor_id)

    def predict(self, telemetry: Dict[str, Any]) -> Dict[str, Any]:
        """
        Runs prediction for incoming telemetry data.
        If real model is available, uses XGBoost pipeline; otherwise falls back to honest rule-based estimator.
        """
        sensor_id = telemetry.get("sensor_id", "SNS-UNKNOWN")
        lat = float(telemetry.get("lat", 30.415))
        lng = float(telemetry.get("lng", 79.308))
        name = telemetry.get("name") or self.sensors_registry.get(sensor_id, {}).get("name", "Unknown Station")
        state = telemetry.get("state") or self.sensors_registry.get(sensor_id, {}).get("state", "Uttarakhand")

        rainfall = float(telemetry.get("rainfall") if telemetry.get("rainfall") is not None else 60.0)
        soil_moisture = float(telemetry.get("soil_moisture") if telemetry.get("soil_moisture") is not None else 60.0)
        tilt = telemetry.get("tilt")
        tilt_val = float(tilt) if tilt is not None else np.nan

        # Data completeness calculation
        channels = 0
        if telemetry.get("rainfall") is not None: channels += 1
        if telemetry.get("soil_moisture") is not None: channels += 1
        if telemetry.get("tilt") is not None: channels += 1
        data_completeness = round((channels / 3.0) * 100.0, 1)
        data_quality = "complete" if channels == 3 else "partial" if channels >= 1 else "insufficient"

        timestamp_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

        # 1. Try ML Model Inference
        if self.model_available and self.model and self.preprocessor:
            try:
                # Obtain terrain features via DEM lookup
                dem = query_local_dem(lat, lng)
                elev = dem["elevation_m"]
                slope = dem["slope_deg"]
                aspect = dem["aspect_deg"]

                # Hydrological & lithological proxies
                drain_dist = 300.0 + (elev % 800) * 1.5 - min(slope * 15.0, 400.0)
                drain_dist = float(np.clip(drain_dist, 30.0, 3500.0))

                lc = "dense_forest" if slope > 25 else "open_forest"
                geo = "quartzite_phyllite" if lat > 27.0 else "sandstone_shale_sedimentary"

                feature_dict = {
                    "rainfall_intensity_mm_h": rainfall,
                    "rainfall_1h_mm": rainfall * 0.85,
                    "rainfall_3h_mm": min(rainfall * 2.2, 250.0),
                    "rainfall_24h_mm": min(rainfall * 5.0, 400.0),
                    "antecedent_rainfall_7d_mm": min(rainfall * 9.5, 650.0),
                    "soil_moisture_pct": soil_moisture,
                    "elevation_m": elev,
                    "slope_deg": slope,
                    "aspect_deg": aspect,
                    "plan_curvature": 0.001,
                    "profile_curvature": -0.001,
                    "distance_to_drainage_m": drain_dist,
                    "ground_tilt_deg": tilt_val,
                    "land_cover": lc,
                    "geology": geo,
                }

                df_feat = pd.DataFrame([feature_dict])
                X_trans = self.preprocessor.transform(df_feat)
                prob_raw = float(self.model.predict_proba(X_trans)[0, 1])
                probability = round(prob_raw * 100.0, 1)

                risk_level = (
                    "CRITICAL" if probability >= 80.0 else
                    "HIGH" if probability >= 60.0 else
                    "MEDIUM" if probability >= 40.0 else "LOW"
                )

                dynamic_assessment = (
                    f"XGBoost Model (v{settings.VERSION}): Inferred failure probability of {probability}%. "
                    f"Inputs: precipitation {rainfall:.1f} mm/h, soil moisture {soil_moisture:.1f}%, "
                    f"DEM slope {slope:.1f}°, elevation {elev:.0f}m."
                )

                return {
                    "sensor_id": sensor_id,
                    "name": name,
                    "state": state,
                    "coordinates": [lng, lat],
                    "probability": probability,
                    "risk_level": risk_level,
                    "confidence": data_completeness,
                    "is_critical": risk_level == "CRITICAL",
                    "threat_class": f"threat-{risk_level.lower()}",
                    "threat_label": f"{risk_level} THREAT" if risk_level != "LOW" else "LOW RISK / STABLE",
                    "dynamic_assessment": dynamic_assessment,
                    "model_name": "SAMVEDNA XGBoost Landslide Risk Model",
                    "model_version": settings.VERSION,
                    "model_available": True,
                    "data_quality": data_quality,
                    "feature_contributions": {
                        "slope_deg": round(slope, 1),
                        "soil_moisture_pct": round(soil_moisture, 1),
                        "rainfall_mm_h": round(rainfall, 1),
                        "elevation_m": round(elev, 1),
                    },
                    "timestamp": timestamp_iso,
                }
            except Exception as e:
                logger.error(f"XGBoost inference error for {sensor_id}: {e}. Falling back to rule-based estimator.")

        # 2. Honest Rule-Based Fallback
        return self._rule_based_fallback(
            sensor_id=sensor_id,
            name=name,
            state=state,
            lat=lat,
            lng=lng,
            rainfall=rainfall,
            soil_moisture=soil_moisture,
            tilt=tilt_val,
            data_completeness=data_completeness,
            data_quality=data_quality,
            timestamp_iso=timestamp_iso,
        )

    def _rule_based_fallback(
        self,
        sensor_id: str,
        name: str,
        state: str,
        lat: float,
        lng: float,
        rainfall: float,
        soil_moisture: float,
        tilt: float,
        data_completeness: float,
        data_quality: str,
        timestamp_iso: str,
    ) -> Dict[str, Any]:
        """Strictly honest rule-based fallback when ML model is unavailable or in error."""
        r_score = min(40.0, (rainfall / 200.0) * 40.0)
        m_score = min(35.0, (soil_moisture / 100.0) * 35.0)
        t_score = min(25.0, ((tilt if not np.isnan(tilt) else 0.0) / 15.0) * 25.0)
        raw_prob = r_score + m_score + t_score
        probability = round(float(np.clip(raw_prob, 5.0, 99.0)), 1)

        risk_level = (
            "CRITICAL" if probability >= 80.0 else
            "HIGH" if probability >= 60.0 else
            "MEDIUM" if probability >= 40.0 else "LOW"
        )

        dynamic_assessment = (
            f"Rule-based risk estimator (simulated telemetry - ML model offline): "
            f"Rainfall {rainfall:.1f} mm/h, soil moisture {soil_moisture:.1f}%, tilt {tilt:.2f}°. "
            "Approximate estimate from simulated telemetry, not a validated prediction."
        )

        return {
            "sensor_id": sensor_id,
            "name": name,
            "state": state,
            "coordinates": [lng, lat],
            "probability": probability,
            "risk_level": risk_level,
            "confidence": data_completeness,
            "is_critical": risk_level == "CRITICAL",
            "threat_class": f"threat-{risk_level.lower()}",
            "threat_label": f"{risk_level} THREAT" if risk_level != "LOW" else "LOW RISK / STABLE",
            "dynamic_assessment": dynamic_assessment,
            "model_name": "Rule-based risk estimator (simulated telemetry)",
            "model_version": "fallback-1.0.0",
            "model_available": False,
            "data_quality": data_quality,
            "feature_contributions": None,
            "timestamp": timestamp_iso,
        }

    def assess_impact_zones(self, telemetry: Dict[str, Any]) -> Dict[str, Any]:
        """Computes DEM-based multi-zone terrain runout GeoJSON FeatureCollection."""
        pred = self.predict(telemetry)
        return self.impact_engine.compute_impact_assessment(
            sensor_id=pred["sensor_id"],
            area_name=pred["name"],
            state=pred["state"],
            lat=pred["coordinates"][1],
            lng=pred["coordinates"][0],
            probability=pred["probability"],
            risk_level=pred["risk_level"],
            rainfall=float(telemetry.get("rainfall", 60.0)),
            soil_moisture=float(telemetry.get("soil_moisture", 60.0)),
        )


ml_service = MLInferenceService()

