import { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import useStore from '../../store/useStore';

export default function SensorMarkers({ viewer }) {
  const entityMapRef = useRef(new Map());
  const sensors = useStore((s) => s.sensors);
  const selectedState = useStore((s) => s.selectedState);
  // selectSensor

  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || !sensors || sensors.length === 0) return;

    const currentMap = entityMapRef.current;
    const activeIds = new Set(sensors.map((s) => s.id));

    // Remove entities no longer present
    for (const [id, entity] of currentMap.entries()) {
      if (!activeIds.has(id)) {
        try {
          if (!viewer.isDestroyed()) viewer.entities.remove(entity);
        } catch (_) {}
        currentMap.delete(id);
      }
    }

    sensors.forEach((sensor) => {
      const isMatchState =
        !selectedState ||
        selectedState === 'All States' ||
        (sensor.state || 'Uttarakhand').toLowerCase() === selectedState.toLowerCase();

      const pointColor = isMatchState
        ? (sensor.alert ? Cesium.Color.RED : Cesium.Color.WHITE)
        : Cesium.Color.WHITE.withAlpha(0.25);
      const outlineColor = isMatchState
        ? (sensor.alert ? Cesium.Color.YELLOW : Cesium.Color.CYAN.withAlpha(0.9))
        : Cesium.Color.TRANSPARENT;
      const pixelSize = isMatchState ? (sensor.alert ? 11 : 7) : 4;
      const outlineWidth = isMatchState ? (sensor.alert ? 2.5 : 1.5) : 0;

      let entity = currentMap.get(sensor.id);

      if (entity) {
        // Update properties in-place without deleting entity
        if (entity.point) {
          entity.point.color = pointColor;
          entity.point.outlineColor = outlineColor;
          entity.point.pixelSize = pixelSize;
          entity.point.outlineWidth = outlineWidth;
        }
      } else {
        // Create entity once
        const position = Cesium.Cartesian3.fromDegrees(sensor.lng, sensor.lat);
        entity = viewer.entities.add({
          position,
          id: `sensor-${sensor.id}`,
          point: {
            pixelSize,
            color: pointColor,
            outlineColor,
            outlineWidth,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            scaleByDistance: new Cesium.NearFarScalar(1000, 1.1, 100000, 0.5)
          },
          label: {
            text: isMatchState ? sensor.name : '',
            font: 'bold 10px Inter, sans-serif',
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -12),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            scaleByDistance: new Cesium.NearFarScalar(1000, 1.0, 50000, 0.4)
          }
        });
        currentMap.set(sensor.id, entity);
      }
    });

    viewer.scene.requestRender();
  }, [viewer, sensors, selectedState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const currentMap = entityMapRef.current;
      for (const entity of currentMap.values()) {
        try {
          if (viewer && !viewer.isDestroyed()) viewer.entities.remove(entity);
        } catch (_) {}
      }
      currentMap.clear();
    };
  }, [viewer]);

  return null;
}
