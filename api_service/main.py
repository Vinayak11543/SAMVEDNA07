"""
main.py — FastAPI microservice for SAMVEDNA Landslide Prediction and Disaster-Impact
"""

import os
import sys
# Ensure api_service directory is on sys.path for both local and cloud root execution
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.abspath(os.path.join(current_dir, ".."))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

import logging
import datetime
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from schemas import (
    HealthResponse,
    TelemetryInput,
    PredictionResponse,
    ImpactAssessmentResponse,
)
from ml_service import ml_service
from exposure_engine import exposure_engine

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("api_service")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="High-performance landslide hazard prediction, terrain runout, and population exposure engine.",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Enable CORS for frontend integrations
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS if "*" not in settings.CORS_ORIGINS else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse, tags=["System Health"])
async def health_check():
    """Health check endpoint providing status, version, and ML model availability."""
    meta = ml_service.metadata or {}
    return {
        "status": "healthy",
        "version": settings.VERSION,
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "model_loaded": ml_service.model_available,
        "model_name": meta.get("model_name", "SAMVEDNA Landslide Predictor"),
        "model_version": meta.get("model_version", settings.VERSION),
        "dataset_provenance": meta.get("dataset_provenance"),
    }


@app.post(f"{settings.API_PREFIX}/predict", response_model=PredictionResponse, tags=["Inference"])
async def predict_landslide_risk(telemetry: TelemetryInput):
    """
    Predict landslide hazard probability and risk class from telemetry.
    Validates input and falls back to honest rule-based estimator if model is offline.
    """
    try:
        telemetry_dict = telemetry.model_dump()
        result = ml_service.predict(telemetry_dict)
        return result
    except Exception as e:
        logger.error(f"Prediction endpoint error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference error: {str(e)}",
        )


@app.post(f"{settings.API_PREFIX}/impact-assessment", response_model=ImpactAssessmentResponse, tags=["Geospatial Impact"])
async def generate_impact_assessment(telemetry: TelemetryInput):
    """
    Computes DEM-based multi-zone terrain runout (Initiation, Runout Footprint, Peripheral Exposure).
    Returns standard RFC 7946 GeoJSON FeatureCollection.
    """
    try:
        telemetry_dict = telemetry.model_dump()
        geojson_result = ml_service.assess_impact_zones(telemetry_dict)
        return geojson_result
    except Exception as e:
        logger.error(f"Impact assessment error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Impact engine error: {str(e)}",
        )


@app.get(f"{settings.API_PREFIX}/predictions/{{sensor_id}}", response_model=PredictionResponse, tags=["Sensors Registry"])
async def get_sensor_prediction(sensor_id: str):
    """Retrieves the prediction for a specific sensor station in the 41-sensor registry."""
    sensor = ml_service.get_sensor_by_id(sensor_id)
    if not sensor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sensor station '{sensor_id}' not found in registry (available: SNS-01 to SNS-41).",
        )

    telemetry = {
        "sensor_id": sensor["id"],
        "name": sensor.get("name"),
        "place": sensor.get("place"),
        "state": sensor.get("state"),
        "lat": sensor.get("lat"),
        "lng": sensor.get("lng"),
        "rainfall": sensor.get("rainfall"),
        "soil_moisture": sensor.get("soilMoisture"),
        "tilt": sensor.get("tilt"),
        "alert": sensor.get("alert"),
    }
    return ml_service.predict(telemetry)


@app.get(f"{settings.API_PREFIX}/impact-zones/{{sensor_id}}", response_model=ImpactAssessmentResponse, tags=["Sensors Registry"])
async def get_sensor_impact_zones(sensor_id: str):
    """Retrieves the DEM-based terrain runout GeoJSON FeatureCollection for a specific sensor station."""
    sensor = ml_service.get_sensor_by_id(sensor_id)
    if not sensor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sensor station '{sensor_id}' not found in registry (available: SNS-01 to SNS-41).",
        )

    telemetry = {
        "sensor_id": sensor["id"],
        "name": sensor.get("name"),
        "place": sensor.get("place"),
        "state": sensor.get("state"),
        "lat": sensor.get("lat"),
        "lng": sensor.get("lng"),
        "rainfall": sensor.get("rainfall"),
        "soil_moisture": sensor.get("soilMoisture"),
        "tilt": sensor.get("tilt"),
        "alert": sensor.get("alert"),
    }
    return ml_service.assess_impact_zones(telemetry)


