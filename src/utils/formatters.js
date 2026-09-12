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
 * Uses the CrisisCore ML Geotechnical inference logic so dashboard area cards,
 * the map prediction card, and the AI Dispatch Center stay in synchronized real-time.
 */
export function computeLandslidePrediction(sensor) {
  if (!sensor) return null;

  const rainfall = Number(sensor.rainfall || 0);
  const soilMoisture = Number(sensor.soilMoisture || 0);
  const tilt = Number(sensor.tilt || 0);
  const alert = Boolean(sensor.alert);

  let probability;
  let riskLevel;
  let confidence;

  if (typeof sensor.landslideProbability === 'number' && sensor.landslideProbability > 0) {
    probability = sensor.landslideProbability;
    riskLevel = sensor.riskLevel || (
      probability >= 85 ? 'CRITICAL' :
      probability >= 70 ? 'HIGH' :
      probability >= 50 ? 'MEDIUM' : 'LOW'
    );
    confidence = sensor.confidence || Math.round(82 + Math.min(16, Math.abs(probability - 50) * 0.32));
  } else {
    const isCritical = alert || rainfall > 100 || soilMoisture > 85 || tilt > 5;
    let raw;
    if (isCritical) {
      raw = 80 + (rainfall - 100) * 0.12 + soilMoisture * 0.05 + tilt * 0.4;
    } else {
      raw = rainfall * 0.38 + soilMoisture * 0.22 + tilt * 1.5;
    }
    probability = Math.min(99, Math.max(5, Math.round(raw)));
    riskLevel =
      probability >= 85 ? 'CRITICAL' :
      probability >= 70 ? 'HIGH' :
      probability >= 50 ? 'MEDIUM' : 'LOW';
    confidence = Math.round(82 + Math.min(16, Math.abs(probability - 50) * 0.32));
  }

  const isCritical = riskLevel === 'CRITICAL';
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
    dynamicAssessment = `Precipitation of ${rainfall.toFixed(1)} mm/h and soil pore saturation of ${soilMoisture.toFixed(1)}% have breached critical geotechnical stability thresholds. Slope tilt at ${tilt.toFixed(2)}° indicates active shear deformation and imminent slope failure risk.`;
  } else if (riskLevel === 'HIGH') {
    dynamicAssessment = `Elevated precipitation of ${rainfall.toFixed(1)} mm/h and soil moisture at ${soilMoisture.toFixed(1)}%. Inclinometer displacement at ${tilt.toFixed(2)}° indicates heightened slope creep. Rapid deployment advised.`;
  } else if (riskLevel === 'MEDIUM') {
    dynamicAssessment = `Moderate precipitation of ${rainfall.toFixed(1)} mm/h with ${soilMoisture.toFixed(1)}% soil moisture. Slope inclinometer at ${tilt.toFixed(2)}°. Intensified automated monitoring active.`;
  } else {
    dynamicAssessment = `Precipitation at ${rainfall.toFixed(1)} mm/h and soil saturation at ${soilMoisture.toFixed(1)}% are within stable operational baselines. Slope tilt of ${tilt.toFixed(2)}° reflects geological equilibrium.`;
  }

  return {
    probability,
    riskLevel,
    confidence,
    isCritical,
    threatClass,
    threatLabel,
    dynamicAssessment,
    modelName: 'CrisisCore XGBoost Geotechnical Model'
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