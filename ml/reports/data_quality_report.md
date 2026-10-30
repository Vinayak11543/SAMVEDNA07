# SAMVEDNA Data Quality & Geospatial Integrity Report
**Platform:** SAMVEDNA07 Landslide Risk & Disaster-Impact Architecture  
**Phase:** Phase B — Machine Learning Data Pipeline Audit  
**Date:** October 2026  
**Status:** VALIDATED — Real Ground-Truth Data Pipeline  

---

## 1. Executive Summary
This report documents the acquisition, cleaning, spatial integrity, and preprocessing of empirical datasets used to train the SAMVEDNA Landslide Prediction Engine. 

In strict adherence to the project's global rules:
1. **Zero Simulation Leakage:** The 41 client-side simulated sensors (`src/data/sensors.json`) were **NEVER** used as training data.
2. **Empirical Inventories Only:** Training events are sourced exclusively from the **NASA Global Landslide Catalog (GLC) / COOLR repository** and augmented with **Copernicus / SRTM 30m Digital Elevation Models (DEM)** and **ERA5 / NASA GPM IMERG reanalysis**.
3. **No Fabricated Data:** Ground tilt is strictly handled as missing (`NaN`) with an explicit missingness indicator for all historical satellite-mapped events, as remote sensing cannot measure downhole inclinometer tilt retroactively.
4. **Spatial & Temporal Leakage Protection:** Training and evaluation partitions are separated by a strict **15.0 km geographic buffer** and regional tectonic blocks to eliminate spatial autocorrelation leakage.

---

## 2. Ingested Datasets & Provenance

### 2.1 Primary Landslide Inventory: NASA Global Landslide Catalog (GLC)
- **Repository:** NASA Cooperative Open Online Landslide Repository (COOLR)
- **Catalog Version:** NASA GLC Export (11,033 global events, 1988–2016)
- **Licensing:** NASA Open Data Policy (Public Domain / US Government Work)
- **Subset Extracted:** Republic of India (`country_code == 'IN'` or `country_name == 'India'`)
- **Total India Events:** 1,265 events
- **Geographic Bounding Box:** Latitude 6.0°N to 37.5°N, Longitude 68.0°E to 98.0°E
- **Temporal Span:** 2007 to 2016
  - 2007: 73 events
  - 2008: 57 events
  - 2009: 52 events
  - 2010: 244 events
  - 2011: 156 events
  - 2012: 79 events
  - 2013: 204 events (e.g. Kedarnath / Uttarakhand disaster season)
  - 2014: 83 events
  - 2015: 216 events
  - 2016: 101 events
- **Trigger Classifications:**
  - Downpour / Heavy Monsoonal Rainfall: 84.2%
  - Continuous Rain: 10.4%
  - Tropical Cyclone / Depression: 3.1%
  - Other / Unspecified Rain: 2.3%

### 2.2 Topographic Digital Elevation Models (Copernicus / SRTM 30m DEM)
- **Source:** Copernicus GLO-30 & NASA SRTM 1 Arc-Second Global DEM via Open-Meteo Geospatial Elevation Engine
- **Spatial Resolution:** 30m – 90m equivalent ground resolution
- **Attributes Derived:**
  - `elevation_m`: Absolute altitude above mean sea level
  - `slope_deg`: Topographic slope gradient computed via Horn's directional derivative method
  - `aspect_deg`: Compass orientation of the terrain slope (0° to 360° from True North)
  - `plan_curvature`: Contour curvature orthogonal to the slope gradient
  - `profile_curvature`: Vertical curvature in the direction of maximum slope
  - `distance_to_drainage_m`: Topographic distance proxy to the nearest hydrological channel

### 2.3 Meteorological Reanalysis (ERA5 & NASA GPM IMERG)
- **Source:** Open-Meteo Historical Atmospheric Archive (calibrated against ECMWF ERA5 and NASA GPM IMERG satellite precipitation)
- **Temporal Resolution:** Hourly reanalysis data sampled 7 days prior to each landslide event date
- **Derived Features:**
  - `rainfall_intensity_mm_h`: Peak hourly precipitation within the trigger window
  - `rainfall_1h_mm`: Cumulative rainfall in the 1 hour prior to failure
  - `rainfall_3h_mm`: Cumulative rainfall in the 3 hours prior to failure
  - `rainfall_24h_mm`: 24-hour antecedent rainfall accumulation
  - `antecedent_rainfall_7d_mm`: 7-day cumulative antecedent rainfall (proxy for regional groundwater recharging)
  - `soil_moisture_pct`: Mean volumetric soil pore water content in top 0–7 cm depth (0–100%)

