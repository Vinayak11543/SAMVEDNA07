import { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import useStore from '../../store/useStore';


// Generate a risk heatmap as a canvas image
function generateHeatmapCanvas(width = 512, height = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Epicenter in normalized canvas coords (center-ish)
  const cx = width * 0.5;
  const cy = height * 0.45;

  // Create multiple radial gradient layers for realistic heatmap
  const gradients = [
    { x: cx, y: cy, r: 140, intensity: 1.0 },
    { x: cx - 30, y: cy + 20, r: 100, intensity: 0.8 },
    { x: cx + 50, y: cy - 10, r: 80, intensity: 0.7 },
    { x: cx - 20, y: cy + 60, r: 120, intensity: 0.6 },
    { x: cx + 30, y: cy + 80, r: 90, intensity: 0.5 },
  ];

  // Background transparent
  ctx.clearRect(0, 0, width, height);

  gradients.forEach(({ x, y, r, intensity }) => {
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(255, 26, 26, ${0.6 * intensity})`);
    grad.addColorStop(0.3, `rgba(255, 140, 0, ${0.45 * intensity})`);
    grad.addColorStop(0.6, `rgba(255, 215, 0, ${0.3 * intensity})`);
    grad.addColorStop(0.85, `rgba(45, 138, 45, ${0.15 * intensity})`);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  });

  return canvas;
}

/**
 * FIX Problem 3: RiskHeatmap now centers on the active impact sensor,
 * not hardcoded to the Chamoli bounding box. Falls back to Chamoli
 * coordinates if no sensor is selected.
 */
export default function RiskHeatmap({ viewer }) {
  const layerRef = useRef(null);
  const activeImpactSensor = useStore((s) => s.activeImpactSensor);
  const sensorLat = activeImpactSensor?.lat;
  const sensorLng = activeImpactSensor?.lng;

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    let cancelled = false;

    async function addHeatmap() {
      const canvas = generateHeatmapCanvas();
      const dataUrl = canvas.toDataURL('image/png');

      // Center heatmap on active sensor, or default to Chamoli region
      const centerLat = Number.isFinite(sensorLat) ? sensorLat : 30.41;
      const centerLng = Number.isFinite(sensorLng) ? sensorLng : 79.32;
      const spread = 0.14; // ~14 km in each direction

      const west = centerLng - spread;
      const south = centerLat - spread;
      const east = centerLng + spread;
      const north = centerLat + spread;

      try {
        const provider = await Cesium.SingleTileImageryProvider.fromUrl(dataUrl, {
          rectangle: Cesium.Rectangle.fromDegrees(west, south, east, north)
        });

        if (cancelled || viewer.isDestroyed()) return;

        const layer = viewer.imageryLayers.addImageryProvider(provider);
        layer.alpha = 0.55;
        layerRef.current = layer;
        viewer.scene.requestRender();
      } catch (e) {
        console.warn('RiskHeatmap: failed to create imagery provider', e);
      }
    }

    addHeatmap();

    return () => {
      cancelled = true;
      if (layerRef.current && !viewer.isDestroyed()) {
        viewer.imageryLayers.remove(layerRef.current, true);
        layerRef.current = null;
      }
    };
  }, [viewer, sensorLat, sensorLng]);

  return null;
}
