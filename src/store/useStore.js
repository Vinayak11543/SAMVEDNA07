import { create } from 'zustand';
import {
  getInitialSensors,
  getInitialUnits,
  getInitialPersons,
  getInitialAlerts
} from '../data/clientSimulator';

const INITIAL_DISPATCHED = {
  'SNS-02': {
    sensorId: 'SNS-02',
    name: 'Chamoli Ridge B',
    place: 'Chamoli',
    state: 'Uttarakhand',
    unitsCount: 128,
    activeUnitsCount: 4,
    status: 'DISPATCHED',
    dispatchedAt: '05:41:40 PM',
    etaMins: 20,
    rainfall: 102.8,
    soilMoisture: 98.3,
    tilt: 11.84,
    lat: 30.410,
    lng: 79.315,
    resources: [
      { name: 'NDRF Search & Rescue Teams', qty: 2, icon: 'rescue' },
      { name: 'IAF Evacuation Helicopters', qty: 1, icon: 'helicopter' },
      { name: 'Thermal Recon Drones', qty: 1, icon: 'drone' }
    ]
  }
};

const DEFAULT_RENI_SENSOR = {
  id: 'SNS-03',
  name: 'Reni Village',
  place: 'Reni',
  state: 'Uttarakhand',
  lat: 30.415,
  lng: 79.308,
  rainfall: 107.6,
  soilMoisture: 94.6,
  tilt: 8.07,
  alert: true
};

