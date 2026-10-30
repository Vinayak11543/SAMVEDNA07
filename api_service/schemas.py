"""
schemas.py — Pydantic V2 data models for SAMVEDNA API
"""

from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field, ConfigDict


class HealthResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    status: str = "healthy"
    version: str = "1.0.0"
    timestamp: str
    model_loaded: bool
    model_name: Optional[str] = None
    model_version: Optional[str] = None
    dataset_provenance: Optional[Dict[str, Any]] = None


class TelemetryInput(BaseModel):
    sensor_id: str = Field(..., description="Unique sensor station identifier (e.g. SNS-01)")
    lat: float = Field(..., description="Latitude in decimal degrees (WGS84)")
    lng: float = Field(..., description="Longitude in decimal degrees (WGS84)")
    name: Optional[str] = Field(None, description="Station geographical location name")
    state: Optional[str] = Field(None, description="Administrative state / province")
    place: Optional[str] = Field(None, description="Locality or sector")
    rainfall: Optional[float] = Field(None, description="Simulated rainfall intensity in mm/h")
    soil_moisture: Optional[float] = Field(None, description="Volumetric soil pore moisture percentage (0-100)")
    tilt: Optional[float] = Field(None, description="Ground surface inclinometer tilt angle in degrees")
    alert: Optional[bool] = Field(None, description="Hardware threshold trigger status")


class PredictionResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    sensor_id: str
    name: str
    state: str
    coordinates: List[float]
    probability: float = Field(..., ge=0.0, le=100.0, description="Estimated landslide probability (0-100%)")
    risk_level: str = Field(..., description="CRITICAL | HIGH | MEDIUM | LOW | UNAVAILABLE")
    confidence: float = Field(..., ge=0.0, le=100.0, description="Data completeness percentage")
    is_critical: bool
    threat_class: str
    threat_label: str
    dynamic_assessment: str
    model_name: str
    model_version: str
    model_available: bool
    data_quality: str
    feature_contributions: Optional[Dict[str, float]] = None
    timestamp: str


class ImpactZoneProperties(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    sensor_id: str
    area_name: str
    state: str
    zone_type: str = Field(..., description="initiation | runout_footprint | peripheral_exposure")
    risk_class: str
    probability_pct: float
    area_km2: float
    runout_distance_m: float
    elevation_drop_m: float
    fahrboeschung_deg: float
    uncertainty_m: float
    input_data_quality: str
    label: str
    timestamp: str
    model_version: str
    dem_source: str


class GeoJSONGeometry(BaseModel):
    type: str = "Polygon"
    coordinates: List[List[List[float]]]


class GeoJSONFeature(BaseModel):
    type: str = "Feature"
    id: Optional[str] = None
    geometry: GeoJSONGeometry
    properties: Dict[str, Any]


class ImpactAssessmentResponse(BaseModel):
    type: str = "FeatureCollection"
    features: List[GeoJSONFeature]
    summary: Dict[str, Any]
    metadata: Dict[str, Any]
