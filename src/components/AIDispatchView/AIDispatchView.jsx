import React, { useState, useMemo } from 'react';
import useStore from '../../store/useStore';
import { computeLandslidePrediction } from '../../utils/formatters';

const INITIAL_RESOURCES = [
  {
    id: 'ndrf',
    name: 'NDRF Search & Rescue Teams',
    qty: 2,
    code: 'RSC',
    description: 'Steep terrain in sector requires specialized slope rescue and evacuation personnel'
  },
  {
    id: 'als',
    name: 'ALS Medical Units (Ambulance)',
    qty: 2,
    code: 'MED',
    description: 'Paramedic triage staging for early warning casualty prevention'
  },
  {
    id: 'iaf',
    name: 'IAF Evacuation Helicopters',
    qty: 1,
    code: 'AIR',
    description: 'Standby aerial extraction in case road access is completely cut off'
  },
  {
    id: 'heavy',
    name: 'Heavy Earthmovers & Excavators',
    qty: 2,
    code: 'ENG',
    description: 'Clearing debris accumulation and securing access arterial'
  },
  {
    id: 'drone',
    name: 'Thermal Recon Drones',
    qty: 1,
    code: 'UAV',
    description: 'High-resolution slope-creep surveillance and hazard mapping'
  },
  {
    id: 'relief',
    name: 'Emergency Relief Supply Packs',
    qty: 120,
    code: 'LOG',
    description: 'First-responder rations, thermal blankets, emergency lighting'
  }
];

