/**
 * riskEstimator.js — Rule-based risk estimator for SAMVEDNA
 *
 * This is NOT a machine-learning model. It uses simple threshold logic on
 * simulated telemetry values (rainfall, soil moisture, ground tilt) to
 * produce an approximate risk score. All outputs should be displayed with
 * the label "Rule-based risk estimator (simulated telemetry)".
 *
 * No trained model, no calibration, no real geotechnical parameters.
 * Confidence is reported only as data-completeness (how many of the three
 * telemetry channels are present and within plausible ranges).
 *
 * Per-sensor slope, aspect, elevation and population values are
 * ILLUSTRATIVE PLACEHOLDERS and must be labelled as such in the UI.
 */

// ── Illustrative terrain placeholders ───────────────────────────────────
// These are NOT measured values. They are rough estimates for UI display
// only and are clearly labelled as placeholders in the UI.
const PLACEHOLDER_TERRAIN = {
  defaultSlope: 30,      // degrees (placeholder)
  defaultAspect: 180,    // degrees from north (placeholder)
  defaultElevation: 2000 // metres (placeholder)
};

/**
 * Check whether a numeric value is present and finite.
 */
function isValid(v) {
  return v !== null && v !== undefined && Number.isFinite(Number(v));
}

/**
 * Compute data-completeness as a fraction [0, 1].
 * Counts which of the three telemetry channels carry valid data.
 */
function dataCompleteness(sensor) {
  let present = 0;
  let total = 3; // rainfall, soilMoisture, tilt
  if (isValid(sensor.rainfall)) present++;
  if (isValid(sensor.soilMoisture)) present++;
  if (isValid(sensor.tilt)) present++;
  return present / total;
}

/**
 * Compute a rule-based risk estimate from sensor telemetry.
 *
 * Returns an object with:
 *   probability   – 0-100 integer, rule-based risk score
 *   riskLevel     – 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
 *   confidence    – data-completeness percentage (0-100), NOT model confidence
 *   isCritical    – boolean shorthand
 *   threatClass   – CSS class name
 *   threatLabel   – human-readable label
 *   dynamicAssessment – descriptive text for the current state
 *   modelName     – always the honest rule-based name
 *   isRuleBased   – always true
 *   dataQuality   – 'complete' | 'partial' | 'insufficient'
 *
 * If essential data is missing, returns a result with riskLevel = 'UNAVAILABLE'.
 */
