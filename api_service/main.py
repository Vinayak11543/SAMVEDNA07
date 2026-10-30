"""
main.py — FastAPI microservice for SAMVEDNA Landslide Prediction and Disaster-Impact
"""

import logging
import datetime
from typing import Dict, Any, Optional
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings
from schemas import (
    HealthResponse,
    TelemetryInput,
    PredictionResponse,
    ImpactAssessmentResponse,
)
from ml_service import ml_service

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("api_service")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="High-performance landslide hazard prediction and terrain-aware runout engine.",
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
    Predict landslide hazard probability and risk class from simulated or real telemetry.
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
    """
    Retrieves the prediction for a specific sensor station in the 41-sensor registry.
    """
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
    """
    Retrieves the DEM-based terrain runout GeoJSON FeatureCollection for a specific sensor station.
    """
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=True)
