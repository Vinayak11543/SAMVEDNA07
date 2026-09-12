import React, { useMemo } from 'react';
import useStore from '../../store/useStore';

const STATE_CENTERS = {
  'Uttarakhand': { lng: 79.32, lat: 30.40, height: 45000 },
  'Himachal Pradesh': { lng: 77.17, lat: 31.85, height: 75000 },
  'Sikkim': { lng: 88.55, lat: 27.40, height: 60000 },
  'Assam': { lng: 92.80, lat: 26.20, height: 120000 },
  'Meghalaya': { lng: 91.50, lat: 25.50, height: 80000 },
  'Arunachal Pradesh': { lng: 93.60, lat: 27.50, height: 150000 },
  'Nagaland': { lng: 94.20, lat: 25.90, height: 70000 },
  'Mizoram': { lng: 92.75, lat: 23.50, height: 80000 },
};

export default function SensorDashboard() {
  const sensors = useStore((s) => s.sensors);
  const alerts = useStore((s) => s.alerts);
  const selectedSensor = useStore((s) => s.selectedSensor);
  const selectSensor = useStore((s) => s.selectSensor);
  const selectedState = useStore((s) => s.selectedState);
  const setSelectedState = useStore((s) => s.setSelectedState);
  const sensorPanelExpanded = useStore((s) => s.sensorPanelExpanded);
  const toggleSensorPanel = useStore((s) => s.toggleSensorPanel);

  const hasLandslideAlert = sensors.some((s) => s.alert) || alerts.length > 0;

  // Extract unique states from sensor data
  const availableStates = useMemo(() => {
    const rawStates = sensors.map((s) => s.state || 'Uttarakhand').filter(Boolean);
    const unique = Array.from(new Set(rawStates));
    return ['All States', ...unique];
  }, [sensors]);

  // Compute counts & alert status per state
  const stateStats = useMemo(() => {
    const stats = {
      'All States': {
        count: sensors.length,
        hasAlert: sensors.some((s) => s.alert),
      },
    };

    sensors.forEach((s) => {
      const state = s.state || 'Uttarakhand';
      if (!stats[state]) {
        stats[state] = { count: 0, hasAlert: false };
      }
      stats[state].count += 1;
      if (s.alert) {
        stats[state].hasAlert = true;
      }
    });

    return stats;
  }, [sensors]);

  // Filter sensors by selected state
  const filteredSensors = useMemo(() => {
    if (selectedState === 'All States') {
      return sensors;
    }
    return sensors.filter((s) => (s.state || 'Uttarakhand') === selectedState);
  }, [sensors, selectedState]);

  const handleStateClick = (state) => {
    setSelectedState(state);
    if (state !== 'All States' && STATE_CENTERS[state]) {
      const center = STATE_CENTERS[state];
      selectSensor({
        id: `state-center-${state}`,
        name: `${state} Regional Center`,
        lat: center.lat,
        lng: center.lng,
      });
    }
  };

  return (
    <div className={`sensor-dashboard ${sensorPanelExpanded ? 'expanded' : ''} ${hasLandslideAlert ? 'alert-active' : ''}`}>
      {/* Section 1: Sensor Readings and State Bar */}
      <div className="sensor-readings-section">
        {/* Panel Header */}
        <div className="sensor-dashboard-header">
          <div className="dashboard-section-title">
            <span>📡 LIVE SENSOR TELEMETRY & PLACES</span>
            <span className="sensor-count-badge">
              {filteredSensors.length} / {sensors.length} Stations Active
            </span>
          </div>

          <div className="sensor-header-actions">
            {/* Expand / Collapse Button */}
            <button
              className={`sensor-expand-toggle-btn ${sensorPanelExpanded ? 'active' : ''}`}
              onClick={toggleSensorPanel}
              title={sensorPanelExpanded ? 'Collapse panel to compact view' : 'Expand panel to view all sensors'}
              id="expand-sensor-panel-btn"
            >
              {sensorPanelExpanded ? (
                <>
                  <span className="expand-icon">⤡</span>
                  <span>Collapse Panel</span>
                </>
              ) : (
                <>
                  <span className="expand-icon">⤢</span>
                  <span>Expand Panel</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* State Selection Bar */}
        <div className="state-selection-bar" id="state-selection-bar">
          <span className="state-bar-label">FILTER BY STATE:</span>
          <div className="state-pills-container">
            {availableStates.map((state) => {
              const isSelected = selectedState === state;
              const stats = stateStats[state] || { count: 0, hasAlert: false };
              return (
                <button
                  key={state}
                  className={`state-pill ${isSelected ? 'selected' : ''} ${stats.hasAlert ? 'has-alert' : ''}`}
                  onClick={() => handleStateClick(state)}
                  id={`state-filter-${state.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {stats.hasAlert && <span className="state-alert-dot" />}
                  <span className="state-pill-name">{state}</span>
                  <span className="state-pill-count">{stats.count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sensors Grid */}
        <div className={`sensor-readings-grid ${sensorPanelExpanded ? 'expanded-grid' : ''}`}>
          {filteredSensors.length === 0 && (
            <div className="sensor-no-data">
              No monitoring stations found for {selectedState}.
            </div>
          )}
          {filteredSensors.map((sensor) => {
            const isSelected = selectedSensor?.id === sensor.id;
            return (
              <div
                key={sensor.id}
                className={`sensor-reading-card ${sensor.alert ? 'sensor-alert' : ''} ${isSelected ? 'sensor-card-selected' : ''}`}
                onClick={() => selectSensor(sensor)}
                title={`Click to focus map on ${sensor.name} (${sensor.lat.toFixed(3)}°N, ${sensor.lng.toFixed(3)}°E)`}
              >
                <div className="sensor-card-top">
                  <div className="sensor-reading-name">
                    {sensor.alert && <span className="sensor-alert-dot" />}
                    <span className="sensor-name-text">{sensor.name}</span>
                  </div>
                  {sensor.state && (
                    <span className="sensor-state-tag" title={sensor.state}>
                      {sensor.state}
                    </span>
                  )}
                </div>

                {sensorPanelExpanded && (
                  <div className="sensor-card-meta">
                    <span className="sensor-id-tag">{sensor.id}</span>
                    <span className="sensor-coords">
                      📍 {sensor.lat.toFixed(3)}°N, {sensor.lng.toFixed(3)}°E
                    </span>
                    <span className={`sensor-status-badge ${sensor.alert ? 'critical' : sensor.rainfall > 110 ? 'warning' : 'normal'}`}>
                      {sensor.alert ? 'CRITICAL RISK' : sensor.rainfall > 110 ? 'HIGH RISK' : 'NORMAL'}
                    </span>
                  </div>
                )}

                <div className="sensor-reading-values">
                  <div className="sensor-value">
                    <span className="sensor-value-label">🌧 Rainfall</span>
                    <span className={`sensor-value-num ${sensor.rainfall > 50 ? 'danger' : sensor.rainfall > 30 ? 'warning' : ''}`}>
                      {sensor.rainfall} <small>mm/h</small>
                    </span>
                  </div>
                  <div className="sensor-value">
                    <span className="sensor-value-label">💧 Moisture</span>
                    <span className={`sensor-value-num ${sensor.soilMoisture > 80 ? 'danger' : sensor.soilMoisture > 60 ? 'warning' : ''}`}>
                      {sensor.soilMoisture}<small>%</small>
                    </span>
                  </div>
                  <div className="sensor-value">
                    <span className="sensor-value-label">📐 Tilt</span>
                    <span className={`sensor-value-num ${sensor.tilt > 5 ? 'danger' : sensor.tilt > 3 ? 'warning' : ''}`}>
                      {sensor.tilt}<small>°</small>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2: Alert Status Button */}
      <div className="alert-button-section">
        <button
          className={`alert-mega-btn ${hasLandslideAlert ? 'alert-triggered' : ''}`}
          disabled={!hasLandslideAlert}
        >
          <span className="alert-btn-icon">⚠</span>
          <span className="alert-btn-text">
            {hasLandslideAlert ? 'LANDSLIDE ALERT' : 'SYSTEM NORMAL'}
          </span>
          {hasLandslideAlert ? (
            <span className="alert-btn-sub">
              {sensors.filter((s) => s.alert).length} sensor(s) triggered
            </span>
          ) : (
            <span className="alert-btn-sub">All stations reporting normal</span>
          )}
        </button>
      </div>
    </div>
  );
}

