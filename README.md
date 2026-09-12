# Samvedna Disaster Management - 3D Operations Dashboard

A 3D command and control center for real-time disaster monitoring, geotechnical sensor telemetry, citizen risk tracking, and automated emergency resource dispatching. Built for deployment on **Vercel** with full client-side simulation and optional live WebSocket synchronization.

![Samvedna Dashboard](src/assets/hero.png)

---

## 🌟 Key Features

### 1. 3D Digital Twin Command Center (CesiumJS)
- **Photorealistic Terrain & Globe**: Real-time 3D visualization powered by Cesium Ion.
- **Interactive Geospatial Layers**:
  - Geotechnical sensor nodes with live status pins and telemetry hovercards.
  - Multi-tiered impact zones and seismic/landslide epicenter indicators.
  - Risk heatmap visualization and hazardous slope terrain polygons.
  - Field unit routes and real-time GPS tracking.
  - Citizen density and evacuation radius indicators.
- **Dynamic Camera Controls**: Quick fly-to navigation for high-threat zones and monitoring sectors.

### 2. Units in the Field & Area Dispatch (Right Panel)
- **Real-Time Location Search**:
  - Multi-token location search bar (e.g. `Chamoli`, `Reni`, `Tapovan`, `Sikkim`).
  - Search by station name, place, state, or sensor ID.
  - Dynamic filter badges (`All`, `No Dispatch`, `Dispatched`) updating with real-time matched counts.
  - Interactive drilldown into active sector units and deployed equipment.

### 3. AI Automated Dispatch Center
- **ML Geotechnical Prediction Engine**:
  - Calculates dynamic landslide failure probability, risk classification (Critical, High, Medium, Low), and model confidence scores from sensor telemetry.
  - Dynamic Threat Assessment tailored to real-time rainfall, soil moisture saturation, and slope tilt.
- **Resource Allocation Matrix**:
  - Automated deployment of NDRF Search & Rescue Teams, IAF Evacuation Helicopters, and Thermal Recon Drones.
  - One-click emergency dispatch with full state synchronization.

### 4. Citizens at Risk & Emergency Notification System
- Area-wise citizen grouping with evacuation statuses (`IN ZONE`, `SAFE`, `NOTIFIED`, `EVACUATED`).
- One-click area-wide emergency SMS/notification broadcasts with visual status feedback.
- Individual citizen emergency dispatch tracking and phone lookup.

### 5. Geotechnical Sensor Telemetry Dashboard
- Live 41-station sensor network across Uttarakhand, Himachal Pradesh, Sikkim, Assam, Meghalaya, Arunachal Pradesh, and Nagaland.
- Historical trend charts for Rainfall (mm/h), Soil Moisture (%), and Slope Inclinometer Tilt (°).
- State-wise filtering and critical alert feeds.

---

## 🚀 Instant Deployment on Vercel

### Option 1: Vercel Dashboard (Recommended)
1. Push this repository to your GitHub account.
2. Go to [Vercel](https://vercel.com/new) and import this repository.
3. Configure the project:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. *(Optional)* Add Environment Variables:
   - `VITE_CESIUM_ION_TOKEN`: (Pre-configured in `.env`)
   - `VITE_WS_URL`: (Optional — leave blank for Standalone Cloud Mode with built-in client simulation, or enter your backend server URL)
5. Click **Deploy**. Your dashboard is live in seconds!

### Option 2: Vercel CLI
```bash
npm install -g vercel
vercel
```

---

## 💻 Local Development

### Prerequisites
- Node.js (v18 or higher)
- npm or pnpm

### Installation
```bash
# Clone the repository
git clone <your-repo-url>
cd samvedna-admin-dashboard

# Install dependencies
npm install

# Start development server (runs on port 5174)
npm run dev
```

Open [http://localhost:5174](http://localhost:5174) in your browser.

---

## 🏗️ Tech Stack

- **Frontend**: React 19, Vite, Zustand
- **3D Geospatial Engine**: CesiumJS, `vite-plugin-cesium`
- **Real-Time Engine**: Socket.io Client + Client-Side Telemetry Simulation Engine
- **Styling**: Vanilla CSS (Tactical Dark Ops Command Aesthetic)
- **Deployment**: Vercel
