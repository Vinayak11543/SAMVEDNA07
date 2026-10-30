export function timeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return seconds + 's ago';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + ' min ago';
  const hours = Math.floor(minutes / 60);
  return hours + 'h ago';
}

export function formatEta(seconds) {
  if (!seconds || seconds <= 0) return '-';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 60) {
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return h + 'h ' + rm + 'm';
  }
  return m + 'm ' + String(s).padStart(2, '0') + 's';
}

export function formatDistance(km) {
  if (km < 1) return (km * 1000).toFixed(0) + 'm';
  return km.toFixed(1) + ' km';
}

export function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export function getStatusClass(status) {
  const map = {
    'SAFE': 'status-safe',
    'IN ZONE': 'status-inzone',
    'NOTIFIED': 'status-notified',
    'EVACUATED': 'status-evacuated',
    'STANDBY': 'status-standby',
    'EN ROUTE': 'status-enroute',
    'ON SITE': 'status-onsite'
  };
  return map[status] || 'status-safe';
}

export function getSeverityClass(severity) {
  const map = {
    'CRITICAL': 'badge-high',
    'HIGH': 'badge-high',
    'MEDIUM': 'badge-medium',
    'LOW': 'badge-low'
  };
  return map[severity] || 'badge-low';
}

export function getUnitIcon(type) {
  const map = {
    'Rescue Team': 'RSC',
    'Medical Unit': 'MED',
    'Helicopter': 'AIR',
    'Engineering': 'ENG'
  };
  return map[type] || 'UNIT';
}

export function clockTime() {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

/**
 * Compute landslide prediction from sensor telemetry.
 *
 * ALWAYS recomputes from the current telemetry values — never uses cached
 * landslideProbability. This is a rule-based estimator on simulated telemetry,
 * NOT a trained ML model.
 *
 * FIX: Previously, if sensor.landslideProbability was set, the function
 * returned that cached value forever. Now it always recomputes from the
 * live rainfall, soilMoisture and tilt values.
 */
export function computeLandslidePrediction(sensor) {
  if (!sensor) return null;

  const rainfall = Number(sensor.rainfall || 0);
  const soilMoisture = Number(sensor.soilMoisture || 0);
  const tilt = Number(sensor.tilt || 0);
  const alert = Boolean(sensor.alert);

  // Always recompute — never use a cached landslideProbability
  const isCritical = alert || rainfall > 100 || soilMoisture > 85 || tilt > 5;
  let raw;
  if (isCritical) {
    raw = 80 + (rainfall - 100) * 0.12 + soilMoisture * 0.05 + tilt * 0.4;
  } else {
    raw = rainfall * 0.38 + soilMoisture * 0.22 + tilt * 1.5;
  }
  const probability = Math.min(99, Math.max(5, Math.round(raw)));

  const riskLevel =
    probability >= 85 ? 'CRITICAL' :
    probability >= 70 ? 'HIGH' :
    probability >= 50 ? 'MEDIUM' : 'LOW';

  // Data completeness as confidence (not model confidence)
  let channelsPresent = 0;
  if (Number.isFinite(Number(sensor.rainfall))) channelsPresent++;
  if (Number.isFinite(Number(sensor.soilMoisture))) channelsPresent++;
  if (Number.isFinite(Number(sensor.tilt))) channelsPresent++;
  const confidence = Math.round((channelsPresent / 3) * 100);

  const isCrit = riskLevel === 'CRITICAL';
  const threatClass =
    riskLevel === 'CRITICAL' ? 'threat-critical' :
    riskLevel === 'HIGH' ? 'threat-high' :
    riskLevel === 'MEDIUM' ? 'threat-medium' : 'threat-normal';

  const threatLabel =
    riskLevel === 'CRITICAL' ? 'CRITICAL THREAT' :
    riskLevel === 'HIGH' ? 'HIGH THREAT' :
    riskLevel === 'MEDIUM' ? 'ELEVATED THREAT' : 'LOW RISK / STABLE';

  let dynamicAssessment = '';
  if (riskLevel === 'CRITICAL') {
    dynamicAssessment = `Simulated telemetry: rainfall ${rainfall.toFixed(1)} mm/h, soil moisture ${soilMoisture.toFixed(1)}%, ground tilt ${tilt.toFixed(2)}°. Rule-based score exceeds critical threshold.`;
  } else if (riskLevel === 'HIGH') {
    dynamicAssessment = `Simulated telemetry: rainfall ${rainfall.toFixed(1)} mm/h, soil moisture ${soilMoisture.toFixed(1)}%, ground tilt ${tilt.toFixed(2)}°. Rule-based score indicates elevated risk.`;
  } else if (riskLevel === 'MEDIUM') {
    dynamicAssessment = `Simulated telemetry: rainfall ${rainfall.toFixed(1)} mm/h, soil moisture ${soilMoisture.toFixed(1)}%, ground tilt ${tilt.toFixed(2)}°. Moderate risk score.`;
  } else {
    dynamicAssessment = `Simulated telemetry: rainfall ${rainfall.toFixed(1)} mm/h, soil moisture ${soilMoisture.toFixed(1)}%, ground tilt ${tilt.toFixed(2)}°. Score within stable range.`;
  }

  return {
    probability,
    riskLevel,
    confidence,
    isCritical: isCrit,
    threatClass,
    threatLabel,
    dynamicAssessment,
    modelName: 'Rule-based risk estimator (simulated telemetry)'
  };
}

/**
 * Haversine distance in km — mirrors the server-side simulator.js implementation.
 */
export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
