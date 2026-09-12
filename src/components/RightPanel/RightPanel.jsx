import React from 'react';
import useStore from '../../store/useStore';
import AreaDispatchOverview from './AreaDispatchOverview';
import DispatchedDetailView from './DispatchedDetailView';

export default function RightPanel({ collapsed, socketRef }) {
  const rightPanelDrilldownArea = useStore((s) => s.rightPanelDrilldownArea);

  return (
    <aside className={`panel right ${collapsed ? 'collapsed' : ''}`} id="right-panel">
      <div style={{ display: collapsed ? 'none' : 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {rightPanelDrilldownArea ? (
          <DispatchedDetailView />
        ) : (
          <AreaDispatchOverview />
        )}
      </div>
    </aside>
  );
}