export function computeRiskEstimate(sensor) {
  if (!sensor) return null;

  const rainfall = Number(sensor.rainfall || 0);
  const soilMoisture = Number(sensor.soilMoisture || 0);
  const tilt = Number(sensor.tilt || 0);

  const completeness = dataCompleteness(sensor);

  // If no valid telemetry at all, return unavailable
  if (completeness === 0) {
    return {
      probability: null,
      riskLevel: 'UNAVAILABLE',
      confidence: 0,
      isCritical: false,
      threatClass: 'threat-unavailable',
      threatLabel: 'DATA UNAVAILABLE',
      dynamicAssessment: 'Insufficient telemetry data to compute a risk estimate. No valid readings available.',
      modelName: 'Rule-based risk estimator (simulated telemetry)',
      isRuleBased: true,
      dataQuality: 'insufficient'
    };
  }

  // ── Simple additive rule-based score ──────────────────────────────
  // Each channel contributes a normalised fraction to the total score.
  // These thresholds are chosen for plausibility with the simulated
  // ranges in sensors.json but carry no real geotechnical validity.

  // Rainfall contribution: 0-200 mm/h range → 0-40 points
  const rainfallScore = isValid(sensor.rainfall)
    ? Math.min(40, (rainfall / 200) * 40)
    : 0;

  // Soil moisture contribution: 0-100% range → 0-35 points
  const moistureScore = isValid(sensor.soilMoisture)
    ? Math.min(35, (soilMoisture / 100) * 35)
    : 0;

  // Tilt contribution: 0-15° range → 0-25 points
  const tiltScore = isValid(sensor.tilt)
    ? Math.min(25, (tilt / 15) * 25)
    : 0;

  const rawScore = rainfallScore + moistureScore + tiltScore;
  const probability = Math.min(99, Math.max(1, Math.round(rawScore)));

  const riskLevel =
    probability >= 80 ? 'CRITICAL' :
    probability >= 60 ? 'HIGH' :
    probability >= 40 ? 'MEDIUM' : 'LOW';

  const isCritical = riskLevel === 'CRITICAL';

  const threatClass =
    riskLevel === 'CRITICAL' ? 'threat-critical' :
    riskLevel === 'HIGH' ? 'threat-high' :
    riskLevel === 'MEDIUM' ? 'threat-medium' : 'threat-normal';

  const threatLabel =
    riskLevel === 'CRITICAL' ? 'CRITICAL THREAT' :
    riskLevel === 'HIGH' ? 'HIGH THREAT' :
    riskLevel === 'MEDIUM' ? 'ELEVATED THREAT' : 'LOW RISK / STABLE';

  const confidencePct = Math.round(completeness * 100);
  const dataQuality = completeness === 1 ? 'complete' : completeness >= 0.66 ? 'partial' : 'insufficient';

  // Dynamic assessment text
  let dynamicAssessment = '';
  if (riskLevel === 'CRITICAL') {
    dynamicAssessment = `Simulated telemetry: rainfall ${rainfall.toFixed(1)} mm/h, soil moisture ${soilMoisture.toFixed(1)}%, ground tilt ${tilt.toFixed(2)}°. Rule-based score exceeds critical threshold. This is an approximate estimate from simulated data, not a validated prediction.`;
  } else if (riskLevel === 'HIGH') {
    dynamicAssessment = `Simulated telemetry: rainfall ${rainfall.toFixed(1)} mm/h, soil moisture ${soilMoisture.toFixed(1)}%, ground tilt ${tilt.toFixed(2)}°. Rule-based score indicates elevated risk. Approximate estimate from simulated data.`;
  } else if (riskLevel === 'MEDIUM') {
    dynamicAssessment = `Simulated telemetry: rainfall ${rainfall.toFixed(1)} mm/h, soil moisture ${soilMoisture.toFixed(1)}%, ground tilt ${tilt.toFixed(2)}°. Moderate rule-based score. Approximate estimate from simulated data.`;
  } else {
    dynamicAssessment = `Simulated telemetry: rainfall ${rainfall.toFixed(1)} mm/h, soil moisture ${soilMoisture.toFixed(1)}%, ground tilt ${tilt.toFixed(2)}°. Rule-based score within stable range. Approximate estimate from simulated data.`;
  }

  return {
    probability,
    riskLevel,
    confidence: confidencePct,
    isCritical,
    threatClass,
    threatLabel,
    dynamicAssessment,
    modelName: 'Rule-based risk estimator (simulated telemetry)',
    isRuleBased: true,
    dataQuality
  };
}

/**
 * Generate an approximate directional hazard envelope around a sensor.
 *
 * For sensors SNS-01..SNS-05 (Chamoli area), this returns null so the
 * caller can use the existing Chamoli polygon instead.
 *
 * For all other sensors, returns a GeoJSON-like polygon representing an
 * approximate, directional elliptical hazard envelope that extends
 * downslope from the sensor location. The envelope is based on the
 * risk score and illustrative placeholder terrain parameters.
 *
 * The result includes:
 *   coordinates – array of [lng, lat] pairs forming the polygon
 *   areaKm2     – estimated area in km² (illustrative)
 *   label       – always "Approximate hazard estimate - not a validated evacuation boundary"
 *   sensorId    – ID of the sensor this envelope is for
 *
 * Returns null if data is insufficient to draw an envelope.
 */
