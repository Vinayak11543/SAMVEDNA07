import React, { useState, useEffect } from 'react';
import useStore from '../../store/useStore';

export default function DispatchedDetailView() {
  const drilldownArea = useStore((s) => s.rightPanelDrilldownArea);
  const setRightPanelDrilldownArea = useStore((s) => s.setRightPanelDrilldownArea);
  const recallArea = useStore((s) => s.recallArea);
  const setSelectedDispatchAreaId = useStore((s) => s.setSelectedDispatchAreaId);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const addToast = useStore((s) => s.addToast);
  // units

  const [timerSec, setTimerSec] = useState(2509); // ~41 mins

  useEffect(() => {
    const interval = setInterval(() => setTimerSec((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTimer = (totalSec) => {
    const hrs = String(Math.floor(totalSec / 3600)).padStart(2, '0');
    const mins = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
    const secs = String(totalSec % 60).padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  };

  if (!drilldownArea) return null;

  const handleModify = () => {
    setSelectedDispatchAreaId(drilldownArea.sensorId);
    setActiveTab('dispatch');
  };

  const handleRecall = () => {
    recallArea(drilldownArea.sensorId);
    addToast(`Recalled response forces from ${drilldownArea.name}`);
  };

  // Field units for this sector
  const activeSectorUnits = [
    { id: 'RSC-01', sector: 'Chamoli Sector', status: 'ON SITE' },
    { id: 'RSC-02', sector: 'Chamoli Sector', status: 'ON SITE' },
    { id: 'AMB-01', sector: 'Chamoli Sector', status: 'ON SITE' },
    { id: 'AMB-02', sector: 'Chamoli Sector', status: 'ON SITE' },
    { id: 'AIR-01', sector: 'Chamoli Sector', status: 'EN ROUTE' },
    { id: 'RSC-03', sector: 'Pipalkoti Sector', status: 'PENDING' },
  ];

  return (
    <div className="dispatched-detail-view" id="dispatched-detail-view">
      {/* Back button */}
      <button
        className="btn-back-overview"
        onClick={() => setRightPanelDrilldownArea(null)}
      >
        ‹ Back to All Areas Overview
      </button>

      {/* Main Header */}
      <div className="drilldown-header">
        <span className="drilldown-tag">[DISPATCHED]</span>
        <h3 className="drilldown-area-title">
          {drilldownArea.name} - {drilldownArea.place}
        </h3>
      </div>

      {/* Status Bar */}
      <div className="drilldown-status-bar">
        <div className="status-bar-left">
          <span className="pulse-dot-green" />
          <span className="status-active-label">4 DISPATCH ACTIVE - UNITS IN FIELD</span>
        </div>
        <span className="status-timer">{formatTimer(timerSec)}</span>
      </div>
      <div className="automation-sub">CONNECTED TO AI DISPATCH AUTOMATION</div>

      {/* Telemetry Strip */}
      <div className="drilldown-telemetry-strip">
        <div className="telemetry-strip-title">{drilldownArea.name}</div>
        <div className="telemetry-strip-values">
          <span>Rainfall: <strong>{drilldownArea.rainfall || 102.8} mm/h</strong></span>
          <span>Soil: <strong>{drilldownArea.soilMoisture || 98.3}%</strong></span>
          <span>Tilt: <strong>{drilldownArea.tilt || 11.84}°</strong></span>
        </div>
      </div>

      {/* Allocated Units Summary */}
      <div className="drilldown-allocation-box">
        <div className="allocation-header">
          <span>Units Allocated by AI:</span>
          <strong>128 Total Units</strong>
        </div>
        <ul className="allocation-list">
          <li>NDRF Search & Rescue Teams x2</li>
          <li>IAF Evacuation Helicopters x1</li>
          <li>Thermal Recon Drones x1</li>
        </ul>

        <div className="allocation-meta">
          <div>AI Dispatch Triggered: <span>{drilldownArea.dispatchedAt || '05:41:40 PM'}</span></div>
          <div>Field Status: <strong style={{ color: '#4ade80' }}>EN ROUTE</strong> - Estimated Arrival: ~20 mins</div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="drilldown-actions-row">
        <button className="btn-modify-disp" onClick={handleModify}>
          Modify in AI Dispatch
        </button>
        <button className="btn-recall-disp" onClick={handleRecall}>
          Recall
        </button>
      </div>

      {/* Active Units in the Field */}
      <div className="drilldown-units-section">
        <div className="units-section-title">
          ACTIVE UNITS IN THE FIELD ({activeSectorUnits.length})
        </div>

        <div className="units-list-body">
          {activeSectorUnits.map((unit) => (
            <div key={unit.id} className="sector-unit-card">
              <div className="unit-card-left">
                <span className="sector-unit-id">{unit.id}</span>
                <span className="sector-unit-sector">{unit.sector}</span>
              </div>
              <span className={`status-pill pill-${unit.status.toLowerCase().replace(/\s+/g, '')}`}>
                {unit.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

