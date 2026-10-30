# SAMVEDNA Disaster-Impact & Landslide Prediction API

FastAPI microservice providing real-time landslide risk inference, DEM-based flow-routing runout simulation, and multi-zone GeoJSON generation.

---

## Running the API

### 1. Install Requirements
```bash
pip install -r api_service/requirements.txt
```

### 2. Start Service
```bash
cd api_service
python main.py
```
Or via uvicorn directly:
```bash
uvicorn main:app --app-dir api_service --host 0.0.0.0 --port 8000 --reload
```
The interactive API documentation is available at `http://localhost:8000/docs`.

---

## API Endpoints

### 1. `GET /health`
Returns system status, API version, and ML model loading state.

### 2. `POST /api/predict`
Calculates real-time landslide risk probability and risk level from sensor telemetry.
```json
{
  "sensor_id": "SNS-03",
  "name": "Reni Village",
  "state": "Uttarakhand",
  "lat": 30.415,
  "lng": 79.308,
  "rainfall": 128.0,
  "soil_moisture": 82.0,
  "tilt": 3.5
}
```

### 3. `POST /api/impact-assessment`
Computes DEM-based multi-zone terrain runout (Initiation, Runout Footprint, Peripheral Exposure) as standard RFC 7946 GeoJSON.

### 4. `GET /api/predictions/{sensor_id}`
Retrieves prediction for a specific station from the 41-station registry.

### 5. `GET /api/impact-zones/{sensor_id}`
Retrieves pre-calculated terrain runout GeoJSON for any station (`SNS-01` to `SNS-41`).
