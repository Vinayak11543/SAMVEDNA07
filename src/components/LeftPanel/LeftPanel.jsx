import React from 'react';
import ActiveAlerts from './ActiveAlerts';

export default function LeftPanel({ collapsed }) {
  return (
    <aside className={`panel left ${collapsed ? 'collapsed' : ''}`} id="left-panel">
      <div style={{ display: collapsed ? 'none' : 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <div className="panel-section" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          <ActiveAlerts />
        </div>
      </div>
    </aside>
  );
}
