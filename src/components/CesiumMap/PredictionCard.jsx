import React from 'react';
import useStore from '../../store/useStore';
import { computeLandslidePrediction } from '../../utils/formatters';
import { computeImpactSummary } from '../../utils/riskEstimator';

export default function PredictionCard() {
  const setShowPrediction = useStore((s) => s.setShowPrediction);
  const activeImpactSensor = useStore((s) => s.activeImpactSensor);
  const selectedState = useStore((s) => s.selectedState);
  const apiPrediction = useStore((s) => s.apiPrediction);
  const apiPredictionLoading = useStore((s) => s.apiPredictionLoading);
  const apiImpactZones = useStore((s) => s.apiImpactZones);

  const sensorName = activeImpactSensor?.name || 'Reni Village';
  const sensorState = activeImpactSensor?.state || (selectedState !== 'All States' ? selectedState : 'Uttarakhand');
  const rainfall = activeImpactSensor ? activeImpactSensor.rainfall : 107.6;
  const soil = activeImpactSensor ? activeImpactSensor.soilMoisture : 94.6;
  const tilt = activeImpactSensor ? activeImpactSensor.tilt : 8.07;

  // Use API prediction if available and matches the active sensor; otherwise fall back to local rule-based estimator
  const hasMatchingApiData = apiPrediction && apiPrediction.sensor_id === activeImpactSensor?.id;
  const localPrediction = computeLandslidePrediction(activeImpactSensor || { rainfall, soilMoisture: soil, tilt, alert: true });

  const probability = hasMatchingApiData ? apiPrediction.probability : localPrediction?.probability ?? 95;
  const riskLevel = hasMatchingApiData ? apiPrediction.risk_level : localPrediction?.riskLevel ?? 'CRITICAL';
  const isCritical = riskLevel === 'CRITICAL';
  const riskProb = `${probability}%`;
  const confidence = hasMatchingApiData ? apiPrediction.confidence : localPrediction?.confidence ?? 85;

  const modelName = hasMatchingApiData
    ? `${apiPrediction.model_name} ${apiPrediction.model_version ? `[v${apiPrediction.model_version}]` : ''}`
    : localPrediction?.modelName || 'Rule-based risk estimator (simulated telemetry)';

  const dynamicAssessment = hasMatchingApiData
    ? apiPrediction.dynamic_assessment
    : localPrediction?.dynamicAssessment;

  // Impact Area and Runout Distance
  const impactSummary = apiImpactZones?.summary;
  const localImpact = computeImpactSummary(activeImpactSensor);

  const impactKm2 = impactSummary?.total_impact_area_km2 != null
    ? `${impactSummary.total_impact_area_km2.toFixed(1)} km²`
    : localImpact?.areaKm2 != null
    ? `${localImpact.areaKm2.toFixed(1)} km²`
    : 'unavailable';

  const runoutDist = impactSummary?.runout_distance_m != null
    ? `${Math.round(impactSummary.runout_distance_m)} m`
    : 'unavailable';

  return (
    <div className="prediction-card" id="prediction-card">
      <button className="prediction-close" onClick={() => setShowPrediction(false)} title="Close card">×</button>

      <div className="prediction-card-title">
        <span className={'badge ' + (isCritical ? 'badge-high' : riskLevel === 'HIGH' ? 'badge-high' : 'badge-medium')}>
          {riskLevel}
        </span>
        <span style={{ fontWeight: 600 }}>{sensorName}</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, opacity: 0.7, fontFamily: 'monospace' }}>
          [{sensorState}]
        </span>
      </div>

      {apiPredictionLoading && (
        <div style={{ fontSize: 10, color: '#38bdf8', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="state-alert-dot" style={{ backgroundColor: '#38bdf8' }} />
          <span>Syncing with ML Inference Engine...</span>
        </div>
      )}

      {hasMatchingApiData && apiPrediction.is_fallback && (
        <div style={{ fontSize: 10, color: '#f59e0b', marginBottom: 6 }}>
          ⚠ Running in Rule-Based Fallback Mode (API offline)
        </div>
      )}

      <div className="prediction-stat">
        <span className="prediction-stat-label">Failure Probability</span>
        <span className="prediction-stat-value" style={{ color: isCritical ? '#ef4444' : riskLevel === 'HIGH' ? '#f97316' : '#22c55e', fontWeight: 700 }}>
          {riskProb}
        </span>
      </div>

      <div className="prediction-stat">
        <span className="prediction-stat-label">Trigger Rainfall</span>
        <span className="prediction-stat-value">{rainfall} mm/h</span>
      </div>

      <div className="prediction-stat">
        <span className="prediction-stat-label">Soil Pore Moisture</span>
        <span className="prediction-stat-value">{soil}%</span>
      </div>

      <div className="prediction-stat">
        <span className="prediction-stat-label">Ground Tilt Angle</span>
        <span className="prediction-stat-value">{tilt}°</span>
      </div>

      <div className="prediction-stat">
        <span className="prediction-stat-label">Est. Impact Area</span>
        <span className="prediction-stat-value">
          {impactKm2 !== 'unavailable' ? impactKm2 : <span style={{ opacity: 0.5 }}>unavailable</span>}
        </span>
      </div>

      <div className="prediction-stat">
        <span className="prediction-stat-label">Est. Runout Distance</span>
        <span className="prediction-stat-value">
          {runoutDist !== 'unavailable' ? runoutDist : <span style={{ opacity: 0.5 }}>unavailable</span>}
        </span>
      </div>

      <div className="prediction-stat">
        <span className="prediction-stat-label">Est. Affected Population</span>
        <span className="prediction-stat-value">
          <span style={{ opacity: 0.5 }}>unavailable</span>
        </span>
      </div>

      <div className="prediction-stat">
        <span className="prediction-stat-label">Operational Model</span>
        <span className="prediction-stat-value" style={{ fontSize: 10 }}>
          {modelName}
        </span>
      </div>

      <div className="prediction-stat">
        <span className="prediction-stat-label">Data Completeness</span>
        <span className="prediction-stat-value">{confidence}%</span>
      </div>

      <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.45 }}>
        {dynamicAssessment}
      </div>

      <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 6 }}>
        Simulated Telemetry from station {activeImpactSensor?.id || 'SNS-03'}.
        <span style={{ display: 'block', fontStyle: 'italic', opacity: 0.7, marginTop: 2 }}>
          Approximate hazard estimate - not a validated evacuation boundary.
        </span>
      </div>
    </div>
  );
}