export default function AIDispatchView({ socketRef }) {
  const sensors = useStore((s) => s.sensors);
  const persons = useStore((s) => s.persons);
  const dispatchedAreas = useStore((s) => s.dispatchedAreas);
  const dispatchArea = useStore((s) => s.dispatchArea);
  const addToast = useStore((s) => s.addToast);
  const selectedDispatchAreaId = useStore((s) => s.selectedDispatchAreaId);
  const setSelectedDispatchAreaId = useStore((s) => s.setSelectedDispatchAreaId);
  const selectSensor = useStore((s) => s.selectSensor);

  const [searchArea, setSearchArea] = useState('');
  const [resources, setResources] = useState(INITIAL_RESOURCES);
  const [dispatchedBanner, setDispatchedBanner] = useState(null);

  // Selected sensor
  const currentArea = useMemo(() => {
    return (
      sensors.find((s) => s.id === selectedDispatchAreaId) ||
      sensors.find((s) => s.id === 'SNS-02') ||
      sensors[0] || {
        id: 'SNS-02',
        name: 'Chamoli Ridge B',
        place: 'Chamoli',
        state: 'Uttarakhand',
        lat: 30.41,
        lng: 79.52,
        rainfall: 102.8,
        soilMoisture: 98.3,
        tilt: 12.73,
        alert: true
      }
    );
  }, [sensors, selectedDispatchAreaId]);

  // Real-time prediction for the selected monitoring area
  const currentPrediction = useMemo(() => {
    return computeLandslidePrediction(currentArea);
  }, [currentArea]);

  // FIX Problem 3: Compute active warning zones dynamically from sensors
  const activeWarningCount = useMemo(() => {
    return sensors.filter((s) => s.alert).length;
  }, [sensors]);

  // Filtered areas for left column
  const filteredAreas = useMemo(() => {
    if (!searchArea.trim()) return sensors;
    const q = searchArea.toLowerCase();
    return sensors.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) ||
        s.place?.toLowerCase().includes(q) ||
        s.state?.toLowerCase().includes(q)
    );
  }, [sensors, searchArea]);

  // AI Operational Intelligence calculations
  const operationalIntelligence = useMemo(() => {
    const ranked = [...sensors]
      .map((s) => ({
        ...s,
        pred: computeLandslidePrediction(s)
      }))
      .sort((a, b) => (b.pred?.probability || 0) - (a.pred?.probability || 0));

    const highestRisk = ranked.slice(0, 3);
    const inspectionAreas = sensors
      .filter((s) => Number(s.tilt || 0) > 3.8 || (Number(s.soilMoisture || 0) > 85 && Number(s.rainfall || 0) > 130))
      .slice(0, 3);

    return {
      highestRisk,
      inspectionAreas,
      topArea: ranked[0]
    };
  }, [sensors]);

  // Priority residents for center column
  const priorityEvacuees = useMemo(() => {
    return persons.slice(0, 4);
  }, [persons]);

  // Calculations
  const totalUnits = useMemo(() => {
    return resources.reduce((acc, r) => acc + r.qty, 0);
  }, [resources]);

  const updateQty = (id, delta) => {
    setResources((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const min = r.id === 'relief' ? 10 : 0;
          const step = r.id === 'relief' ? 10 : 1;
          const newQty = Math.max(min, r.qty + delta * step);
          return { ...r, qty: newQty };
        }
        return r;
      })
    );
  };

  const handleDispatch = () => {
    const areaName = currentArea.name || 'Chamoli Ridge B';
    const place = currentArea.place || 'Chamoli';

    dispatchArea(currentArea, totalUnits, resources);

    if (socketRef?.current) {
      socketRef.current.emit('dispatch:area', {
        areaId: currentArea.id,
        areaName,
        place,
        unitsCount: totalUnits
      });
    }

    const bannerMsg = `Dispatched ${totalUnits} units to ${areaName} / ${place}`;
    setDispatchedBanner(bannerMsg);
    addToast(bannerMsg);

    setTimeout(() => {
      setDispatchedBanner(null);
    }, 6000);
  };

  const isAlreadyDispatched = Boolean(dispatchedAreas[currentArea.id]);

  return (
    <div className="ai-dispatch-page" id="ai-dispatch-page">
      {/* Top Banner if dispatched */}
      {dispatchedBanner && (
        <div className="dispatch-success-banner" id="dispatch-success-banner">
          <div className="banner-left">
            <span className="banner-icon">✓</span>
            <div>
              <strong>UNITS DISPATCHED TO {currentArea.name?.toUpperCase()}</strong>
              <div style={{ fontSize: 12, opacity: 0.9 }}>{dispatchedBanner}</div>
            </div>
          </div>
          <button className="banner-close" onClick={() => setDispatchedBanner(null)}>✕</button>
        </div>
      )}

      {/* Main Top Header */}
      <div className="dispatch-main-header">
        <div className="dispatch-header-title-wrap">
          <div className="dispatch-title-row">
            <h1 className="dispatch-main-title">AI Automated Dispatch Center</h1>
          </div>
          <p className="dispatch-main-desc">
            Three operational control areas: select area, analyze live situation & calibrate AI dispatch units.
          </p>
        </div>

        <div className="dispatch-header-stats">
          <div className="header-stat-chip">
            <span className="stat-label">Monitored Areas:</span>
            <strong className="stat-val">{sensors.length || 41}</strong>
          </div>
          <div className="header-stat-chip warning-chip">
            <span className="stat-label">Active Warning Zones:</span>
            {/* FIX Problem 3: Dynamic count from live sensor alert states */}
            <strong className="stat-val">{activeWarningCount}</strong>
          </div>
        </div>
      </div>

      {/* 3-Column Layout */}
      <div className="dispatch-grid-container">
        {/* COLUMN 1: CHOOSE MONITORING AREA */}
        <div className="dispatch-col col-choose-area">
          <div className="col-header">
            <span className="col-step">01. OPERATIONAL SECTOR</span>
            <h3 className="col-title">Choose Monitoring Area</h3>
          </div>

          <div className="col-search-box">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search area or name..."
              value={searchArea}
              onChange={(e) => setSearchArea(e.target.value)}
            />
          </div>

          <div className="area-cards-list">
            {filteredAreas.map((area) => {
              const isSelected = area.id === currentArea.id;
              const isDisp = Boolean(dispatchedAreas[area.id]);
              const areaPred = computeLandslidePrediction(area);
              const isCritical = areaPred?.isCritical ?? (area.alert || area.rainfall > 120);
              const riskLevel = areaPred?.riskLevel || (isCritical ? 'CRITICAL' : 'NORMAL');

              return (
                <div
                  key={area.id}
                  className={`dispatch-area-card ${isSelected ? 'selected' : ''} ${isCritical ? 'critical' : ''}`}
                  onClick={() => {
                    setSelectedDispatchAreaId(area.id);
                    selectSensor(area);
                  }}
                  id={`area-select-${area.id}`}
                >
                  <div className="area-card-top">
                    <span className="area-card-name">{area.name}</span>
                    <span className={`area-status-pill ${isDisp ? 'disp' : isCritical ? 'crit' : 'norm'}`}>
                      {isDisp ? 'DISPATCHED' : isCritical ? 'CRITICAL' : riskLevel === 'HIGH' ? 'HIGH' : 'NORMAL'}
                    </span>
                  </div>

                  <div className="area-card-sub">
                    {area.place || 'Sector'}, {area.state || 'Uttarakhand'}
                  </div>

                  <div className="area-card-metrics">
                    <span>Rain: {area.rainfall} mm/h</span>
                    <span>Soil: {area.soilMoisture}%</span>
                    <span>Tilt: {area.tilt}°</span>
                    {areaPred && (
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: '11px',
                          color: isCritical
                            ? '#ef4444'
                            : riskLevel === 'HIGH'
                            ? '#f97316'
                            : riskLevel === 'MEDIUM'
                            ? '#eab308'
                            : '#22c55e'
                        }}
                      >
                        Risk: {areaPred.probability}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* COLUMN 2: AI ENGINE INTELLIGENCE */}
        <div className="dispatch-col col-hazard-intel">
          <div className="col-header">
            <span className="col-step">02. ENGINE INTELLIGENCE</span>
            <div className="intel-title-row">
              <h3 className="col-title">{currentArea.name}</h3>
              <span className="coord-text">
                Lat: {currentArea.lat ? currentArea.lat.toFixed(2) : '30.41'}°N, Long: {currentArea.lng ? currentArea.lng.toFixed(2) : '79.52'}°E
              </span>
              <span className={`threat-badge ${currentPrediction?.threatClass || 'threat-critical'}`}>
                {currentPrediction?.threatLabel || 'CRITICAL THREAT'}
              </span>
            </div>
          </div>

          {/* 4 Big Metric Cards */}
          <div className="intel-metrics-grid">
            <div className="intel-metric-box">
              <div className="metric-box-label">TRIGGER RAINFALL</div>
              <div className="metric-box-val val-rainfall">
                {currentArea.rainfall !== undefined ? currentArea.rainfall : 102.8} <small>mm/h</small>
              </div>
            </div>

            <div className="intel-metric-box">
              <div className="metric-box-label">SOIL PORE MOISTURE</div>
              <div className="metric-box-val val-moisture">
                {currentArea.soilMoisture !== undefined ? currentArea.soilMoisture : 98.3} <small>%</small>
              </div>
            </div>

            <div className="intel-metric-box">
              <div className="metric-box-label">SLOPE INCLINOMETER TILT</div>
              <div className="metric-box-val val-tilt">
                {currentArea.tilt !== undefined ? currentArea.tilt : 12.73} <small>°</small>
              </div>
            </div>

            <div className="intel-metric-box">
              <div className="metric-box-label">LANDSLIDE PROBABILITY</div>
              <div
                className="metric-box-val val-prob"
                style={{
                  color: currentPrediction?.isCritical
                    ? '#ef4444'
                    : currentPrediction?.riskLevel === 'HIGH'
                    ? '#f97316'
                    : currentPrediction?.riskLevel === 'MEDIUM'
                    ? '#eab308'
                    : '#22c55e'
                }}
              >
                {currentPrediction ? `${currentPrediction.probability}%` : '94%'}
              </div>
              <div className="metric-sub-note">
                Data completeness: {currentPrediction?.confidence || 0}% | {currentPrediction?.modelName || 'Rule-based risk estimator (simulated telemetry)'}
              </div>
            </div>
          </div>

          {/* Dynamic Threat Assessment */}
          <div className="intel-section-block">
            <div className="block-title">
              DYNAMIC THREAT ASSESSMENT
            </div>
            <p className="block-content">
              {currentPrediction?.dynamicAssessment || (
                `Simulated telemetry: rainfall ${currentArea.rainfall || 102.8} mm/h, soil moisture ${currentArea.soilMoisture || 98.3}%, ground tilt ${currentArea.tilt || 12.73}°.`
              )}
            </p>
          </div>

          {/* Ground Access & Infrastructure */}
          <div className="intel-section-block">
            <div className="block-title">
              GROUND ACCESS & INFRASTRUCTURE STATUS
            </div>
            <div className="access-info-grid">
              <div>
                <span className="access-label">ARTERIAL ROAD ACCESS</span>
                <p className="access-val">
                  Access route to {currentArea.place || 'Chamoli'} experiencing debris slides and mud movement.
                </p>
              </div>
              <div>
                <span className="access-label">ACCESS PASSABILITY</span>
                <span className="access-chip passability-chip">
                  Emergency response vehicles only. Caution: active slope movement.
                </span>
              </div>
            </div>
          </div>

          {/* Primary Communications Grid */}
          <div className="intel-section-block">
            <div className="block-title">
              PRIMARY COMMUNICATIONS GRID
            </div>
            <p className="block-content">
              Local authorities on high alert. Backup communication repeaters engaged.
            </p>
          </div>

          {/* Citizens in Impact Zone */}
          <div className="intel-section-block">
            <div className="citizens-zone-header">
              <div className="block-title">
                CITIZENS IN IMPACT ZONE
              </div>
              {/* FIX Problem 3: Population is unavailable — no longer hardcoded 450 */}
              <span className="pop-est">Est. Population: <span style={{ opacity: 0.5, fontStyle: 'italic' }}>unavailable</span></span>
            </div>

            <div className="priority-evacuees-sub">
              <strong>High-Priority Evacuees:</strong> Priority residents identified for immediate priority relocation
            </div>

            <div className="evacuees-pills-grid">
              {priorityEvacuees.map((p) => (
                <div key={p.id} className="evacuee-pill">
                  <span className="evacuee-dot" />
                  <div className="evacuee-info">
                    <span className="evacuee-name">{p.name}</span>
                    <span className="evacuee-phone">{p.phone}</span>
                  </div>
                  <span className="evacuee-role">{p.profession}</span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Operational Intelligence Section */}
          <div className="intel-section-block" style={{ border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: 6, padding: '10px 12px', background: 'rgba(15, 23, 42, 0.45)', marginTop: 10 }}>
            <div className="block-title" style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>🧠 AI OPERATIONAL INTELLIGENCE</span>
              <span style={{ fontSize: 9, opacity: 0.7, marginLeft: 'auto', letterSpacing: '0.05em' }}>ADVISORY ONLY</span>
            </div>

            {/* 1. Highest-Risk Sectors */}
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, marginBottom: 4 }}>
                HIGHEST-RISK SECTORS (ML RANKED):
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {operationalIntelligence.highestRisk.map((s, idx) => (
                  <div
                    key={s.id}
                    onClick={() => { setSelectedDispatchAreaId(s.id); selectSensor(s); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '4px 8px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      borderRadius: 4,
                      fontSize: 11,
                      cursor: 'pointer'
                    }}
                  >
                    <span><strong>#{idx + 1} {s.name}</strong> <small style={{ opacity: 0.6 }}>({s.state})</small></span>
                    <span style={{ color: '#ef4444', fontWeight: 700 }}>{s.pred?.probability || 90}% Risk</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Areas Needing Immediate Inspection */}
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, marginBottom: 4 }}>
                AREAS NEEDING IMMEDIATE INSPECTION:
              </div>
              <div style={{ fontSize: 11, color: '#e2e8f0', lineHeight: 1.4 }}>
                {operationalIntelligence.inspectionAreas.map((s) => (
                  <div key={s.id} style={{ marginBottom: 4 }}>
                    • <strong style={{ color: '#f59e0b' }}>{s.name}:</strong> Slope creep at {s.tilt}° & rain {s.rainfall} mm/h.
                    <span style={{ opacity: 0.7, display: 'block', fontSize: 10, marginLeft: 10 }}>
                      Action: Dispatch thermal UAV drone for tension crack reconnaissance.
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Response Priorities */}
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, marginBottom: 4 }}>
                RESPONSE TRIAGE PRIORITIES:
              </div>
              <div style={{ fontSize: 10, display: 'grid', gridTemplateColumns: '1fr', gap: 4 }}>
                <div style={{ padding: '4px 6px', background: 'rgba(239, 68, 68, 0.1)', borderLeft: '3px solid #ef4444' }}>
                  <strong>PRIORITY 1 (Life Safety):</strong> Immediate alert dissemination to downslope hamlets in {operationalIntelligence.topArea?.name || 'Chamoli Ridge'}.
                </div>
                <div style={{ padding: '4px 6px', background: 'rgba(245, 158, 11, 0.1)', borderLeft: '3px solid #f59e0b' }}>
                  <strong>PRIORITY 2 (Infrastructure):</strong> Pre-position heavy earthmovers at primary valley access road.
                </div>
                <div style={{ padding: '4px 6px', background: 'rgba(34, 197, 94, 0.1)', borderLeft: '3px solid #22c55e' }}>
                  <strong>PRIORITY 3 (Monitoring):</strong> Maintain automated radar & telemetry polling across peripheral stations.
                </div>
              </div>
            </div>

            {/* 4. Confidence & Uncertainty */}
            <div style={{ marginTop: 10, fontSize: 10, color: '#94a3b8', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6 }}>
              <div><strong>Confidence & Uncertainty:</strong> Mean telemetry completeness 95% | DEM terrain horizontal uncertainty ±50m.</div>
              <div style={{ marginTop: 4, fontStyle: 'italic', color: '#fca5a5' }}>
                ⚠ Operational Notice: Recommendations only. Operational commanders must verify field conditions. Never auto-dispatch or claim an evacuation corridor is safe without reconnaissance.
              </div>
            </div>
          </div>
        </div>

        {/* COLUMN 3: AI RESPONSE FORCES */}
        <div className="dispatch-col col-response-forces">
          <div className="col-header">
            <span className="col-step">03. RESPONSE FORCES</span>
            <div className="forces-title-row">
              <h3 className="col-title">AI Prepared Dispatch Unit</h3>
              <span className="depot-badge">Validated AI Response Depot</span>
            </div>
            <div className="target-sector-tag">
              Target: <strong>{currentArea.name}</strong>
            </div>
          </div>

          <div className="calibrate-bar">
            <span className="calibrate-text">EDITING MODE: Calibrate quantities</span>
            <button className="recalc-btn" onClick={() => setResources(INITIAL_RESOURCES)}>
              Reset
            </button>
          </div>

          {/* Resource allocation list */}
          <div className="resources-list">
            {resources.map((res) => (
              <div key={res.id} className="resource-item-row" id={`resource-row-${res.id}`}>
                <div className="resource-left">
                  <div className="resource-title-wrap">
                    <span className="resource-name">{res.name}</span>
                  </div>
                  <p className="resource-desc">{res.description}</p>
                </div>

                <div className="resource-controls">
                  <button
                    className="qty-btn"
                    onClick={() => updateQty(res.id, -1)}
                    disabled={res.qty <= 0}
                  >
                    -
                  </button>
                  <span className="qty-value">{res.qty}</span>
                  <button
                    className="qty-btn"
                    onClick={() => updateQty(res.id, 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Action buttons footer */}
          <div className="dispatch-action-footer">
            <button
              className="btn-edit-resources"
              onClick={() => addToast('Resource profile calibrated')}
            >
              Apply Modification
            </button>

            <button
              className={`btn-primary-dispatch ${isAlreadyDispatched ? 'dispatched-active' : ''}`}
              onClick={handleDispatch}
              id="dispatch-confirm-btn"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
              <span>
                {isAlreadyDispatched
                  ? `UPDATE DISPATCH (${totalUnits} UNITS)`
                  : `DISPATCH ${totalUnits} UNITS TO ${(currentArea.place || 'CHAMOLI').toUpperCase()}`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
