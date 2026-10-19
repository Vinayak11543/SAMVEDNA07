import React, { useRef, useEffect, useState } from 'react';
import * as Cesium from 'cesium';
import useStore from '../../store/useStore';
import HazardPolygon from './HazardPolygon';
import RiskHeatmap from './RiskHeatmap';
import ImpactZone from './ImpactZone';
import SensorMarkers from './SensorMarkers';
import DispatchUnits from './DispatchUnits';
import PersonMarkers from './PersonMarkers';
import PredictionCard from './PredictionCard';
import SelectedAreaHighlight from './SelectedAreaHighlight';

const LAYER_LABELS = [
  { key: 'hazardPolygon', label: 'Hazard Zone' },
  { key: 'riskHeatmap', label: 'Risk Heatmap' },
  { key: 'impactZone', label: 'Impact Radii' },
  { key: 'sensors', label: 'Sensors' },
  { key: 'dispatchUnits', label: 'Dispatch' },
  { key: 'persons', label: 'Persons' }
];

export default function CesiumMap({ socketRef }) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const [viewerReady, setViewerReady] = useState(false);
  const layers = useStore((s) => s.layers);
  const toggleLayer = useStore((s) => s.toggleLayer);
  const showPrediction = useStore((s) => s.showPrediction);
  const selectedAlert = useStore((s) => s.selectedAlert);
  const selectedPerson = useStore((s) => s.selectedPerson);
  const selectedUnit = useStore((s) => s.selectedUnit);
  const selectedSensor = useStore((s) => s.selectedSensor);
  const selectedState = useStore((s) => s.selectedState);
  const setSelectedState = useStore((s) => s.setSelectedState);
  const sensors = useStore((s) => s.sensors);

  // Initialize Cesium Viewer once
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    Cesium.Ion.defaultAccessToken =
      import.meta.env.VITE_CESIUM_ION_TOKEN ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6Im5ENW1mZk0xbTRMNU1iaFYiLCJqdGkiOiI1OTBjODAyMi1mMTQ2LTQ2NjEtODVjMy0zNTMwYTc0NGZlZDgiLCJpZCI6NDc3Njk1LCJpc3MiOiJodHRwczovL2FwaS5jZXNpdW0uY29tIiwiYXVkIjoidW5kZWZpbmVkX2RlZmF1bHQiLCJpYXQiOjE3ODgyNDM0MjV9.QGlZYEhCUtHQ6rjye1L78CHWWyL8ZOe951z5GPtaaPI';

    const viewer = new Cesium.Viewer(containerRef.current, {
      terrain: Cesium.Terrain.fromWorldTerrain(),
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      selectionIndicator: false,
      navigationHelpButton: false,
      animation: false,
      timeline: false,
      fullscreenButton: false,
      infoBox: false,
      requestRenderMode: true,
      maximumRenderTimeChange: Infinity,
      msaaSamples: 1
    });

    // High performance scene settings
    const scene = viewer.scene;
    scene.globe.enableLighting = false; // Massive FPS boost without losing terrain quality
    scene.globe.depthTestAgainstTerrain = true;
    scene.globe.maximumScreenSpaceError = 2.5; // Optimized terrain tile budget
    scene.globe.tileCacheSize = 250;
    scene.fog.enabled = true;
    scene.fog.density = 0.0001;
    scene.skyAtmosphere.hueShift = -0.05;
    scene.skyAtmosphere.saturationShift = -0.2;
    scene.skyAtmosphere.brightnessShift = -0.1;

    // Fly to Himalayan region (Chamoli)
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(79.32, 30.40, 24000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-45),
        roll: 0
      },
      duration: 1.8
    });

    viewerRef.current = viewer;
    setViewerReady(true);

    return () => {
      if (viewer && !viewer.isDestroyed()) {
        viewer.destroy();
      }
      viewerRef.current = null;
      setViewerReady(false);
    };
  }, []);

  // Handle flyTo when selection changes
  
  // Handle map navigation when an impacted area is selected
  useEffect(() => {
    const viewer = viewerRef.current;

    if (!viewer || viewer.isDestroyed()) return;

    let target = null;
    let height = 5000;

    if (selectedAlert?.lat != null && selectedAlert?.lng != null) {
      target = { lat: Number(selectedAlert.lat), lng: Number(selectedAlert.lng) };
    } else if (selectedPerson?.lat != null && selectedPerson?.lng != null) {
      target = { lat: Number(selectedPerson.lat), lng: Number(selectedPerson.lng) };
      height = 2500;
    } else if (selectedUnit?.currentPosition) {
      target = {
        lng: Number(selectedUnit.currentPosition[0]),
        lat: Number(selectedUnit.currentPosition[1]),
      };
      height = 3000;
    } else if (selectedSensor?.lat != null && selectedSensor?.lng != null) {
      target = {
        lat: Number(selectedSensor.lat),
        lng: Number(selectedSensor.lng),
      };
      height = 3500;
    }

    if (!target || !Number.isFinite(target.lat) || !Number.isFinite(target.lng)) {
      return;
    }

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        target.lng,
        target.lat,
        height
      ),
      orientation: {
        heading: 0,
        pitch: Cesium.Math.toRadians(-65),
        roll: 0,
      },
      duration: 1.5,
    });
  }, [selectedAlert, selectedPerson, selectedUnit, selectedSensor]);


  return (
    <div className="map-container" id="map-container">
      <div id="cesiumContainer" ref={containerRef} />

      {/* Layer toggle chips */}
      <div className="layer-controls">
        {LAYER_LABELS.map(({ key, label }) => (
          <button
            key={key}
            className={`layer-chip ${layers[key] !== false ? 'active' : ''}`}
            onClick={() => toggleLayer(key)}
            id={`layer-toggle-${key}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Map sub-components - mounted conditionally with stable references */}
      {viewerReady && viewerRef.current && (
        <>
          {layers.hazardPolygon !== false && <HazardPolygon viewer={viewerRef.current} />}
          {layers.riskHeatmap && <RiskHeatmap viewer={viewerRef.current} />}
          {layers.impactZone && <ImpactZone viewer={viewerRef.current} />}
          <SelectedAreaHighlight viewer={viewerRef.current} />
          {layers.sensors && <SensorMarkers viewer={viewerRef.current} />}
          {layers.dispatchUnits && <DispatchUnits viewer={viewerRef.current} />}
          {layers.persons && <PersonMarkers viewer={viewerRef.current} />}
        </>
      )}

      {/* Active Area HUD indicator (Professional text / SVG without emojis) */}
      <div className="active-area-hud" id="active-area-hud">
        <span className="area-hud-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
          </svg>
        </span>
        <div className="area-hud-text">
          <div className="area-hud-title">
            {selectedState === 'All States' ? 'ALL MONITORING REGIONS' : `${selectedState.toUpperCase()} AREA`}
          </div>
          <div className="area-hud-meta">
            {selectedState === 'All States'
              ? `${sensors.length} Stations Active across Himalayas & NER`
              : `${sensors.filter((s) => (s.state || 'Uttarakhand') === selectedState).length} Monitoring Stations Active`}
          </div>
        </div>
        {selectedState !== 'All States' && (
          <button
            className="area-hud-reset-btn"
            onClick={() => setSelectedState('All States')}
            title="Reset view to all regions"
          >
            View All
          </button>
        )}
      </div>

      {/* Prediction card overlay */}
      {showPrediction && <PredictionCard />}

      {/* Legend */}
      {layers.riskHeatmap && (
        <div className="map-legend" id="map-legend">
          <div className="legend-title">Risk Level</div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: '#ff1a1a' }} />
            <span>Critical (&gt;90%)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: '#ff8c00' }} />
            <span>High (70-90%)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: '#ffd700' }} />
            <span>Moderate (40-70%)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: '#2d8a2d' }} />
            <span>Low (&lt;40%)</span>
          </div>
        </div>
      )}
    </div>
  );
}
