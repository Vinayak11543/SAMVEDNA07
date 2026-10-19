import React, { useState, useMemo } from 'react';
import useStore from '../../store/useStore';
import { computeLandslidePrediction } from '../../utils/formatters';

function PredictionBadge({ sensor }) {
  const prediction = useMemo(() => computeLandslidePrediction(sensor), [sensor]);
  if (!prediction) {
    return (
      <div className="area-prediction-box prediction-unavailable">
        <span className="pred-label">AI PREDICTION</span>
        <span className="pred-value">UNAVAILABLE</span>
      </div>
    );
  }
  const riskClass =
    prediction.riskLevel === 'CRITICAL' ? 'risk-critical' :
    prediction.riskLevel === 'HIGH' ? 'risk-high' :
    prediction.riskLevel === 'MEDIUM' ? 'risk-medium' : 'risk-low';

  return (
    <div className={'area-prediction-box ' + riskClass}>
      <div className="pred-row">
        <span className="pred-label">AI LANDSLIDE PROB.</span>
        <span className="pred-prob">{prediction.probability}%</span>
      </div>
      <div className="pred-row">
        <span className="pred-label">RISK</span>
        <span className={'pred-risk-badge ' + riskClass}>{prediction.riskLevel}</span>
      </div>
    </div>
  );
}

