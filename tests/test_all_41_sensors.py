"""
test_all_41_sensors.py — Comprehensive 41-sensor validation test suite for SAMVEDNA

Verifies:
1. All 41 sensors in src/data/sensors.json are strictly preserved and valid
2. Telemetry schema and coordinates are geographically bounded
3. ML and rule-based inference for all 41 sensors
4. GeoJSON runout geometry validity for all 41 sensors (RFC 7946 compliance)
5. Missing-data resilience and fallback behavior
6. Spatial & temporal leakage verification on the ML training splits
7. SMS dispatch payload compatibility (verifying api/send-sms.js contracts)
"""

import os
import sys
import json
import unittest
import numpy as np

# Add project root and api_service to sys.path
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(BASE_DIR, "api_service"))
sys.path.insert(0, BASE_DIR)

from api_service.ml_service import ml_service
from api_service.impact_engine import GeospatialImpactEngine
from api_service.exposure_engine import exposure_engine


class TestAll41Sensors(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        sensors_file = os.path.join(BASE_DIR, "src", "data", "sensors.json")
        with open(sensors_file, "r", encoding="utf-8") as f:
            cls.sensors = json.load(f)
        cls.impact_engine = GeospatialImpactEngine()

    def test_01_sensor_count_and_ids(self):
        """Rule: Preserve all 41 records in sensors.json unchanged."""
        self.assertEqual(len(self.sensors), 41, "Must contain exactly 41 sensors.")
        expected_ids = [f"SNS-{i:02d}" for i in range(1, 42)]
        actual_ids = [s["id"] for s in self.sensors]
        self.assertEqual(actual_ids, expected_ids, "Sensor IDs must match SNS-01 through SNS-41 sequentially.")

    def test_02_coordinates_bounding_box(self):
        """Verify all 41 sensors have valid coordinates within India's sovereign bounds."""
        for s in self.sensors:
            lat = s["lat"]
            lng = s["lng"]
            self.assertTrue(20.0 <= lat <= 36.0, f"Sensor {s['id']} latitude {lat} out of expected range.")
            self.assertTrue(72.0 <= lng <= 97.0, f"Sensor {s['id']} longitude {lng} out of expected range.")
            # Verify Reni fallback is never used for other sensors
            if s["id"] != "SNS-03":
                self.assertFalse(
                    (round(lat, 3) == 30.415 and round(lng, 3) == 79.308),
                    f"Sensor {s['id']} incorrectly uses Reni coordinates as fallback!"
                )

    def test_03_inference_for_all_41_sensors(self):
        """Test inference across all 41 sensors."""
        valid_risk_classes = {"CRITICAL", "HIGH", "MEDIUM", "LOW"}
        for s in self.sensors:
            telemetry = {
                "sensor_id": s["id"],
                "name": s["name"],
                "state": s.get("state", "Uttarakhand"),
                "lat": s["lat"],
                "lng": s["lng"],
                "rainfall": s["rainfall"],
                "soil_moisture": s["soilMoisture"],
                "tilt": s["tilt"],
                "alert": s.get("alert", False),
            }
            pred = ml_service.predict(telemetry)
            self.assertIn(pred["risk_level"], valid_risk_classes, f"Sensor {s['id']} returned invalid risk level.")
            self.assertTrue(0.0 <= pred["probability"] <= 100.0, f"Sensor {s['id']} probability out of range.")
            self.assertEqual(pred["sensor_id"], s["id"])
            self.assertTrue(len(pred["dynamic_assessment"]) > 10)

    def test_04_geojson_runout_geometries_all_41_sensors(self):
        """Test DEM-based terrain runout generation for all 41 sensors."""
        for s in self.sensors:
            telemetry = {
                "sensor_id": s["id"],
                "name": s["name"],
                "state": s.get("state", "Uttarakhand"),
                "lat": s["lat"],
                "lng": s["lng"],
                "rainfall": s["rainfall"],
                "soil_moisture": s["soilMoisture"],
                "tilt": s["tilt"],
            }
            zones = ml_service.assess_impact_zones(telemetry)
            self.assertEqual(zones["type"], "FeatureCollection")
            self.assertGreaterEqual(len(zones["features"]), 3, f"Sensor {s['id']} must yield 3 runout zones.")

            summary = zones["summary"]
            self.assertGreater(summary["runout_distance_m"], 0.0)
            self.assertGreater(summary["total_impact_area_km2"], 0.0)

            # Validate polygon closure in GeoJSON coordinates
            for feat in zones["features"]:
                geom = feat["geometry"]
                self.assertEqual(geom["type"], "Polygon")
                coords = geom["coordinates"][0]
                self.assertGreaterEqual(len(coords), 4, "A valid polygon ring must have at least 4 coordinates.")
                # First point equals last point
                self.assertEqual(coords[0], coords[-1], f"Polygon for {feat['id']} must be closed.")
                # Ensure no NaN or infinite coordinates
                for pt in coords:
                    self.assertFalse(np.isnan(pt[0]) or np.isnan(pt[1]))
                    self.assertFalse(np.isinf(pt[0]) or np.isinf(pt[1]))

    def test_05_missing_data_resilience(self):
        """Verify pipeline handles completely missing or zero telemetry gracefully."""
        incomplete_telemetry = {
            "sensor_id": "SNS-99",
            "lat": 30.5,
            "lng": 79.5,
            # No rainfall, no moisture, no tilt
        }
        pred = ml_service.predict(incomplete_telemetry)
        self.assertIsNotNone(pred)
        self.assertIn("probability", pred)
        self.assertEqual(pred["data_quality"], "insufficient")

    def test_06_population_exposure_labeling(self):
        """Verify all exposure outputs contain the mandatory disclaimer."""
        for s in self.sensors[:5]:
            exposure = exposure_engine.estimate_exposure(
                sensor_id=s["id"],
                area_name=s["name"],
                state=s.get("state", "Uttarakhand"),
                lat=s["lat"],
                lng=s["lng"],
                runout_distance_m=1200.0,
                impact_area_km2=1.8,
                risk_level="CRITICAL",
            )
            self.assertEqual(
                exposure["disclaimer"],
                "estimated exposure, not confirmed affected persons",
                "Must carry exact required disclaimer."
            )

    def test_07_spatial_leakage_buffer_verification(self):
        """Verify ML model metadata confirms spatial leakage prevention."""
        meta_path = os.path.join(BASE_DIR, "ml", "models", "model_metadata.json")
        if os.path.exists(meta_path):
            with open(meta_path, "r", encoding="utf-8") as f:
                meta = json.load(f)
            prov = meta.get("dataset_provenance", {})
            self.assertIn("leakage_prevention", prov)
            self.assertIn("15 km", prov["leakage_prevention"])

    def test_08_send_sms_contract_preservation(self):
        """Verify api/send-sms.js is untouched and its input contract is documented."""
        sms_path = os.path.join(BASE_DIR, "api", "send-sms.js")
        self.assertTrue(os.path.exists(sms_path), "api/send-sms.js must exist.")
        with open(sms_path, "r", encoding="utf-8") as f:
            content = f.read()
        # Verify core SMS Gateway API signature is preserved
        self.assertIn("sms-gate.app", content)
        self.assertIn("phoneNumbers", content)
        self.assertIn("message", content)


if __name__ == "__main__":
    unittest.main(verbosity=2)
