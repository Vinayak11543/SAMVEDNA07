import { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import useStore from '../../store/useStore';
import { computeHazardEnvelope } from '../../utils/riskEstimator';

// Geographically anchored landslide hazard envelope across Chamoli - Reni - Tapovan valley
// Only used for SNS-01..SNS-05
const PRIMARY_HAZARD_POLYGON = [
  79.338, 30.388,
  79.352, 30.402,
  79.336, 30.422,
  79.318, 30.432,
  79.294, 30.442,
  79.272, 30.455,
  79.252, 30.444,
  79.274, 30.418,
  79.298, 30.395,
  79.338, 30.388
];

// Inner core slope instability zone (Reni Village / Dhauliganga gorge)
const CORE_HAZARD_POLYGON = [
  79.322, 30.405,
  79.330, 30.416,
  79.315, 30.424,
  79.300, 30.418,
  79.305, 30.408,
  79.322, 30.405
];

const CHAMOLI_IDS = new Set(['SNS-01', 'SNS-02', 'SNS-03', 'SNS-04', 'SNS-05']);

export default function HazardPolygon({ viewer }) {
  const entityRefs = useRef([]);
  const activeImpactSensor = useStore((s) => s.activeImpactSensor);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    // Clean up previous entities
    entityRefs.current.forEach((e) => {
      try {
        if (!viewer.isDestroyed()) viewer.entities.remove(e);
      } catch (_) {}
    });
    entityRefs.current = [];

    const sensorId = activeImpactSensor?.id;

    // Determine which polygon to show
    const showChamoli = !sensorId || CHAMOLI_IDS.has(sensorId);

    try {
      if (showChamoli) {
        // ── Chamoli area polygon (original, preserved for SNS-01..05) ──
        const outerPositions = Cesium.Cartesian3.fromDegreesArray(PRIMARY_HAZARD_POLYGON);
        const outerPolygon = viewer.entities.add({
          id: 'hazard-polygon-primary',
          polygon: {
            hierarchy: outerPositions,
            material: Cesium.Color.fromCssColorString('#ef4444').withAlpha(0.20),
            classificationType: Cesium.ClassificationType.TERRAIN,
            outline: false
          }
        });

        const outerBoundary = viewer.entities.add({
          id: 'hazard-boundary-primary',
          polyline: {
            positions: outerPositions,
            clampToGround: true,
            width: 3,
            material: new Cesium.PolylineDashMaterialProperty({
              color: Cesium.Color.fromCssColorString('#ef4444').withAlpha(0.9),
              dashLength: 16.0
            })
          }
        });

        const corePositions = Cesium.Cartesian3.fromDegreesArray(CORE_HAZARD_POLYGON);
        const corePolygon = viewer.entities.add({
          id: 'hazard-polygon-core',
          polygon: {
            hierarchy: corePositions,
            material: Cesium.Color.fromCssColorString('#b91c1c').withAlpha(0.35),
            classificationType: Cesium.ClassificationType.TERRAIN,
            outline: false
          }
        });

        const coreBoundary = viewer.entities.add({
          id: 'hazard-boundary-core',
          polyline: {
            positions: corePositions,
            clampToGround: true,
            width: 2.5,
            material: Cesium.Color.fromCssColorString('#f87171').withAlpha(0.95)
          }
        });

        const centroidPos = Cesium.Cartesian3.fromDegrees(79.310, 30.418);
        const labelEntity = viewer.entities.add({
          id: 'hazard-label-primary',
          position: centroidPos,
          point: {
            pixelSize: 8,
            color: Cesium.Color.fromCssColorString('#ef4444'),
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY
          },
          label: {
            text: 'CHAMOLI HAZARD ZONE\nApproximate hazard estimate - not a validated evacuation boundary',
            font: 'bold 11px Inter, system-ui, sans-serif',
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 3,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -14),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            scaleByDistance: new Cesium.NearFarScalar(1000, 1.0, 90000, 0.55)
          }
        });

        entityRefs.current = [outerPolygon, outerBoundary, corePolygon, coreBoundary, labelEntity];
      } else {
        // ── Dynamic directional hazard envelope for non-Chamoli sensors ──
        const envelope = computeHazardEnvelope(activeImpactSensor);

        if (!envelope) {
          // Data insufficient — no polygon drawn
          viewer.scene.requestRender();
          return;
        }

        // Flatten coordinates for Cesium
        const flattened = [];
        envelope.coordinates.forEach(([lng, lat]) => {
          flattened.push(lng, lat);
        });
        const positions = Cesium.Cartesian3.fromDegreesArray(flattened);

        // Risk-based colour
        const fillColor = envelope.riskLevel === 'CRITICAL'
          ? Cesium.Color.fromCssColorString('#ef4444').withAlpha(0.18)
          : envelope.riskLevel === 'HIGH'
          ? Cesium.Color.fromCssColorString('#f97316').withAlpha(0.15)
          : envelope.riskLevel === 'MEDIUM'
          ? Cesium.Color.fromCssColorString('#eab308').withAlpha(0.12)
          : Cesium.Color.fromCssColorString('#22c55e').withAlpha(0.10);

        const borderColor = envelope.riskLevel === 'CRITICAL'
          ? Cesium.Color.fromCssColorString('#ef4444').withAlpha(0.85)
          : envelope.riskLevel === 'HIGH'
          ? Cesium.Color.fromCssColorString('#f97316').withAlpha(0.80)
          : envelope.riskLevel === 'MEDIUM'
          ? Cesium.Color.fromCssColorString('#eab308').withAlpha(0.70)
          : Cesium.Color.fromCssColorString('#22c55e').withAlpha(0.60);

        // Polygon fill
        const polyFill = viewer.entities.add({
          id: `hazard-envelope-fill-${envelope.sensorId}`,
          polygon: {
            hierarchy: positions,
            material: fillColor,
            classificationType: Cesium.ClassificationType.TERRAIN,
            outline: false
          }
        });

        // Dashed border
        const polyBorder = viewer.entities.add({
          id: `hazard-envelope-border-${envelope.sensorId}`,
          polyline: {
            positions,
            clampToGround: true,
            width: 2.5,
            material: new Cesium.PolylineDashMaterialProperty({
              color: borderColor,
              dashLength: 14.0
            })
          }
        });

        // Center label
        const centerPos = Cesium.Cartesian3.fromDegrees(envelope.centerLng, envelope.centerLat);
        const labelEntity = viewer.entities.add({
          id: `hazard-envelope-label-${envelope.sensorId}`,
          position: centerPos,
          point: {
            pixelSize: 7,
            color: borderColor,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 1.5,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY
          },
          label: {
            text: `${(activeImpactSensor.name || 'SENSOR').toUpperCase()} HAZARD ZONE\n` +
                  `Approximate hazard estimate - not a validated evacuation boundary\n` +
                  `Est. area: ${envelope.areaKm2} km² (placeholder)`,
            font: 'bold 10px Inter, system-ui, sans-serif',
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 3,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -14),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            scaleByDistance: new Cesium.NearFarScalar(1000, 1.0, 90000, 0.55)
          }
        });

        entityRefs.current = [polyFill, polyBorder, labelEntity];
      }

      viewer.scene.requestRender();
    } catch (err) {
      console.error('Failed to create hazard polygon on Cesium map:', err);
    }

    return () => {
      entityRefs.current.forEach((e) => {
        try {
          if (viewer && !viewer.isDestroyed()) viewer.entities.remove(e);
        } catch (_) {}
      });
      entityRefs.current = [];
    };
  }, [viewer, activeImpactSensor?.id, activeImpactSensor?.rainfall, activeImpactSensor?.soilMoisture, activeImpactSensor?.tilt]);

  return null;
}