export function computeHazardEnvelope(sensor) {
  if (!sensor) return null;

  // Chamoli-area sensors use the existing hardcoded polygon
  const CHAMOLI_IDS = ['SNS-01', 'SNS-02', 'SNS-03', 'SNS-04', 'SNS-05'];
  if (CHAMOLI_IDS.includes(sensor.id)) {
    return null; // signal caller to use existing Chamoli polygon
  }

  const lat = Number(sensor.lat);
  const lng = Number(sensor.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const estimate = computeRiskEstimate(sensor);
  if (!estimate || estimate.riskLevel === 'UNAVAILABLE') return null;

  // Compute envelope size from risk score
  // Higher risk → larger envelope. Range: 0.5 km to 3.5 km radius
  const prob = estimate.probability;
  const baseRadiusKm = 0.5 + (prob / 100) * 3.0;

  // Illustrative downslope direction (placeholder aspect in degrees from north).
  // Using a generic south-facing aspect as placeholder.
  const aspectDeg = PLACEHOLDER_TERRAIN.defaultAspect; // placeholder
  const aspectRad = (aspectDeg * Math.PI) / 180;

  // Generate an elongated elliptical polygon:
  // - Semi-major axis along downslope direction (1.5x base)
  // - Semi-minor axis perpendicular (0.6x base)
  const semiMajor = baseRadiusKm * 1.5;
  const semiMinor = baseRadiusKm * 0.6;

  const points = 32;
  const coordinates = [];
  const R = 6371; // Earth radius km

  for (let i = 0; i <= points; i++) {
    const angle = (i * 2 * Math.PI) / points;

    // Ellipse in local coordinates (aligned with aspect)
    const localX = semiMinor * Math.cos(angle);
    const localY = semiMajor * Math.sin(angle);

    // Rotate to align semi-major axis with downslope direction
    // Offset center slightly downslope
    const offsetKm = semiMajor * 0.3; // center offset downslope
    const rotatedX = localX * Math.cos(aspectRad) - localY * Math.sin(aspectRad);
    const rotatedY = localX * Math.sin(aspectRad) + localY * Math.cos(aspectRad) + offsetKm;

    // Convert km offset to degrees
    const dLat = rotatedY / R * (180 / Math.PI);
    const dLng = rotatedX / (R * Math.cos(lat * Math.PI / 180)) * (180 / Math.PI);

    coordinates.push([lng + dLng, lat + dLat]);
  }

  // Approximate area of the ellipse in km²
  const areaKm2 = Math.PI * semiMajor * semiMinor;

  return {
    sensorId: sensor.id,
    coordinates,
    areaKm2: +areaKm2.toFixed(2),
    label: 'Approximate hazard estimate - not a validated evacuation boundary',
    riskLevel: estimate.riskLevel,
    probability: estimate.probability,
    centerLat: lat,
    centerLng: lng,
    terrainNote: 'Slope, aspect and elevation values are illustrative placeholders'
  };
}

/**
 * Compute an illustrative impact summary for display.
 * All values are placeholders and must be labelled as such.
 */
export function computeImpactSummary(sensor) {
  if (!sensor) return null;

  const envelope = computeHazardEnvelope(sensor);
  const estimate = computeRiskEstimate(sensor);

  if (!estimate || estimate.riskLevel === 'UNAVAILABLE') {
    return {
      areaKm2: null,
      estimatedPopulation: null,
      label: 'Impact data unavailable — insufficient telemetry',
      isPlaceholder: true
    };
  }

  const CHAMOLI_IDS = ['SNS-01', 'SNS-02', 'SNS-03', 'SNS-04', 'SNS-05'];
  const isChamoli = CHAMOLI_IDS.includes(sensor.id);

  return {
    areaKm2: envelope ? envelope.areaKm2 : (isChamoli ? null : null),
    estimatedPopulation: null, // no population data available
    label: isChamoli
      ? 'Chamoli area — approximate hazard zone (simulated telemetry)'
      : 'Approximate hazard estimate — illustrative placeholder values',
    isPlaceholder: true
  };
}