const useStore = create((set, get) => ({
  // Navigation / Views: 'dashboard' | 'citizens' | 'dispatch'
  activeTab: 'dashboard',
  setActiveTab: (tab) => set({ activeTab: tab }),

  // Connection
  connected: true,
  setConnected: (connected) => set({ connected }),

  // Alerts
  alerts: getInitialAlerts(),
  setAlerts: (alerts) => set({ alerts }),
  addAlert: (alert) => set((s) => ({ alerts: [alert, ...s.alerts].slice(0, 50) })),

  // Sensors
  sensors: getInitialSensors(),
  setSensors: (sensors) => set({ sensors }),
  sensorHistory: {},
  updateSensors: (sensors) => set((s) => {
    const history = { ...s.sensorHistory };
    sensors.forEach((sensor) => {
      if (!history[sensor.id]) history[sensor.id] = [];
      history[sensor.id] = [...history[sensor.id].slice(-9), {
        rainfall: sensor.rainfall,
        soilMoisture: sensor.soilMoisture,
        tilt: sensor.tilt
      }];
    });

    // Update activeImpactSensor if it matches
    let updatedActive = s.activeImpactSensor;
    if (updatedActive) {
      const match = sensors.find((x) => x.id === updatedActive.id);
      if (match) updatedActive = { ...updatedActive, ...match };
    }

    return { sensors, sensorHistory: history, activeImpactSensor: updatedActive };
  }),

  // Persons
  persons: getInitialPersons(),
  setPersons: (persons) => set({ persons }),

  // Units
  units: getInitialUnits(),
  setUnits: (units) => set({ units }),

  // Selections (for map flyTo)
  selectedAlert: null,
  selectAlert: (alert) => set({ selectedAlert: alert, selectedPerson: null, selectedUnit: null }),

  selectedPerson: null,
  selectPerson: (person) => set({ selectedPerson: person, selectedAlert: null, selectedUnit: null }),

  selectedUnit: null,
  selectUnit: (unit) => set({ selectedUnit: unit, selectedAlert: null, selectedPerson: null, selectedSensor: null }),

  selectedSensor: null,
  selectSensor: (sensor) => set({ selectedSensor: sensor, selectedAlert: null, selectedPerson: null, selectedUnit: null }),

  // State filtering & panel expansion
  selectedState: 'All States',
  setSelectedState: (selectedState) => set({ selectedState }),
  sensorPanelExpanded: false,
  toggleSensorPanel: () => set((s) => ({ sensorPanelExpanded: !s.sensorPanelExpanded })),
  setSensorPanelExpanded: (sensorPanelExpanded) => set({ sensorPanelExpanded }),

  clearSelection: () => set({ selectedAlert: null, selectedPerson: null, selectedUnit: null, selectedSensor: null }),

  // Map layers
  layers: {
    riskHeatmap: true,
    impactZone: true,
    sensors: true,
    dispatchUnits: true,
    persons: true
  },
  toggleLayer: (layer) => set((s) => ({
    layers: { ...s.layers, [layer]: !s.layers[layer] }
  })),

  // Prediction card & impact sensor (defaults to open Reni Village as shown in reference video)
  showPrediction: true,
  setShowPrediction: (show) => set({ showPrediction: show }),
  activeImpactSensor: DEFAULT_RENI_SENSOR,
  setActiveImpactSensor: (activeImpactSensor) => set({ activeImpactSensor, showPrediction: true }),

  // Panel collapse
  leftCollapsed: false,
  rightCollapsed: false,
  toggleLeft: () => set((s) => ({ leftCollapsed: !s.leftCollapsed })),
  toggleRight: () => set((s) => ({ rightCollapsed: !s.rightCollapsed })),

  // Right Panel & Dispatch State
  rightPanelFilter: 'all', // 'all' | 'no-dispatch' | 'dispatched'
  setRightPanelFilter: (filter) => set({ rightPanelFilter: filter }),
  rightPanelDrilldownArea: null, // area object or null
  setRightPanelDrilldownArea: (area) => set({ rightPanelDrilldownArea: area }),

  // Dispatched areas map: keyed by sensorId
  dispatchedAreas: INITIAL_DISPATCHED,
  dispatchArea: (area, totalUnits, breakdown) => set((s) => {
    const sensorId = area.id || area.sensorId || 'SNS-02';
    const updated = {
      ...s.dispatchedAreas,
      [sensorId]: {
        sensorId,
        name: area.name || 'Chamoli Ridge B',
        place: area.place || 'Chamoli',
        state: area.state || 'Uttarakhand',
        unitsCount: totalUnits || 128,
        activeUnitsCount: 4,
        status: 'DISPATCHED',
        dispatchedAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        etaMins: 20,
        rainfall: area.rainfall || 102.8,
        soilMoisture: area.soilMoisture || 98.3,
        tilt: area.tilt || 11.84,
        lat: area.lat || 30.410,
        lng: area.lng || 79.315,
        breakdown: breakdown || {}
      }
    };
    return { dispatchedAreas: updated };
  }),
  recallArea: (sensorId) => set((s) => {
    const updated = { ...s.dispatchedAreas };
    delete updated[sensorId];
    return {
      dispatchedAreas: updated,
      rightPanelDrilldownArea: s.rightPanelDrilldownArea?.sensorId === sensorId ? null : s.rightPanelDrilldownArea
    };
  }),

  // AI Dispatch selection
  selectedDispatchAreaId: 'SNS-02',
  setSelectedDispatchAreaId: (id) => set({ selectedDispatchAreaId: id }),

  // Citizen area notification state: keyed by sensorId
  // Values: { status: 'idle' | 'sending' | 'notified' | 'failed', count: number, total: number }
  notifiedAreas: {},
  markAreaNotifying: (sensorId) => set((s) => ({
    notifiedAreas: {
      ...s.notifiedAreas,
      [sensorId]: { status: 'sending', count: 0, total: 0 }
    }
  })),
  markAreaNotified: (sensorId, count) => set((s) => ({
    notifiedAreas: {
      ...s.notifiedAreas,
      [sensorId]: { status: 'notified', count, total: count }
    }
  })),
  markAreaNotifyFailed: (sensorId) => set((s) => ({
    notifiedAreas: {
      ...s.notifiedAreas,
      [sensorId]: { status: 'failed', count: 0, total: 0 }
    }
  })),

  // Toasts
  toasts: [],
  addToast: (message) => {
    const id = Date.now();
    set((s) => ({ toasts: [...s.toasts, { id, message }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 5000);
  }
}));

export default useStore;
