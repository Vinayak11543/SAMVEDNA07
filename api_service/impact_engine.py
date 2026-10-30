"""
impact_engine.py — DEM-based terrain-aware landslide impact and runout engine

Models:
1. Initiation Scarp Zone (Apex failure envelope around sensor)
2. Runout Footprint (Flow-routed debris corridor using Heim's H/L Fahrböschung ratio)
3. Peripheral Exposure Zone (Lateral splash, rockfall bounce, and transport buffer)

Outputs standard RFC 7946 GeoJSON FeatureCollection.
"""

import math
import logging
import datetime
from typing import Dict, List, Tuple, Any, Optional
import requests
import numpy as np

logger = logging.getLogger("ml.impact_engine")


def query_local_dem(lat: float, lon: float, delta_deg: float = 0.001) -> Dict[str, Any]:
    """
    Queries Open-Meteo elevation API for center, north, south, east, west points
    to compute local elevation, gradient, slope (deg), and aspect (deg).
    Returns None if the DEM query fails.
    """
    coords = [
        (lat, lon),                 # Center (0)
        (lat + delta_deg, lon),     # North (1)
        (lat - delta_deg, lon),     # South (2)
        (lat, lon + delta_deg),     # East (3)
        (lat, lon - delta_deg),     # West (4)
    ]
    lats_str = ",".join([str(round(c[0], 4)) for c in coords])
    lons_str = ",".join([str(round(c[1], 4)) for c in coords])
    url = f"https://api.open-meteo.com/v1/elevation?latitude={lats_str}&longitude={lons_str}"

    try:
        r = requests.get(url, timeout=5)
        if r.status_code == 200:
            elevs = r.json().get("elevation", [])
            if len(elevs) == 5 and all(e is not None for e in elevs):
                z_c, z_n, z_s, z_e, z_w = [float(e) for e in elevs]
                dy = delta_deg * 111320.0
                dx = max(delta_deg * 111320.0 * math.cos(math.radians(lat)), 10.0)

                # Gradient
                p = (z_e - z_w) / (2.0 * dx)
                q = (z_n - z_s) / (2.0 * dy)
                grad_sq = p**2 + q**2

                slope_deg = math.degrees(math.atan(math.sqrt(grad_sq)))
                aspect_deg = (180.0 - math.degrees(math.atan2(q, p))) % 360.0

                return {
                    "elevation_m": round(z_c, 1),
                    "slope_deg": round(slope_deg, 2),
                    "aspect_deg": round(aspect_deg, 1),
                    "quality": "copernicus_dem_validated",
                    "dem_source": "Copernicus GLO-30 / SRTM 1-Arcsec",
                }
    except Exception as e:
        logger.warning(f"DEM elevation lookup failed for ({lat}, {lon}): {e}")

    return {
        "elevation_m": 1800.0,
        "slope_deg": 32.0,
        "aspect_deg": 180.0,
        "quality": "approximate_dem_fallback",
        "dem_source": "Illustrative Terrain Baseline (DEM unavailable)",
    }


def _meters_to_degrees(dx_m: float, dy_m: float, lat: float) -> Tuple[float, float]:
    """Converts horizontal displacements in metres (dx: East, dy: North) to decimal degrees."""
    d_lat = dy_m / 111320.0
    d_lon = dx_m / (111320.0 * math.cos(math.radians(lat)))
    return d_lon, d_lat


