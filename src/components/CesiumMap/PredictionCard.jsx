import React from 'react';
import useStore from '../../store/useStore';
import { computeLandslidePrediction } from '../../utils/formatters';

export default function PredictionCard() {
  const setShowPrediction = useStore((s) => s.setShowPrediction);
  const activeImpactSensor = useStore((s) => s.activeImpactSensor);
  const selectedState = useStore((s) => s.selectedState);

  const sensorName = activeImpactSensor?.name || 'Reni Village';
  const sensorState = activeImpactSensor?.state || (selectedState !== 'All States' ? selectedState : 'Uttarakhand');
  const rainfall = activeImpactSensor ? activeImpactSensor.rainfall : 107.6;
  const soil = activeImpactSensor ? activeImpactSensor.soilMoisture : 94.6;
  const tilt = activeImpactSensor ? activeImpactSensor.tilt : 8.07;

  const prediction = computeLandslidePrediction(activeImpactSensor || { rainfall, soilMoisture: soil, tilt, alert: true });
  const isCritical = prediction?.isCritical ?? true;
  const riskProb = prediction ? prediction.probability + '%' : '95%';

  const impactKm2 = '14.0';
  const affectedPop = '315';

  return (
    <div className="prediction-card" id="prediction-card">
      <button className="prediction-close" onClick={() => setShowPrediction(false)}>×</button>
      <div className="prediction-card-title">
        <span className={'badge ' + (isCritical ? 'badge-high' : 'badge-medium')}>
          {isCritical ? 'CRITICAL' : 'ELEVATED'}
        </span>
        <span>{sensorName}</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, opacity: 0.7, fontFamily: 'monospace' }}>
          [{sensorState}]
        </span>
      </div>

      <div className="prediction-stat">
        <span className="prediction-stat-label">Risk Probability</span>
        <span className="prediction-stat-value" style={{ color: isCritical ? '#ef4444' : '#f59e0b' }}>
          {riskProb}
        </span>
      </div>
      <div className="prediction-stat">
        <span className="prediction-stat-label">Trigger Rainfall</span>
        <span className="prediction-stat-value">{rainfall} mm/hr</span>
      </div>
      <div className="prediction-stat">
        <span className="prediction-stat-label">Soil Moisture</span>
        <span className="prediction-stat-value">{soil}%</span>
      </div>
      <div className="prediction-stat">
        <span className="prediction-stat-label">Ground Tilt</span>
        <span className="prediction-stat-value">{tilt}°</span>
      </div>
      <div className="prediction-stat">
        <span className="prediction-stat-label">Est. Impact Area</span>
        <span className="prediction-stat-value">{impactKm2} km²</span>
      </div>
      <div className="prediction-stat">
        <span className="prediction-stat-label">Est. Affected Population</span>
        <span className="prediction-stat-value">~{affectedPop} persons</span>
      </div>
      <div className="prediction-stat">
        <span className="prediction-stat-label">Operational Model</span>
        <span className="prediction-stat-value">CrisisCore XGBoost [NER]</span>
      </div>

      <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
        Real-time telemetry from station {activeImpactSensor?.id || 'SNS-03'} in {sensorState}.
        Threshold warning active for terrain slope instability and debris runoff.
      </div>
    </div>
  );
}