import { useEffect, useRef, useMemo } from 'react';
import * as Cesium from 'cesium';
import useStore from '../../store/useStore';

// Helper to generate circle boundary positions
function createCircleBoundaryPositions(centerLng, centerLat, radiusMeters, points = 36) {
  const coords = [];
  const R = 6378137;
  const dByR = radiusMeters / R;
  const lat1 = Cesium.Math.toRadians(centerLat);
  const lon1 = Cesium.Math.toRadians(centerLng);

  for (let i = 0; i <= points; i++) {
    const bearing = (i * 2 * Math.PI) / points;
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(dByR) +
      Math.cos(lat1) * Math.sin(dByR) * Math.cos(bearing)
    );
    const lon2 = lon1 + Math.atan2(
      Math.sin(bearing) * Math.sin(dByR) * Math.cos(lat1),
      Math.cos(dByR) - Math.sin(lat1) * Math.sin(lat2)
    );
    coords.push(Cesium.Math.toDegrees(lon2), Cesium.Math.toDegrees(lat2));
  }
  return Cesium.Cartesian3.fromDegreesArray(coords);
}

function safeAddEntity(viewer, options) {
  try {
    return viewer.entities.add(options);
  } catch (err) {
    console.error(`Failed to add entity ${options.id}:`, err);
    return null;
  }
}

export default function ImpactZone({ viewer }) {
  const entityRefs = useRef([]);
  const sensors = useStore((s) => s.sensors);
  const selectedState = useStore((s) => s.selectedState);
  const setActiveImpactSensor = useStore((s) => s.setActiveImpactSensor);
  const setShowPrediction = useStore((s) => s.setShowPrediction);

  // Compute stable target hotspot sensor IDs to avoid rebuilding on every minor decimal tick
  const targetHotspotIds = useMemo(() => {
    if (!sensors || sensors.length === 0) return '';
    const areaSensors = (selectedState && selectedState !== 'All States')
      ? sensors.filter((s) => (s.state || 'Uttarakhand').toLowerCase() === selectedState.toLowerCase())
      : sensors;
    const alertSensors = areaSensors.filter((s) => s.alert);
    const top = alertSensors.length > 0 ? alertSensors.slice(0, 2) : [areaSensors[0]];
    return top.map((s) => s.id).join(',');
  }, [sensors, selectedState]);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || !sensors || sensors.length === 0) return;

    // Clean up previous entities safely
    entityRefs.current.forEach((e) => {
      try {
        if (!viewer.isDestroyed()) viewer.entities.remove(e);
      } catch (_) {}
    });
    entityRefs.current = [];

    const areaSensors = (selectedState && selectedState !== 'All States')
      ? sensors.filter((s) => (s.state || 'Uttarakhand').toLowerCase() === selectedState.toLowerCase())
      : sensors;

    if (areaSensors.length === 0) return;

    const alertSensors = areaSensors.filter((s) => s.alert);
    const targetHotspots = alertSensors.length > 0 ? alertSensors.slice(0, 2) : [areaSensors[0]];

    targetHotspots.forEach((sensor) => {
      try {
        const lng = Number(sensor.lng) || 79.35;
        const lat = Number(sensor.lat) || 30.40;
        const epicenterCart = Cesium.Cartesian3.fromDegrees(lng, lat);
        const rainfall = Number(sensor.rainfall) || 60;
        const tilt = Number(sensor.tilt) || 1.5;

        const calcRadiusKm = Math.min(4.5, Math.max(1.5, (rainfall / 140) * 3.0 + (tilt / 4) * 1.0));
        const targetRadiusMeters = Math.max(500, Math.round(calcRadiusKm * 1000));
        const isCritical = sensor.alert || rainfall > 125;
        const primaryColor = isCritical ? Cesium.Color.RED : Cesium.Color.ORANGE;

        // 1. Perimeter Boundary Line (Static, ground clamped)
        const boundaryPositions = createCircleBoundaryPositions(lng, lat, targetRadiusMeters, 36);
        const perimeterLine = safeAddEntity(viewer, {
          id: `impact-boundary-${sensor.id}`,
          polyline: {
            positions: boundaryPositions,
            clampToGround: true,
            width: 2,
            material: primaryColor.withAlpha(0.7)
          }
        });

        // 2. Main Impact Zone Fill (Static color, no CallbackProperty)
        const impactCircle = safeAddEntity(viewer, {
          id: `impact-circle-${sensor.id}`,
          position: epicenterCart,
          ellipse: {
            semiMajorAxis: targetRadiusMeters,
            semiMinorAxis: targetRadiusMeters,
            material: primaryColor.withAlpha(0.14),
            outline: false,
            classificationType: Cesium.ClassificationType.TERRAIN
          }
        });

        // 3. Epicenter Point & Clean Label (no emojis)
        const epicenterMarker = safeAddEntity(viewer, {
          id: `impact-epicenter-${sensor.id}`,
          position: epicenterCart,
          point: {
            pixelSize: 10,
            color: primaryColor,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY
          },
          label: {
            text: `${sensor.name.toUpperCase()} SECTOR\nRadius: ${calcRadiusKm.toFixed(1)} km | Rain: ${rainfall} mm/h`,
            font: 'bold 10px Inter, sans-serif',
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -18),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            scaleByDistance: new Cesium.NearFarScalar(1000, 1.0, 80000, 0.5)
          }
        });

        if (perimeterLine) entityRefs.current.push(perimeterLine);
        if (impactCircle) entityRefs.current.push(impactCircle);
        if (epicenterMarker) entityRefs.current.push(epicenterMarker);
      } catch (err) {
        console.error(`Failed to add impact zone for sensor ${sensor.id}:`, err);
      }
    });

    // Click handler to inspect prediction summary
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click) => {
      try {
        const picked = viewer.scene.pick(click.position);
        if (Cesium.defined(picked) && picked.id) {
          const entityId = picked.id.id || '';
          const matched = targetHotspots.find((s) => entityId.includes(s.id));
          if (matched) {
            setActiveImpactSensor(matched);
            setShowPrediction(true);
          } else if (entityId.startsWith('impact-')) {
            setActiveImpactSensor(targetHotspots[0]);
            setShowPrediction(true);
          }
        }
      } catch (_) {}
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    viewer.scene.requestRender();

    return () => {
      try {
        handler.destroy();
      } catch (_) {}
      entityRefs.current.forEach((e) => {
        try {
          if (!viewer.isDestroyed()) viewer.entities.remove(e);
        } catch (_) {}
      });
      entityRefs.current = [];
    };
  }, [viewer, targetHotspotIds, selectedState]);

  return null;
}