export default function AreaDispatchOverview() {
  const [searchQuery, setSearchQuery] = useState('');
  const sensors = useStore((s) => s.sensors);
  const dispatchedAreas = useStore((s) => s.dispatchedAreas);
  const rightPanelFilter = useStore((s) => s.rightPanelFilter);
  const setRightPanelFilter = useStore((s) => s.setRightPanelFilter);
  const setRightPanelDrilldownArea = useStore((s) => s.setRightPanelDrilldownArea);
  const setSelectedDispatchAreaId = useStore((s) => s.setSelectedDispatchAreaId);
  const selectSensor = useStore((s) => s.selectSensor);
  const setActiveTab = useStore((s) => s.setActiveTab);

  const dispatchedSensorIds = Object.keys(dispatchedAreas);
  const dispatchedCount = dispatchedSensorIds.length;
  const noDispatchCount = Math.max(0, sensors.length - dispatchedCount);

  const dispatchedList = Object.values(dispatchedAreas);
  const noDispatchList = sensors.filter((s) => !dispatchedAreas[s.id]);

  const filteredDispatchedList = useMemo(() => {
    if (!searchQuery.trim()) return dispatchedList;
    const tokens = searchQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return dispatchedList.filter((item) => {
      const target = `${item.name || ''} ${item.place || ''} ${item.state || ''} ${item.id || ''} ${item.sensorId || ''}`.toLowerCase();
      return tokens.every((tok) => target.includes(tok));
    });
  }, [dispatchedList, searchQuery]);

  const filteredNoDispatchList = useMemo(() => {
    if (!searchQuery.trim()) return noDispatchList;
    const tokens = searchQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return noDispatchList.filter((item) => {
      const target = `${item.name || ''} ${item.place || ''} ${item.state || ''} ${item.id || ''} ${item.sensorId || ''}`.toLowerCase();
      return tokens.every((tok) => target.includes(tok));
    });
  }, [noDispatchList, searchQuery]);

  const totalFilteredCount = filteredDispatchedList.length + filteredNoDispatchList.length;

  const sensorLookup = useMemo(() => {
    const map = {};
    sensors.forEach((s) => { map[s.id] = s; });
    return map;
  }, [sensors]);

  const handleStartDispatch = (sensor) => {
    setSelectedDispatchAreaId(sensor.id);
    setActiveTab('dispatch');
  };

 const handleDrilldown = (disp) => {
  // Open the selected area's details
  setRightPanelDrilldownArea(disp);

  // Fly the map to this area's exact coordinates
  selectSensor({
    ...disp,
    lat: Number(disp.lat),
    lng: Number(disp.lng),
  });
};

  return (
    <div className="area-dispatch-overview">
      <div className="dispatch-overview-header">
        <div className="overview-title-row">
          <span className="overview-title">UNITS IN FIELD & AREA DISPATCH</span>
          <span className="overview-sub">CONNECTED TO AI DISPATCH AUTOMATION</span>
        </div>
        <div className="overview-badges-row">
          <span className="badge-disp-count">{dispatchedCount} DISPATCHED</span>
          <span className="badge-pend-count">18 PENDING</span>
        </div>
      </div>

      {/* Location / Area Search Bar */}
      <div className="dispatch-overview-search-bar">
        <div className="overview-search-wrapper">
          <svg className="overview-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="overview-search-input"
            placeholder="Search location or area (e.g. Chamoli, Munnar)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            id="units-location-search-input"
            autoComplete="off"
            spellCheck="false"
          />
          {searchQuery && (
            <button
              type="button"
              className="btn-clear-overview-search"
              onClick={() => setSearchQuery('')}
              title="Clear search"
              id="btn-clear-location-search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="zone-selector-bar">
        <span className="zone-bar-label">
          {searchQuery.trim() ? 'SEARCH FILTER ACTIVE' : 'SELECT AREA / MONITORING ZONE'}
        </span>
        <div className="zone-current-title">
          {searchQuery.trim()
            ? `Matching "${searchQuery}" (${totalFilteredCount} area${totalFilteredCount === 1 ? '' : 's'})`
            : 'All Areas (Full Network Overview)'}
        </div>
      </div>

      <div className="dispatch-filter-pills">
        <button
          className={'disp-filter-btn' + (rightPanelFilter === 'all' ? ' active' : '')}
          onClick={() => setRightPanelFilter('all')}
        >
          All ({searchQuery.trim() ? totalFilteredCount : sensors.length || 41})
        </button>
        <button
          className={'disp-filter-btn' + (rightPanelFilter === 'no-dispatch' ? ' active' : '')}
          onClick={() => setRightPanelFilter('no-dispatch')}
        >
          No Dispatch ({searchQuery.trim() ? filteredNoDispatchList.length : noDispatchCount})
        </button>
        <button
          className={'disp-filter-btn' + (rightPanelFilter === 'dispatched' ? ' active' : '')}
          onClick={() => setRightPanelFilter('dispatched')}
        >
          Dispatched ({searchQuery.trim() ? filteredDispatchedList.length : dispatchedCount})
        </button>
      </div>

      <div className="dispatch-areas-scroll-body">
        {totalFilteredCount === 0 && searchQuery.trim() ? (
          <div className="dispatch-search-empty">
            <span className="empty-search-icon">📍</span>
            <div className="empty-search-title">No matching locations</div>
            <div className="empty-search-desc">
              No monitoring zones match &ldquo;<strong>{searchQuery}</strong>&rdquo;.
            </div>
            <button
              type="button"
              className="btn-clear-search-pill"
              onClick={() => setSearchQuery('')}
              id="btn-reset-empty-search"
            >
              Clear Search
            </button>
          </div>
        ) : (
          <>
            {rightPanelFilter !== 'no-dispatch' && filteredDispatchedList.length > 0 && (
              <div className="dispatch-group-section">
                <div className="group-section-title dispatched-title">
                  <span className="group-dot dot-green" />
                  AREAS WITH UNITS DISPATCHED ({filteredDispatchedList.length})
                </div>

                {filteredDispatchedList.map((disp) => {
                  const liveSensor = sensorLookup[disp.sensorId] || disp;
                  return (
                    <div key={disp.sensorId} className="area-overview-card dispatched-card">
                      <div className="card-top-line">
                        <div>
                          <span className="area-overview-name">{disp.name}</span>
                          <span className="area-overview-place">{disp.place || 'Uttarakhand'}</span>
                        </div>
                        <span className="badge-disp-status">DISPATCHED</span>
                      </div>

                      <div className="card-mid-line">
                        <span className="units-enroute-text">4 units on route</span>
                        <span className="rainfall-reading">Rain: {disp.rainfall || 102.8} mm/h</span>
                      </div>

                      <PredictionBadge sensor={liveSensor} />

                      <button
                        className="btn-view-dispatched"
                        onClick={() => handleDrilldown(disp)}
                        id={'view-disp-' + disp.sensorId}
                      >
                        View Dispatched &gt;
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {rightPanelFilter === 'dispatched' && filteredDispatchedList.length === 0 && totalFilteredCount > 0 && (
              <div className="dispatch-filter-empty-hint">
                <span>No dispatched units match &ldquo;{searchQuery}&rdquo;.</span>
                <button type="button" className="btn-hint-link" onClick={() => setRightPanelFilter('all')}>
                  View all matches ({totalFilteredCount})
                </button>
              </div>
            )}

            {rightPanelFilter !== 'dispatched' && filteredNoDispatchList.length > 0 && (
              <div className="dispatch-group-section">
                <div className="group-section-title no-dispatch-title">
                  <span className="group-dot dot-red" />
                  AREAS WITH NO DISPATCH SENT ({filteredNoDispatchList.length})
                </div>

                {filteredNoDispatchList.map((sensor) => (
                  <div key={sensor.id} className="area-overview-card nodisp-card">
                    <div className="card-top-line">
                      <div>
                        <span className="area-overview-name">{sensor.name}</span>
                        <span className="area-overview-place">{sensor.place || 'Uttarakhand'}</span>
                      </div>
                      <span className="badge-nodisp-status">NO DISPATCH</span>
                    </div>

                    <div className="card-mid-line">
                      <span className="rainfall-rate">Rain: {sensor.rainfall} mm/h</span>
                      <span className="moisture-rate">Soil: {sensor.soilMoisture}%</span>
                    </div>

                    <PredictionBadge sensor={sensor} />

                    <button
                      className="btn-add-dispatch"
                      onClick={() => handleStartDispatch(sensor)}
                      id={'add-disp-' + sensor.id}
                    >
                      + Dispatch Units
                    </button>
                  </div>
                ))}
              </div>
            )}

            {rightPanelFilter === 'no-dispatch' && filteredNoDispatchList.length === 0 && totalFilteredCount > 0 && (
              <div className="dispatch-filter-empty-hint">
                <span>No pending areas match &ldquo;{searchQuery}&rdquo;.</span>
                <button type="button" className="btn-hint-link" onClick={() => setRightPanelFilter('all')}>
                  View all matches ({totalFilteredCount})
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
