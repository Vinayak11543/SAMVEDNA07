FROM python:3.11-slim

WORKDIR /app

# Install system packages (curl for healthchecks, build-essential for C-extensions)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY api_service/requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code, model weights, and sensor registry
COPY api_service/ api_service/
COPY ml/models/ ml/models/
COPY src/data/sensors.json src/data/sensors.json

# Environment defaults
ENV PORT=8000
ENV CORS_ORIGINS="*"
ENV MODEL_PATH="ml/models/landslide_xgb_model.json"
ENV PREPROCESSOR_PATH="ml/models/preprocessor.joblib"
ENV METADATA_PATH="ml/models/model_metadata.json"

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:${PORT}/health || exit 1

# Start Uvicorn dynamically binding to $PORT provided by host
CMD ["sh", "-c", "uvicorn api_service.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
