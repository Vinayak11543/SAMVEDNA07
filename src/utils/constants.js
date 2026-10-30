/**
 * Shared constants.
 *
 * NOTE: EPICENTER and IMPACT_RADIUS_KM were previously hardcoded to Reni
 * Village. They are now retained only for backward compatibility with
 * legacy code paths. New code should use per-sensor coordinates from
 * sensors.json and dynamic radius calculations from riskEstimator.js.
 */

// Legacy Chamoli-area epicenter — used ONLY for SNS-01..05 Chamoli polygon
export const CHAMOLI_EPICENTER = { lat: 30.405, lng: 79.320 };
export const CHAMOLI_IMPACT_RADIUS_KM = 3.5;

// Deprecated aliases — do NOT use for non-Chamoli sensors
export const EPICENTER = CHAMOLI_EPICENTER;
export const IMPACT_RADIUS_KM = CHAMOLI_IMPACT_RADIUS_KM;
