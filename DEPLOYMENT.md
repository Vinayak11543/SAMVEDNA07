# SAMVEDNA07 Deployment & Operations Guide

This guide documents production deployment architecture, environment configurations, microservice hosting, model artifact storage, monitoring, and security hygiene for the **SAMVEDNA07** Landslide Early Warning and Disaster Impact Intelligence Platform.

---

## 1. System Architecture Overview

SAMVEDNA07 uses a decoupled, hybrid-cloud production architecture:

```
                          ┌───────────────────────────┐
                          │   Client Browser / PWA    │
                          │   (React 19 + CesiumJS)   │
                          └─────────────┬─────────────┘
                                        │
                    ┌───────────────────┴───────────────────┐
                    │                                       │
                    ▼                                       ▼
       ┌─────────────────────────┐             ┌─────────────────────────┐
       │     Vercel Edge/CDN     │             │     Python FastAPI      │
       │    Frontend Single-     │             │       Microservice      │
       │       Page App          │             │  (Docker / Cloud Run /  │
       │                         │             │     Render / AWS)       │
       │  • React 19 + Vite      │             │                         │
       │  • CesiumJS 3D Globe    │             │  • XGBoost Inference    │
       │  • Zustand State Store  │             │  • DEM Runout Engine    │
       │  • api/send-sms.js      │             │  • Exposure Analytics   │
       │    (Serverless Func)    │             │  • /health, /api/predict│
       └────────────┬────────────┘             └────────────┬────────────┘
                    │                                       │
                    ▼                                       ▼
       ┌─────────────────────────┐             ┌─────────────────────────┐
       │   Twilio SMS Gateway    │             │   Model & Cache Storage │
       │ (Emergency Alert Relay) │             │ (S3 / GCS / HF Hub / LFS)│
       └─────────────────────────┘             └─────────────────────────┘
```

- **Frontend & SMS Gateway:** Hosted on **Vercel** as a static SPA with a Node.js serverless function (`api/send-sms.js`).
- **Inference & Geospatial Microservice:** Hosted separately (e.g. Render, Railway, AWS ECS, Google Cloud Run, or Fly.io) running Python 3.11+ and FastAPI.
- **Client Fallback:** If the Python microservice is offline or unreachable, the frontend automatically falls back to the client-side rule-based estimator (`Rule-based risk estimator (simulated telemetry)`).

---

## 2. Frontend Deployment (Vercel)

### Step 1: Push Branch to Git Remote
```bash
git push origin ai-upgrade
```

### Step 2: Configure Vercel Project
1. Import your GitHub repository into Vercel.
2. Select framework preset: **Vite**.
3. Set Root Directory: `./` (project root).
4. Build Command: `npm run build`
5. Output Directory: `dist`
6. Install Command: `npm install`

### Step 3: Configure Environment Variables in Vercel
In the Vercel Project Settings > Environment Variables, define:

| Variable | Description | Required | Example |
| :--- | :--- | :--- | :--- |
| `VITE_CESIUM_ION_TOKEN` | Cesium Ion Default Access Token for 3D terrain/imagery | **Yes** | `eyJhbGciOi...` |
| `VITE_API_URL` | Base URL of deployed Python FastAPI microservice | **Yes** | `https://api.samvedna07.example.com` |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID for `api/send-sms.js` | Optional* | `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token for `api/send-sms.js` | Optional* | `your_twilio_auth_token` |
| `TWILIO_PHONE_NUMBER` | Originating Twilio Phone Number | Optional* | `+18005550199` |

*\*Note: If Twilio credentials are not set, `api/send-sms.js` gracefully logs the SMS payload without crashing.*

---

## 3. Python Microservice Deployment (FastAPI)

The backend service resides in `api_service/` and contains the trained XGBoost model, the scikit-learn preprocessor pipeline, the DEM-based $H/L$ Heim runout geometry engine, and population exposure analytics.

### Option A: Docker Container (Recommended)

A `Dockerfile` is provided in the repository root:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies (build-essential, curl for healthchecks)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY api_service/requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code and trained model artifacts
COPY api_service/ api_service/
COPY ml/models/ ml/models/

ENV PORT=8000
ENV CORS_ORIGINS="https://samvedna07.vercel.app,http://localhost:5173,http://localhost:5174"
ENV MODEL_PATH="ml/models/landslide_xgb_model.json"
ENV PREPROCESSOR_PATH="ml/models/preprocessor.joblib"
ENV METADATA_PATH="ml/models/model_metadata.json"

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "api_service.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

#### Build and Run Locally with Docker:
```bash
docker build -t samvedna07-api .
docker run -p 8000:8000 -e CORS_ORIGINS="*" samvedna07-api
```

### Option B: Deploying to Cloud Run / Render / Railway

1. **Root Directory:** Repository root.
2. **Build Command:** `pip install -r api_service/requirements.txt`
3. **Start Command:** `uvicorn api_service.main:app --host 0.0.0.0 --port $PORT`
4. **Environment Variables:**
   - `CORS_ORIGINS`: Comma-separated allowed web origins, e.g. `https://your-app.vercel.app`.
   - `PORT`: Set automatically by cloud provider (defaults to `8000`).
   - `MODEL_PATH`: `ml/models/landslide_xgb_model.json`
   - `PREPROCESSOR_PATH`: `ml/models/preprocessor.joblib`
   - `METADATA_PATH`: `ml/models/model_metadata.json`

