import { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';

// Geographically anchored landslide hazard envelope across Chamoli - Reni - Tapovan valley
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

export default function HazardPolygon({ viewer }) {
  const entityRefs = useRef([]);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    // Clean up previous entities
    entityRefs.current.forEach((e) => {
      try {
        if (!viewer.isDestroyed()) viewer.entities.remove(e);
      } catch (_) {}
    });
    entityRefs.current = [];

    try {
      // 1. Outer Translucent Hazard Polygon
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

      // 2. Outer Perimeter Boundary Line (Crisp Ground Clamped)
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

      // 3. Core High-Threat Instability Zone (Inner Polygon)
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

      // 4. Core Boundary Line
      const coreBoundary = viewer.entities.add({
        id: 'hazard-boundary-core',
        polyline: {
          positions: corePositions,
          clampToGround: true,
          width: 2.5,
          material: Cesium.Color.fromCssColorString('#f87171').withAlpha(0.95)
        }
      });

      // 5. Professional Geospatial Centroid Label & Anchor Point
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
          text: 'LANDSLIDE HAZARD ZONE\nActive Slope Instability Envelope • 14.0 km²',
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
  }, [viewer]);

  return null;
}
