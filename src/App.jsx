import React from 'react';
import useSocket from './hooks/useSocket';
import useStore from './store/useStore';
import TopBar from './components/TopBar';
import RightPanel from './components/RightPanel/RightPanel';
import CesiumMap from './components/CesiumMap/CesiumMap';
import SensorDashboard from './components/SensorDashboard/SensorDashboard';
import CitizensAtRiskView from './components/CitizensAtRiskView/CitizensAtRiskView';
import AIDispatchView from './components/AIDispatchView/AIDispatchView';
import Toast from './components/Toast';

export default function App() {
  const socketRef = useSocket();
  const activeTab = useStore((s) => s.activeTab);
  const leftCollapsed = useStore((s) => s.leftCollapsed);
  const rightCollapsed = useStore((s) => s.rightCollapsed);
  const toggleLeft = useStore((s) => s.toggleLeft);
  const toggleRight = useStore((s) => s.toggleRight);
  const sensors = useStore((s) => s.sensors);
  const alerts = useStore((s) => s.alerts);

  const hasLandslideAlert = sensors.some((s) => s.alert) || alerts.length > 0;

  return (
    <div className={`app-layout ${hasLandslideAlert ? 'landslide-alert-active' : ''}`}>
      <TopBar />

      {/* MAIN CONTENT AREA */}
      <div className="app-main-wrapper">
        {/* Dashboard 3-Column View: Kept mounted to preserve 3D Cesium context & camera */}
        <div
          className="app-main dashboard-view-container"
          style={{ display: activeTab === 'dashboard' ? 'flex' : 'none' }}
        >
          <LeftPanel collapsed={leftCollapsed} />

          <button
            className={`panel-toggle left ${leftCollapsed ? 'collapsed' : ''}`}
            onClick={toggleLeft}
            title={leftCollapsed ? 'Show panel' : 'Hide panel'}
          >
            {leftCollapsed ? '>' : '<'}
          </button>

          <div className="center-column">
            <CesiumMap socketRef={socketRef} />
            <SensorDashboard />
          </div>

          <button
            className={`panel-toggle right ${rightCollapsed ? 'collapsed' : ''}`}
            onClick={toggleRight}
            title={rightCollapsed ? 'Show panel' : 'Hide panel'}
          >
            {rightCollapsed ? '<' : '>'}
          </button>

          <RightPanel collapsed={rightCollapsed} socketRef={socketRef} />
        </div>

        {/* Citizens at Risk View */}
        {activeTab === 'citizens' && (
          <div className="app-fullscreen-view">
            <CitizensAtRiskView socketRef={socketRef} />
          </div>
        )}

        {/* AI Dispatch View */}
        {activeTab === 'dispatch' && (
          <div className="app-fullscreen-view">
            <AIDispatchView socketRef={socketRef} />
          </div>
        )}
      </div>

      <Toast />
    </div>
  );
}