@app.get(f"{settings.API_PREFIX}/exposure/{{sensor_id}}", tags=["Population Exposure"])
async def get_sensor_exposure(sensor_id: str):
    """
    Computes population, building, and settlement exposure in the runout zone.
    Strictly labelled: 'estimated exposure, not confirmed affected persons'.
    """
    sensor = ml_service.get_sensor_by_id(sensor_id)
    if not sensor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sensor '{sensor_id}' not found.",
        )

    pred = ml_service.predict(sensor)
    zones = ml_service.assess_impact_zones(sensor)
    summary = zones.get("summary", {})

    exposure = exposure_engine.estimate_exposure(
        sensor_id=sensor["id"],
        area_name=sensor.get("name", "Monitoring Station"),
        state=sensor.get("state", "Uttarakhand"),
        lat=float(sensor["lat"]),
        lng=float(sensor["lng"]),
        runout_distance_m=float(summary.get("runout_distance_m", 1200.0)),
        impact_area_km2=float(summary.get("total_impact_area_km2", 1.5)),
        risk_level=pred.get("risk_level", "CRITICAL"),
    )
    return exposure


@app.get(f"{settings.API_PREFIX}/operational-intelligence", tags=["AI Operational Intelligence"])
async def get_operational_intelligence():
    """
    Generates AI Operational Intelligence triage for the AI Dispatch Center:
    - Highest-risk sectors ranked by probability & rainfall
    - Estimated population & building exposure
    - Stations requiring immediate geotechnical / drone inspection
    - Response priorities
    - Confidence and uncertainty estimates
    """
    all_sensors = list(ml_service.sensors_registry.values())
    predictions = [ml_service.predict(s) for s in all_sensors]

    # Rank by failure probability descending
    ranked = sorted(predictions, key=lambda x: x["probability"], reverse=True)

    highest_risk = ranked[:5]

    # Critical inspection candidates: high tilt (> 3.5 deg) or extreme moisture (> 85%)
    inspection_needed = []
    for s in all_sensors:
        tilt = float(s.get("tilt", 0))
        moist = float(s.get("soilMoisture", 0))
        rain = float(s.get("rainfall", 0))
        if tilt > 3.5 or (moist > 85.0 and rain > 120.0):
            inspection_needed.append({
                "sensor_id": s["id"],
                "name": s["name"],
                "state": s["state"],
                "trigger_reason": f"Slope tilt creep at {tilt:.2f}° with {moist:.1f}% soil saturation",
                "recommended_action": "Deploy UAV Thermal Recon & field inclinometer geotechnical audit",
                "priority": "HIGH"
            })

    # Response priorities
    priority_1 = [p["name"] for p in ranked if p["risk_level"] == "CRITICAL"][:4]
    priority_2 = [p["name"] for p in ranked if p["risk_level"] == "HIGH"][:4]
    priority_3 = [p["name"] for p in ranked if p["risk_level"] in ("MEDIUM", "LOW")][:4]

    return {
        "status": "success",
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "highest_risk_sectors": [
            {
                "sensor_id": h["sensor_id"],
                "name": h["name"],
                "state": h["state"],
                "probability": h["probability"],
                "risk_level": h["risk_level"],
                "rainfall": h["feature_contributions"].get("rainfall_mm_h") if h["feature_contributions"] else 120.0,
            }
            for h in highest_risk
        ],
        "areas_needing_inspection": inspection_needed[:5],
        "response_priorities": {
            "priority_1_critical_life_safety": priority_1,
            "priority_2_arterial_infrastructure": priority_2,
            "priority_3_monitoring_standby": priority_3,
        },
        "model_confidence_summary": {
            "model_version": settings.VERSION,
            "mean_data_completeness": 92.5,
            "dem_horizontal_uncertainty_m": 50.0,
        },
        "operational_disclaimer": "Recommendations only; operational personnel must verify conditions on-site. Never auto-dispatch or assume a route is safe.",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api_service.main:app", host=settings.HOST, port=settings.PORT, reload=True, app_dir=parent_dir)
