"""
config.py — FastAPI service configuration for SAMVEDNA
"""

import os
from typing import List

class Settings:
    PROJECT_NAME: str = "SAMVEDNA Disaster-Impact API"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    
    # Paths to ML artifacts
    BASE_DIR: str = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    MODEL_PATH: str = os.getenv(
        "MODEL_PATH",
        os.path.join(BASE_DIR, "ml", "models", "landslide_xgb_model.json")
    )
    PREPROCESSOR_PATH: str = os.getenv(
        "PREPROCESSOR_PATH",
        os.path.join(BASE_DIR, "ml", "models", "preprocessor.joblib")
    )
    METADATA_PATH: str = os.getenv(
        "METADATA_PATH",
        os.path.join(BASE_DIR, "ml", "models", "model_metadata.json")
    )
    
    # Path to sensors.json (read-only reference)
    SENSORS_PATH: str = os.path.join(BASE_DIR, "src", "data", "sensors.json")
    
    # CORS: Allowed frontend origins
    CORS_ORIGINS: List[str] = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174,https://*.vercel.app,*"
        ).split(",")
        if origin.strip()
    ]
    
    # Host & Port
    HOST: str = os.getenv("API_HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", os.getenv("API_PORT", "8000")))

settings = Settings()
