import React from 'react';
import useStore from '../../store/useStore';
import { timeAgo, getSeverityClass } from '../../utils/formatters';

export default function ActiveAlerts() {
  const alerts = useStore((s) => s.alerts);
  const selectAlert = useStore((s) => s.selectAlert);

  return (
    <>
      <div className="panel-section-header">
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800 }}>
          <span className="dot-red" style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
          ACTIVE ALERTS
        </span>
        <span className="count">{alerts.length}</span>
      </div>

      <div className="panel-section-body" style={{ flex: 1, overflowY: 'auto' }}>
        {alerts.length === 0 && (
          <div style={{ padding: 16, color: 'var(--text-tertiary)', fontSize: 12, textAlign: 'center' }}>
            No active alerts
          </div>
        )}
        {alerts.map((alert, index) => {
          const alertNum = alert.alertNumber || (240 - index);
          const isCritical = alert.severity === 'CRITICAL';

          return (
            <div
              key={alert.id || index}
              className={`card ${isCritical ? 'alert-card-critical' : 'alert-card-high'}`}
              id={`alert-${alert.id}`}
              onClick={() => selectAlert(alert)}
            >
              <div className="card-top-row">
                <span className="alert-badge-num">ALERT #{alertNum}</span>
                <span className="alert-id-title">Landslide {alert.id}</span>
                <span className={`badge ${getSeverityClass(alert.severity)}`} style={{ marginLeft: 'auto' }}>
                  {alert.severity}
                </span>
              </div>

              <div className="card-location-row">
                <span className="alert-location-text">{alert.location}</span>
              </div>

              <div className="card-trigger-row">
                <span className="alert-trigger-text">Trigger: {alert.trigger}</span>
                <span className="alert-time-ago" style={{ marginLeft: 'auto' }}>
                  {timeAgo(alert.timestamp)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
