/**
 * apiClient.js — Robust client for SAMVEDNA FastAPI Service
 *
 * Features:
 * - Request cancellation and stale response filtering
 * - In-flight request deduplication
 * - In-memory response cache with TTL
 * - Automatic, honest fallback to Phase A rule-based estimator
 * - State tracking: loading, error, model-unavailable, stale
 */

import { computeRiskEstimate, computeHazardEnvelope } from '../utils/riskEstimator';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const CACHE_TTL_MS = 15000; // 15 seconds

// In-memory caches
const predictionCache = new Map();
const impactCache = new Map();
const inFlightRequests = new Map();

// Incremental sequence ID to discard stale responses
let activeRequestId = 0;
let activeSensorId = null;

/**
 * Generate a cache key from sensor ID and telemetry values
 */
function getTelemetryCacheKey(sensor) {
  if (!sensor) return '';
  const r = Math.round(Number(sensor.rainfall || 0) * 10) / 10;
  const m = Math.round(Number(sensor.soilMoisture || 0) * 10) / 10;
  const t = Math.round(Number(sensor.tilt || 0) * 10) / 10;
  return `${sensor.id}:${r}:${m}:${t}`;
}

/**
 * Fetch wrapper with timeout and error trapping
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 6000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

/**
 * Build rule-based prediction fallback object
 */
function buildRuleBasedFallback(sensor) {
  const estimate = computeRiskEstimate(sensor);
  const lat = Number(sensor.lat || 30.415);
  const lng = Number(sensor.lng || 79.308);

  return {
    sensor_id: sensor.id || 'SNS-UNKNOWN',
    name: sensor.name || 'Station',
    state: sensor.state || 'Uttarakhand',
    coordinates: [lng, lat],
    probability: estimate ? estimate.probability : 50.0,
    risk_level: estimate ? estimate.riskLevel : 'MEDIUM',
    confidence: estimate ? estimate.confidence : 80.0,
    is_critical: estimate ? estimate.isCritical : false,
    threat_class: estimate ? estimate.threatClass : 'threat-medium',
    threat_label: estimate ? estimate.threatLabel : 'ELEVATED THREAT',
    dynamic_assessment: estimate
      ? `${estimate.dynamicAssessment} (Rule-based fallback: API service offline)`
      : 'Rule-based estimate generated from simulated telemetry.',
    model_name: 'Rule-based risk estimator (simulated telemetry - API offline)',
    model_version: 'rule-based-1.0.0',
    model_available: false,
    is_fallback: true,
    data_quality: estimate ? estimate.dataQuality : 'partial',
    timestamp: new Date().toISOString()
  };
}

/**
 * Build rule-based GeoJSON impact fallback FeatureCollection
 */
function buildImpactZoneFallback(sensor, prediction) {
  const envelope = computeHazardEnvelope(sensor);
  const lat = Number(sensor.lat || 30.415);
  const lng = Number(sensor.lng || 79.308);
  const prob = prediction ? prediction.probability : 60.0;
  const riskLevel = prediction ? prediction.risk_level : 'MEDIUM';

  if (!envelope) {
    return null;
  }

  const feature = {
    type: 'Feature',
    id: `fallback-envelope-${sensor.id}`,
    geometry: {
      type: 'Polygon',
      coordinates: [envelope.coordinates]
    },
    properties: {
      sensor_id: sensor.id,
      area_name: sensor.name || 'Monitoring Area',
      state: sensor.state || 'Uttarakhand',
      zone_type: 'runout_footprint',
      zone_label: 'Directional Approximate Hazard Envelope',
      risk_class: riskLevel,
      probability_pct: prob,
      area_km2: envelope.areaKm2,
      runout_distance_m: Math.round(envelope.areaKm2 * 600),
      elevation_drop_m: 250.0,
      fahrboeschung_deg: 26.0,
      uncertainty_m: 350.0,
      input_data_quality: 'rule_based_fallback',
      dem_source: 'Geometric Envelope (API Offline)',
      label: 'Approximate hazard estimate - not a validated evacuation boundary',
      timestamp: new Date().toISOString(),
      model_version: 'fallback-1.0.0'
    }
  };

  return {
    type: 'FeatureCollection',
    features: [feature],
    summary: {
      sensor_id: sensor.id,
      area_name: sensor.name,
      state: sensor.state,
      coordinates: [lng, lat],
      risk_class: riskLevel,
      probability_pct: prob,
      total_impact_area_km2: envelope.areaKm2,
      runout_distance_m: Math.round(envelope.areaKm2 * 600),
      input_data_quality: 'rule_based_fallback',
      disclaimer: 'Approximate hazard estimate - not a validated evacuation boundary'
    },
    metadata: {
      engine: 'Phase A Geometric Estimator (Fallback)',
      version: 'fallback-1.0.0'
    }
  };
}