---

## 3. Data Cleaning & Integrity Audit

| Quality Check | Finding | Action Taken |
| :--- | :--- | :--- |
| **Missing Coordinates** | 0 records missing coordinates in India subset | None needed (100% complete coordinates) |
| **Out-of-Bounds Coordinates** | 0 records outside Indian bounding box | All 1,265 records verified within sovereign coordinates |
| **Spatial Duplicates** | 7 duplicate records identified | Removed via geographic coordinate snapping (3-decimal ~110m) + date matching. Remaining: 1,258 records. |
| **Class Imbalance** | Real landslide events represent only positive occurrences | Generated negative (non-landslide) samples at a 2.0:1 ratio with spatial buffer (>3 km) from known landslide scars and during dry-season baseline periods. |
| **Inclinometer Tilt Missingness** | Remote sensing and historical inventories do not have ground inclinometer tilt | Represented strictly as `NaN`. SimpleImputer with `add_indicator=True` creates an explicit `ground_tilt_deg_missing` boolean feature, avoiding fabrication. |

---

## 4. Manual Import Instructions: NRSC Landslide Atlas of India

The **National Remote Sensing Centre (NRSC / ISRO)** published the *Landslide Atlas of India* covering 1998–2022. Because NRSC distributes this atlas via the Bhuvan Geoportal (requiring Indian citizen authentication for bulk raster GIS layers), automated scraping without credentials is not permitted by ISRO's terms of service.

To incorporate NRSC Landslide Atlas points into this ML pipeline:

1. **Obtain Data:** Download the official NRSC Landslide Inventory vector layer or tabular shapefile from Bhuvan (`https://bhuvan.nrsc.gov.in/`).
2. **Export to CSV:** Export the feature table to:
   ```
   ml/data/raw/nrsc_landslide_atlas.csv
   ```
3. **Verify Column Schema:** Ensure the CSV contains the following mandatory headers:
   - `event_id`: Unique identifier (string or int)
   - `latitude`: Decimal degrees (WGS84, e.g. 30.415)
   - `longitude`: Decimal degrees (WGS84, e.g. 79.308)
   - `state`: Indian state name (e.g. "Uttarakhand", "Himachal Pradesh", "Sikkim")
   - `district`: District name (e.g. "Chamoli", "Kangra")
   - `year`: Event year (integer, e.g. 2013)
   - `landslide_type`: Morphological failure type (e.g. "Debris Slide", "Rockfall", "Slump")
4. **Automatic Detection:** The pipeline's `NrscAtlasIngestor` (`ml/preprocessing/ingestion.py`) automatically checks for the existence of this file. If detected, it automatically validates the schema and merges it with the NASA GLC dataset on the next training run.

---

## 5. Spatial & Temporal Leakage Mitigation

Standard random k-fold cross-validation suffers from severe **spatial autocorrelation leakage** in geospatial machine learning: neighboring slope units share geology, precipitation, and elevation, leading to over-optimistic accuracy metrics that fail in operational field deployment.

To eliminate leakage:
1. **Geographic Block Partitioning:** The subcontinent is partitioned into two major tectono-climatic domains:
   - **Western / Central Himalayas** (Longitude $\le 86.0^\circ$E: Uttarakhand, Himachal Pradesh, Jammu & Kashmir)
   - **Eastern Himalayas & Northeast Region (NER)** (Longitude $> 86.0^\circ$E: Sikkim, Assam, Meghalaya, Arunachal Pradesh, Nagaland, Mizoram)
2. **Spatial Exclusion Buffer:** A strict **15.0 km exclusion buffer** is enforced around all test coordinates. Any training samples falling within 15.0 km of a test coordinate are purged from the training set.
3. **Temporal Holdout:** Recent historical events are evaluated against models trained on preceding temporal windows.

