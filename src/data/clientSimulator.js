import baseSensors from './sensors.json';
import baseUnits from './units.json';
import basePersons from './persons.json';
import initialAlerts from './alerts.json';
import { computeLandslidePrediction } from '../utils/formatters';

/**
 * FIX Problem 4: Removed hardcoded EPICENTER constant. Citizen distance
 * is no longer measured from Reni (30.415, 79.308) for all sensors.
 * Instead, the getInitialPersons function computes distance from each
 * person to the nearest alerting sensor.
 *
 * FIX Problem 4: SNS-01..03 are no longer forced into permanent alert.
 * Alert status is computed purely from telemetry thresholds.
 */
const IMPACT_RADIUS_KM = 3.8;

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function randomWalk(value, step, min, max) {
  return clamp(value + (Math.random() - 0.5) * 2 * step, min, max);
}

/**
 * Find the nearest alerting sensor to a given lat/lng.
 * Returns { lat, lng, distance } or null if no sensors are alerting.
 */
function findNearestAlertSensor(lat, lng, sensors) {
  const alertSensors = sensors.filter((s) => s.alert);
  if (alertSensors.length === 0) return null;

  let nearest = null;
  let minDist = Infinity;
  for (const s of alertSensors) {
    const d = haversineKm(lat, lng, s.lat, s.lng);
    if (d < minDist) {
      minDist = d;
      nearest = { lat: s.lat, lng: s.lng, distance: d, sensorId: s.id };
    }
  }
  return nearest;
}

export function getInitialSensors() {
  return baseSensors.map((s) => {
    const pred = computeLandslidePrediction(s);
    return {
      ...s,
      landslideProbability: pred.probability,
      riskLevel: pred.riskLevel,
      confidence: pred.confidence,
      riskScore: pred.riskScore
    };
  });
}

export function getInitialPersons() {
  const sensors = getInitialSensors();
  return basePersons.map((p) => {
    const nearest = findNearestAlertSensor(p.lat, p.lng, sensors);
    if (!nearest) {
      return {
        ...p,
        distanceToImpact: null,
        status: p.status === 'IN ZONE' ? 'SAFE' : p.status
      };
    }
    return {
      ...p,
      distanceToImpact: +nearest.distance.toFixed(2),
      status: nearest.distance < IMPACT_RADIUS_KM ? 'IN ZONE' : p.status === 'IN ZONE' ? 'SAFE' : p.status
    };
  });
}

export function getInitialUnits() {
  return JSON.parse(JSON.stringify(baseUnits));
}

export function getInitialAlerts() {
  return JSON.parse(JSON.stringify(initialAlerts));
}

let activeSensors = getInitialSensors();
let activeUnits = getInitialUnits();
let alertCounter = 324;

export function initClientSimulation(handlers) {
  const { setConnected, setAlerts, addAlert, updateSensors, setPersons, setUnits } = handlers;

  // Initialize store state
  setConnected(true);
  setAlerts(getInitialAlerts());
  updateSensors(activeSensors);
  setPersons(getInitialPersons());
  setUnits(activeUnits);

  // Simulation timer loop (runs every 3.5 seconds)
  const timer = setInterval(() => {
    // 1. Update sensors
    activeSensors = activeSensors.map((s) => {
      const rainfall = randomWalk(s.rainfall, 1.0, 0, 200);
      const soilMoisture = randomWalk(s.soilMoisture, 0.7, 10, 100);
      const tilt = randomWalk(s.tilt, 0.15, 0, 15);
      // FIX Problem 4: Alert computed from thresholds only, NOT hardcoded for SNS-01..03
      const alert = rainfall > 130 || soilMoisture > 85 || tilt > 5;
      const updated = {
        ...s,
        rainfall: +rainfall.toFixed(1),
        soilMoisture: +soilMoisture.toFixed(1),
        tilt: +tilt.toFixed(2),
        alert
      };
      const pred = computeLandslidePrediction(updated);
      return {
        ...updated,
        landslideProbability: pred.probability,
        riskLevel: pred.riskLevel,
        confidence: pred.confidence,
        riskScore: pred.riskScore
      };
    });
    updateSensors(activeSensors);

    // 2. Update units along routes
    activeUnits = activeUnits.map((u) => {
      if (u.status !== 'EN ROUTE' || !u.route || u.route.length === 0) return u;
      let idx = u.currentRouteIndex || 0;
      if (idx < u.route.length - 1) {
        idx++;
      }
      const pos = u.route[idx];
      const dest = u.route[u.route.length - 1];
      const dist = haversineKm(pos[1], pos[0], dest[1], dest[0]);

      let status = u.status;
      let eta = u.eta;
      if (dist < 0.5 || idx >= u.route.length - 1) {
        status = 'ON SITE';
        eta = 0;
      } else {
        eta = Math.max(0, (u.eta || 0) - 1);
      }

      return {
        ...u,
        currentRouteIndex: idx,
        currentPosition: pos,
        status,
        eta
      };
    });
    setUnits(activeUnits);

    // 3. Occasional new alert
    const highRiskSensors = activeSensors.filter((s) => s.alert && s.rainfall > 135);
    if (highRiskSensors.length > 0 && Math.random() < 0.05) {
      alertCounter++;
      const src = highRiskSensors[Math.floor(Math.random() * highRiskSensors.length)];
      const newAlert = {
        id: `AA-${alertCounter}`,
        alertNumber: 240 + (alertCounter - 324),
        severity: src.rainfall > 140 ? 'CRITICAL' : 'HIGH',
        location: `${src.name}, ${src.state || 'Uttarakhand'}`,
        lat: src.lat,
        lng: src.lng,
        trigger: `${src.rainfall} mm / 24 hrs`,
        confidence: String(Math.round(85 + Math.random() * 12)),
        timestamp: Date.now(),
        sensorId: src.id
      };
      addAlert(newAlert);
    }
  }, 3500);

  return () => clearInterval(timer);
}