/**
 * Fetch landslide risk prediction from FastAPI with caching and fallback
 */
export async function getSensorPrediction(sensor) {
  if (!sensor || !sensor.id) return null;

  activeSensorId = sensor.id;
  const requestId = ++activeRequestId;
  const cacheKey = getTelemetryCacheKey(sensor);

  // 1. Check in-memory cache
  const cached = predictionCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return { ...cached.data, isStale: false };
  }

  // 2. Check in-flight deduplication
  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey);
  }

  // Prepare payload
  const payload = {
    sensor_id: sensor.id,
    name: sensor.name || 'Station',
    state: sensor.state || 'Uttarakhand',
    place: sensor.place || 'Sector',
    lat: Number(sensor.lat),
    lng: Number(sensor.lng),
    rainfall: Number(sensor.rainfall || 0),
    soil_moisture: Number(sensor.soilMoisture || 0),
    tilt: Number(sensor.tilt || 0),
    alert: Boolean(sensor.alert)
  };

  const fetchPromise = (async () => {
    try {
      const resp = await fetchWithTimeout(`${API_BASE_URL}/api/predict`, {
        method: 'POST',
        body: JSON.stringify(payload)
      }, 5000);

      // Check if this request is still the active one (stale request prevention)
      if (requestId !== activeRequestId || activeSensorId !== sensor.id) {
        return { isStale: true, sensor_id: sensor.id };
      }

      if (resp.ok) {
        const data = await resp.json();
        const result = {
          ...data,
          is_fallback: false,
          isStale: false
        };
        predictionCache.set(cacheKey, { data: result, cachedAt: Date.now() });
        return result;
      }
      throw new Error(`API returned HTTP ${resp.status}`);
    } catch {
      // Ignore if superseded by a newer sensor selection
      if (requestId !== activeRequestId || activeSensorId !== sensor.id) {
        return { isStale: true, sensor_id: sensor.id };
      }

      // Seamless fallback to Phase A rule-based estimator
      const fallback = buildRuleBasedFallback(sensor);
      predictionCache.set(cacheKey, { data: fallback, cachedAt: Date.now() });
      return fallback;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
}

/**
 * Fetch DEM-based multi-zone terrain runout GeoJSON FeatureCollection
 */
export async function getSensorImpactZones(sensor, prediction) {
  if (!sensor || !sensor.id) return null;

  const CHAMOLI_IDS = ['SNS-01', 'SNS-02', 'SNS-03', 'SNS-04', 'SNS-05'];
  if (CHAMOLI_IDS.includes(sensor.id)) {
    // Chamoli area retains original polygon as required by Phase A/B
    return null;
  }

  const cacheKey = `impact:${sensor.id}:${Math.round(prediction?.probability || 50)}`;
  const cached = impactCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS * 2) {
    return cached.data;
  }

  const payload = {
    sensor_id: sensor.id,
    name: sensor.name || 'Station',
    state: sensor.state || 'Uttarakhand',
    lat: Number(sensor.lat),
    lng: Number(sensor.lng),
    rainfall: Number(sensor.rainfall || 0),
    soil_moisture: Number(sensor.soilMoisture || 0),
    tilt: Number(sensor.tilt || 0),
    alert: Boolean(sensor.alert)
  };

  try {
    const resp = await fetchWithTimeout(`${API_BASE_URL}/api/impact-assessment`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }, 6000);

    if (resp.ok) {
      const geojson = await resp.json();
      impactCache.set(cacheKey, { data: geojson, cachedAt: Date.now() });
      return geojson;
    }
    throw new Error(`Impact assessment API returned HTTP ${resp.status}`);
  } catch {
    const fallback = buildImpactZoneFallback(sensor, prediction);
    if (fallback) {
      impactCache.set(cacheKey, { data: fallback, cachedAt: Date.now() });
    }
    return fallback;
  }
}