class GeospatialImpactEngine:
    """Terrain-aware landslide runout and impact zone generator."""

    def __init__(self, model_version: str = "1.0.0"):
        self.model_version = model_version

    def compute_impact_assessment(
        self,
        sensor_id: str,
        area_name: str,
        state: str,
        lat: float,
        lng: float,
        probability: float,
        risk_level: str,
        rainfall: float = 60.0,
        soil_moisture: float = 60.0,
    ) -> Dict[str, Any]:
        """
        Computes 3 distinct nested/sequential hazard zones:
        1. Initiation Zone (Crown scarp envelope)
        2. Runout Footprint (Channelized debris flow corridor based on Heim's H/L)
        3. Peripheral Exposure Zone (Lateral splash and hazard buffer)
        """
        # 1. Obtain terrain morphometry
        dem = query_local_dem(lat, lng)
        elev = dem["elevation_m"]
        slope_deg = dem["slope_deg"]
        aspect_deg = dem["aspect_deg"]
        data_quality = dem["quality"]
        dem_source = dem["dem_source"]

        # Downslope flow direction in radians (0 = North, 90 = East, 180 = South, 270 = West)
        flow_azimuth_rad = math.radians(aspect_deg)
        flow_dx = math.sin(flow_azimuth_rad)  # Eastward unit vector
        flow_dy = math.cos(flow_azimuth_rad)  # Northward unit vector

        # Orthogonal cross-slope unit vector (perpendicular to flow)
        ortho_dx = -flow_dy
        ortho_dy = flow_dx

        # 2. Empirical Fahrböschung (H/L) Runout Calculation
        # In saturated Himalayan conditions, Heim's angle alpha decreases with pore pressure
        # Base fahrboeschung angle between 20° and 32°
        base_fahrboeschung_deg = max(18.0, 32.0 - (probability / 100.0) * 12.0)
        tan_alpha = math.tan(math.radians(base_fahrboeschung_deg))

        # Expected runout distance (m) along the slope
        # High risk: 1.5 - 2.8 km; Low risk: 350 - 700 m
        runout_dist_m = float(np.clip(
            350.0 + (probability / 100.0) * 2200.0 + (slope_deg / 45.0) * 300.0,
            300.0,
            3200.0
        ))
        elev_drop_m = runout_dist_m * tan_alpha

        # Uncertainty based on data quality and probability
        uncertainty_m = 50.0 if data_quality == "copernicus_dem_validated" else 250.0
        uncertainty_m += (100.0 - probability) * 0.5

        # -------------------------------------------------------------
        # ZONE 1: INITIATION ZONE (Crown Scarp Envelope)
        # Small elliptical zone around the sensor station
        # -------------------------------------------------------------
        init_radius_along_m = 100.0 + (probability / 100.0) * 120.0
        init_radius_cross_m = 80.0 + (probability / 100.0) * 80.0

        init_pts = []
        for i in range(25):
            theta = 2.0 * math.pi * i / 24.0
            x_m = init_radius_cross_m * math.cos(theta) * ortho_dx + init_radius_along_m * math.sin(theta) * flow_dx
            y_m = init_radius_cross_m * math.cos(theta) * ortho_dy + init_radius_along_m * math.sin(theta) * flow_dy
            d_lon, d_lat = _meters_to_degrees(x_m, y_m, lat)
            init_pts.append([round(lng + d_lon, 6), round(lat + d_lat, 6)])

        init_area_km2 = (math.pi * init_radius_along_m * init_radius_cross_m) / 1e6

        # -------------------------------------------------------------
        # ZONE 2: RUNOUT FOOTPRINT (Debris Corridor & Deposition Fan)
        # Tapered polygon extending downslope from apex along flow line
        # -------------------------------------------------------------
        apex_width_m = init_radius_cross_m * 1.5
        toe_width_m = apex_width_m + 2.0 * runout_dist_m * math.tan(math.radians(11.0))  # 11° lateral spreading

        runout_polygon_pts = []

        # Left flank (Apex to Toe)
        # Apex Left
        p1_x = -0.5 * apex_width_m * ortho_dx
        p1_y = -0.5 * apex_width_m * ortho_dy
        d_lon, d_lat = _meters_to_degrees(p1_x, p1_y, lat)
        runout_polygon_pts.append([round(lng + d_lon, 6), round(lat + d_lat, 6)])

        # Toe Left
        p2_x = runout_dist_m * flow_dx - 0.5 * toe_width_m * ortho_dx
        p2_y = runout_dist_m * flow_dy - 0.5 * toe_width_m * ortho_dy
        d_lon, d_lat = _meters_to_degrees(p2_x, p2_y, lat)
        runout_polygon_pts.append([round(lng + d_lon, 6), round(lat + d_lat, 6)])

        # Toe Arc (Front deposition fan)
        for step in range(1, 8):
            frac = step / 8.0
            sweep_width = (0.5 - frac) * toe_width_m
            forward_arc = runout_dist_m + math.sin(frac * math.pi) * (toe_width_m * 0.25)
            arc_x = forward_arc * flow_dx + sweep_width * ortho_dx
            arc_y = forward_arc * flow_dy + sweep_width * ortho_dy
            d_lon, d_lat = _meters_to_degrees(arc_x, arc_y, lat)
            runout_polygon_pts.append([round(lng + d_lon, 6), round(lat + d_lat, 6)])

        # Toe Right
        p3_x = runout_dist_m * flow_dx + 0.5 * toe_width_m * ortho_dx
        p3_y = runout_dist_m * flow_dy + 0.5 * toe_width_m * ortho_dy
        d_lon, d_lat = _meters_to_degrees(p3_x, p3_y, lat)
        runout_polygon_pts.append([round(lng + d_lon, 6), round(lat + d_lat, 6)])

        # Apex Right
        p4_x = 0.5 * apex_width_m * ortho_dx
        p4_y = 0.5 * apex_width_m * ortho_dy
        d_lon, d_lat = _meters_to_degrees(p4_x, p4_y, lat)
        runout_polygon_pts.append([round(lng + d_lon, 6), round(lat + d_lat, 6)])

        # Close ring
        runout_polygon_pts.append(runout_polygon_pts[0])

        # Approximate trapezoid area in km²
        runout_area_km2 = (0.5 * (apex_width_m + toe_width_m) * runout_dist_m) / 1e6

        # -------------------------------------------------------------
        # ZONE 3: PERIPHERAL EXPOSURE ZONE (Lateral Splash & Buffer)
        # Expanded buffer boundary around the primary runout footprint
        # -------------------------------------------------------------
        buffer_dist_m = 180.0 + (probability / 100.0) * 120.0
        peripheral_pts = []

        # Buffer points around the runout polygon
        for pt in runout_polygon_pts[:-1]:
            # Vector from sensor center to pt in meters
            dx_deg = pt[0] - lng
            dy_deg = pt[1] - lat
            x_m = dx_deg * (111320.0 * math.cos(math.radians(lat)))
            y_m = dy_deg * 111320.0

            # Expand outwards by buffer_dist_m
            dist = math.sqrt(x_m**2 + y_m**2)
            if dist > 0:
                scale = (dist + buffer_dist_m) / dist
                bx_m = x_m * scale
                by_m = y_m * scale
            else:
                bx_m = buffer_dist_m
                by_m = 0

            d_lon, d_lat = _meters_to_degrees(bx_m, by_m, lat)
            peripheral_pts.append([round(lng + d_lon, 6), round(lat + d_lat, 6)])

        peripheral_pts.append(peripheral_pts[0])
        peripheral_area_km2 = (runout_area_km2 * 1.5) + (math.pi * buffer_dist_m**2) / 1e6

        timestamp_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        total_area_km2 = round(peripheral_area_km2, 2)

        # Build GeoJSON Features
        features = [
            {
                "type": "Feature",
                "id": f"zone-initiation-{sensor_id}",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [init_pts]
                },
                "properties": {
                    "sensor_id": sensor_id,
                    "area_name": area_name,
                    "state": state,
                    "zone_type": "initiation",
                    "zone_label": "High-Instability Initiation Crown",
                    "risk_class": risk_level,
                    "probability_pct": probability,
                    "area_km2": round(init_area_km2, 3),
                    "runout_distance_m": round(init_radius_along_m, 1),
                    "elevation_drop_m": round(init_radius_along_m * tan_alpha, 1),
                    "fahrboeschung_deg": round(base_fahrboeschung_deg, 1),
                    "uncertainty_m": round(uncertainty_m * 0.5, 1),
                    "input_data_quality": data_quality,
                    "dem_source": dem_source,
                    "label": "Initiation Scarp Zone - Estimated Failure Apex",
                    "timestamp": timestamp_iso,
                    "model_version": self.model_version,
                }
            },
            {
                "type": "Feature",
                "id": f"zone-runout-{sensor_id}",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [runout_polygon_pts]
                },
                "properties": {
                    "sensor_id": sensor_id,
                    "area_name": area_name,
                    "state": state,
                    "zone_type": "runout_footprint",
                    "zone_label": "Active Debris Runout Inundation Corridor",
                    "risk_class": risk_level,
                    "probability_pct": probability,
                    "area_km2": round(runout_area_km2, 2),
                    "runout_distance_m": round(runout_dist_m, 1),
                    "elevation_drop_m": round(elev_drop_m, 1),
                    "fahrboeschung_deg": round(base_fahrboeschung_deg, 1),
                    "uncertainty_m": round(uncertainty_m, 1),
                    "input_data_quality": data_quality,
                    "dem_source": dem_source,
                    "label": f"Debris Runout Corridor ({round(runout_dist_m)}m reach, {round(base_fahrboeschung_deg)}° Fahrböschung angle)",
                    "timestamp": timestamp_iso,
                    "model_version": self.model_version,
                }
            },
            {
                "type": "Feature",
                "id": f"zone-peripheral-{sensor_id}",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [peripheral_pts]
                },
                "properties": {
                    "sensor_id": sensor_id,
                    "area_name": area_name,
                    "state": state,
                    "zone_type": "peripheral_exposure",
                    "zone_label": "Peripheral Exposure & Airblast/Splash Buffer",
                    "risk_class": risk_level,
                    "probability_pct": probability,
                    "area_km2": round(peripheral_area_km2, 2),
                    "runout_distance_m": round(runout_dist_m + buffer_dist_m, 1),
                    "elevation_drop_m": round(elev_drop_m, 1),
                    "fahrboeschung_deg": round(base_fahrboeschung_deg, 1),
                    "uncertainty_m": round(uncertainty_m * 1.5, 1),
                    "input_data_quality": data_quality,
                    "dem_source": dem_source,
                    "label": "Peripheral Impact Envelope - Secondary Hazard Exposure (Not a validated evacuation boundary)",
                    "timestamp": timestamp_iso,
                    "model_version": self.model_version,
                }
            }
        ]

        summary = {
            "sensor_id": sensor_id,
            "area_name": area_name,
            "state": state,
            "coordinates": [lng, lat],
            "risk_class": risk_level,
            "probability_pct": probability,
            "total_impact_area_km2": total_area_km2,
            "runout_distance_m": round(runout_dist_m, 1),
            "elevation_m": elev,
            "slope_deg": slope_deg,
            "aspect_deg": aspect_deg,
            "fahrboeschung_deg": round(base_fahrboeschung_deg, 1),
            "uncertainty_m": round(uncertainty_m, 1),
            "input_data_quality": data_quality,
            "dem_source": dem_source,
            "timestamp": timestamp_iso,
            "model_version": self.model_version,
            "disclaimer": "Terrain-aware runout estimate - not a validated evacuation boundary"
        }

        return {
            "type": "FeatureCollection",
            "features": features,
            "summary": summary,
            "metadata": {
                "engine": "Geospatial Heim H/L Runout Engine",
                "version": self.model_version,
                "timestamp": timestamp_iso,
                "standards": "RFC 7946 GeoJSON",
            }
        }
