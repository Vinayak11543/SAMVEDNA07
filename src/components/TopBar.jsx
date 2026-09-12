import React, { useState, useEffect } from 'react';
import useStore from '../store/useStore';
import { clockTime } from '../utils/formatters';

export default function TopBar() {
  const [time, setTime] = useState(clockTime());
  const connected = useStore((s) => s.connected);
  const sensors = useStore((s) => s.sensors);
  const activeTab = useStore((s) => s.activeTab);
  const setActiveTab = useStore((s) => s.setActiveTab);

  useEffect(() => {
    const interval = setInterval(() => setTime(clockTime()), 1000);
    return () => clearInterval(interval);
  }, []);

  const totalSensors = sensors.length || 41;
  const onlineCount = sensors.length ? sensors.length : 41;

  return (
    <header className="topbar" id="topbar">
      {/* Left: Brand & Subtitle */}
      <div className="topbar-left">
        <div className="topbar-logo" onClick={() => setActiveTab('dashboard')} style={{ cursor: 'pointer' }}>
          <div className="topbar-logo-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
          </div>
          <div className="topbar-brand-group">
            <span className="topbar-title">SAMVEDNA</span>
            <span className="topbar-subtitle">LANDSLIDE AI v2.4 • Early Warning + 3D Twin</span>
          </div>
        </div>
      </div>

      {/* Center: Navigation Tabs */}
      <nav className="topbar-nav" id="topbar-nav">
        <button
          className={`topbar-nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
          id="nav-tab-dashboard"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="9" />
            <rect x="14" y="3" width="7" height="5" />
            <rect x="14" y="12" width="7" height="9" />
            <rect x="3" y="16" width="7" height="5" />
          </svg>
          <span>Dashboard</span>
        </button>

        <button
          className={`topbar-nav-tab ${activeTab === 'citizens' ? 'active' : ''}`}
          onClick={() => setActiveTab('citizens')}
          id="nav-tab-citizens"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span>Citizens at Risk</span>
        </button>

        <button
          className={`topbar-nav-tab ${activeTab === 'dispatch' ? 'active' : ''}`}
          onClick={() => setActiveTab('dispatch')}
          id="nav-tab-dispatch"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
          <span>AI Dispatch</span>
        </button>
      </nav>

      {/* Right: Clock & Status Indicators */}
      <div className="topbar-right">
        <div className="topbar-clock-badge" id="topbar-clock">
          <span>{time}</span>
        </div>

        <div className="topbar-live-badge">
          <span className={`connection-dot ${connected ? 'connected' : 'disconnected'}`} />
          <span>{connected ? 'LIVE' : 'OFFLINE'}</span>
        </div>

        <div className="topbar-sensors-badge">
          <span>Sensors: {onlineCount}/{totalSensors}</span>
        </div>
      </div>
    </header>
  );
}