---

## 4. Model and Dataset Storage Strategy

| Artifact | Size | Storage Mechanism | Production Best Practice |
| :--- | :--- | :--- | :--- |
| `landslide_xgb_model.json` | ~450 KB | Git repository / Docker image | Bake directly into container image or fetch from S3 at startup. |
| `preprocessor.joblib` | ~15 KB | Git repository / Docker image | Bake directly into container image. |
| `model_metadata.json` | ~6 KB | Git repository / Docker image | Version alongside model weights. |
| `elevation_cache.json` | ~1-5 MB | Persistent Volume / Redis | Mount as a shared cache volume to prevent redundant DEM queries. |
| Raw Datasets (`nasa_glc.csv`) | ~1.5 MB | Git LFS / S3 / Hugging Face | Store in S3 bucket `s3://samvedna07-ml-data/raw/` for retraining pipelines. |

### Model Retraining Pipeline
To retrain the model with updated NASA GLC or NRSC landslide events:
```bash
python ml/training/train_xgboost.py
```
This recomputes stratified spatial splits (15 km buffer), performs 45-fit RandomizedSearchCV, outputs holdout metrics, computes SHAP values, and atomically replaces the model weights in `ml/models/`.

---

## 5. Logging, Monitoring & Observability

### Health Checks
- **Endpoint:** `GET /health`
- **Response:**
  ```json
  {
    "status": "healthy",
    "timestamp": "2026-10-30T18:00:00Z",
    "model_loaded": true,
    "model_version": "1.0.0"
  }
  ```
- Configure uptime monitoring (e.g. BetterStack, Datadog Synthetics, or UptimeRobot) targeting `/health` every 60 seconds.

### Operational Logging
- The FastAPI microservice uses standard structured logging via Python's `logging` module.
- In production, log level should be set to `INFO`.
- Incoming inference requests log sensor ID, inference latency, risk classification, and data completeness metrics.

### Alerting & Drift Detection
- Alert on HTTP 5xx rates exceeding 1% over a 5-minute rolling window.
- Monitor feature distributions (rainfall accumulation and soil moisture) against training baseline distributions (`ml/reports/model_evaluation_report.md`) using Evidently AI or Great Expectations.

---

## 6. Security & Credential Hygiene

1. **Zero Hardcoded Secrets:**
   - Cesium Ion tokens are strictly sourced from `VITE_CESIUM_ION_TOKEN`.
   - Twilio credentials are never present in client bundles; they live exclusively in server-side environment variables for `api/send-sms.js`.
2. **CORS Isolation:**
   - In production, set `CORS_ORIGINS` to your exact Vercel frontend domain (e.g. `https://samvedna07.vercel.app`) rather than wildcard `*`.
3. **Graceful Fallback:**
   - If the API microservice is down, unreachable, or returns an error, the frontend does not freeze or crash; it seamlessly falls back to the client-side rule-based estimator and informs the operator with a visual fallback indicator.
