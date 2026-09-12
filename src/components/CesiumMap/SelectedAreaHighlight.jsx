import { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import useStore from '../../store/useStore';

const AREA_CONFIGS = {
  'All States': {
    name: 'All Monitoring Regions',
    lng: 86.5,
    lat: 27.2,
    height: 1500000,
    heading: 0,
    pitch: -55,
  },
  'Uttarakhand': {
    name: 'Uttarakhand State',
    lng: 79.35,
    lat: 30.40,
    height: 80000,
    heading: 0,
    pitch: -48,
    polygon: [
      [77.60, 30.30], [78.20, 31.40], [79.20, 31.50], [80.50, 30.80],
      [81.00, 30.20], [80.20, 29.00], [79.20, 29.00], [78.00, 29.60],
      [77.60, 30.30]
    ]
  },
  'Himachal Pradesh': {
    name: 'Himachal Pradesh State',
    lng: 77.17,
    lat: 31.85,
    height: 95000,
    heading: 0,
    pitch: -48,
    polygon: [
      [75.60, 32.20], [76.50, 33.20], [77.50, 32.90], [78.80, 32.00],
      [78.70, 31.10], [77.60, 30.50], [76.40, 31.00], [75.60, 32.20]
    ]
  },
  'Sikkim': {
    name: 'Sikkim State',
    lng: 88.55,
    lat: 27.45,
    height: 65000,
    heading: 0,
    pitch: -45,
    polygon: [
      [88.05, 27.10], [88.15, 27.75], [88.75, 28.15], [88.90, 27.45],
      [88.65, 27.10], [88.05, 27.10]
    ]
  },
  'Assam': {
    name: 'Assam State',
    lng: 92.80,
    lat: 26.20,
    height: 180000,
    heading: 0,
    pitch: -52,
    polygon: [
      [89.85, 26.10], [90.20, 26.65], [91.30, 26.85], [92.50, 26.90],
      [93.80, 27.35], [95.20, 27.75], [96.00, 27.60], [95.80, 26.95],
      [94.50, 26.60], [93.40, 26.15], [92.40, 25.80], [91.10, 25.95],
      [90.10, 25.85], [89.85, 26.10]
    ]
  },
  'Meghalaya': {
    name: 'Meghalaya State',
    lng: 91.50,
    lat: 25.45,
    height: 85000,
    heading: 0,
    pitch: -45,
    polygon: [
      [89.80, 25.20], [90.30, 25.90], [91.80, 25.85], [92.80, 25.25],
      [92.50, 25.05], [91.50, 25.10], [90.50, 25.15], [89.80, 25.20]
    ]
  },
  'Arunachal Pradesh': {
    name: 'Arunachal Pradesh State',
    lng: 94.20,
    lat: 27.80,
    height: 200000,
    heading: 0,
    pitch: -50,
    polygon: [
      [91.60, 27.30], [91.80, 27.95], [92.60, 28.50], [94.00, 29.10],
      [95.50, 29.40], [97.30, 28.40], [97.10, 27.60], [96.20, 27.15],
      [94.80, 27.20], [93.20, 27.10], [91.60, 27.30]
    ]
  },
  'Nagaland': {
    name: 'Nagaland State',
    lng: 94.20,
    lat: 25.90,
    height: 85000,
    heading: 0,
    pitch: -45,
    polygon: [
      [93.30, 25.60], [93.80, 26.20], [94.80, 27.00], [95.20, 26.80],
      [94.40, 25.90], [93.70, 25.40], [93.30, 25.60]
    ]
  },
  'Mizoram': {
    name: 'Mizoram State',
    lng: 92.75,
    lat: 23.40,
    height: 95000,
    heading: 0,
    pitch: -45,
    polygon: [
      [92.30, 21.95], [92.15, 24.25], [93.15, 24.45], [93.40, 23.05],
      [92.80, 21.90], [92.30, 21.95]
    ]
  }
};

function safeAddEntity(viewer, options) {
  if (options && options.id) {
    const existing = viewer.entities.getById(options.id);
    if (existing) {
      viewer.entities.remove(existing);
    }
  }
  return viewer.entities.add(options);
}

export default function SelectedAreaHighlight({ viewer }) {
  const entityRefs = useRef([]);
  const selectedState = useStore((s) => s.selectedState);
  const sensors = useStore((s) => s.sensors);

  // 1. Camera flight on state selection — fly directly to state center
  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || !selectedState) return;

    const cfg = AREA_CONFIGS[selectedState] || AREA_CONFIGS['All States'];
    if (!cfg) return;

    // Fly directly to the state center coordinates so the area is perfectly centered
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(cfg.lng, cfg.lat, cfg.height),
      orientation: {
        heading: Cesium.Math.toRadians(cfg.heading || 0),
        pitch: Cesium.Math.toRadians(cfg.pitch || -45),
        roll: 0,
      },
      duration: 1.8,
    });
  }, [viewer, selectedState]);

  // 2. Render visual area boundary and label
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    // Remove existing entities
    entityRefs.current.forEach((e) => {
      try {
        if (!viewer.isDestroyed()) viewer.entities.remove(e);
      } catch (_) {}
    });
    entityRefs.current = [];

    if (!selectedState || selectedState === 'All States') {
      viewer.scene.requestRender();
      return;
    }

    const cfg = AREA_CONFIGS[selectedState];
    if (!cfg) return;

    const activeSensors = sensors.filter(
      (s) => (s.state || 'Uttarakhand').toLowerCase() === selectedState.toLowerCase()
    );
    const hasAlert = activeSensors.some((s) => s.alert);

    // Draw boundary polygon if defined
    if (cfg.polygon && cfg.polygon.length > 2) {
      try {
        const flattened = [];
        cfg.polygon.forEach(([lng, lat]) => {
          flattened.push(lng, lat);
        });

        const positions = Cesium.Cartesian3.fromDegreesArray(flattened);

        // Glowing border clamped to terrain
        const borderPolyline = safeAddEntity(viewer, {
          id: `area-border-${selectedState}`,
          polyline: {
            positions,
            clampToGround: true,
            width: 4,
            material: new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.35,
              color: hasAlert
                ? Cesium.Color.RED.withAlpha(0.9)
                : Cesium.Color.CYAN.withAlpha(0.9),
            }),
          },
        });

        // Shaded area fill clamped to terrain
        const polygonFill = safeAddEntity(viewer, {
          id: `area-fill-${selectedState}`,
          polygon: {
            hierarchy: positions,
            material: hasAlert
              ? Cesium.Color.RED.withAlpha(0.08)
              : Cesium.Color.CYAN.withAlpha(0.07),
            classificationType: Cesium.ClassificationType.BOTH,
          },
        });

        entityRefs.current.push(borderPolyline, polygonFill);
      } catch (err) {
        console.warn('Error creating area boundary:', err);
      }
    }

    // Floating 3D Area Landmark Label
    try {
      const centerPos = Cesium.Cartesian3.fromDegrees(cfg.lng, cfg.lat);
      const areaLabel = safeAddEntity(viewer, {
        id: `area-label-${selectedState}`,
        position: centerPos,
        point: {
          pixelSize: 10,
          color: hasAlert ? Cesium.Color.RED : Cesium.Color.CYAN,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: `📍 ${selectedState.toUpperCase()} ACTIVE MONITORING ZONE (${activeSensors.length} STATIONS)`,
          font: 'bold 12px Inter, sans-serif',
          fillColor: hasAlert ? Cesium.Color.RED : Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -18),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
      });

      entityRefs.current.push(areaLabel);
    } catch (err) {
      console.warn('Error creating area label:', err);
    }
    viewer.scene.requestRender();

    return () => {
      entityRefs.current.forEach((e) => {
        try {
          if (!viewer.isDestroyed()) viewer.entities.remove(e);
        } catch (_) {}
      });
      entityRefs.current = [];
    };
  }, [viewer, selectedState, sensors]);

  return null;
}
