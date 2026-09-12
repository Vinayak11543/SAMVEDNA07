import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import useStore from '../store/useStore';
import { initClientSimulation } from '../data/clientSimulator';

const WS_URL = import.meta.env.VITE_WS_URL || '';

export default function useSocket() {
  const socketRef = useRef(null);
  const {
    setConnected, setAlerts, addAlert,
    updateSensors, setPersons, setUnits, addToast,
    markAreaNotified, markAreaNotifyFailed
  } = useStore();

  useEffect(() => {
    let cleanupSim = null;

    // Start client simulation immediately as baseline/fallback for standalone / Vercel deployment
    cleanupSim = initClientSimulation({
      setConnected,
      setAlerts,
      addAlert,
      updateSensors,
      setPersons,
      setUnits
    });

    // Provide a resilient fallback socketRef.current that handles emit in standalone mode
    const mockSocket = {
      emit: (event, data) => {
        if (event === 'notify:area') {
          const areaName = data?.areaName || 'Sector';
          const count = data?.citizenIds?.length || data?.count || 12;
          markAreaNotified(data?.sensorId, count);
          addToast(`Emergency SMS alert broadcast to ${count} citizens in ${areaName}`);
        } else if (event === 'dispatch:area') {
          addToast(`Units dispatched to ${data?.areaName || 'Monitoring Area'} successfully`);
        } else if (event === 'dispatch:all') {
          addToast('Full network emergency dispatch triggered');
        }
      }
    };
    socketRef.current = mockSocket;

    // If a remote or local WebSocket URL is configured, connect to it
    if (WS_URL) {
      try {
        const socket = io(WS_URL, {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionDelay: 2000,
          timeout: 4000
        });

        socket.on('connect', () => {
          console.log('Connected to remote telemetry server:', WS_URL);
          setConnected(true);
          // When connected to a real server, stop local simulation
          if (cleanupSim) {
            cleanupSim();
            cleanupSim = null;
          }
          socketRef.current = socket;
        });

        socket.on('disconnect', () => {
          console.log('Disconnected from server, reverting to local simulation');
          socketRef.current = mockSocket;
          if (!cleanupSim) {
            cleanupSim = initClientSimulation({
              setConnected,
              setAlerts,
              addAlert,
              updateSensors,
              setPersons,
              setUnits
            });
          }
        });

        socket.on('init', (data) => {
          if (data.alerts) setAlerts(data.alerts);
          if (data.sensors) updateSensors(data.sensors);
          if (data.persons) setPersons(data.persons);
          if (data.units) setUnits(data.units);
        });

        socket.on('sensors:update', (sensors) => {
          updateSensors(sensors);
        });

        socket.on('units:update', (units) => {
          setUnits(units);
        });

        socket.on('persons:update', (persons) => {
          setPersons(persons);
        });

        socket.on('alert:new', (alert) => {
          addAlert(alert);
        });

        socket.on('notification:sent', (data) => {
          addToast(data.message + ' (' + data.count + ' people)');
        });

        socket.on('notification:area:sent', (data) => {
          if (data.success && data.sensorId) {
            markAreaNotified(data.sensorId, data.count);
            addToast('Alert sent to ' + data.count + ' citizens in ' + data.areaName);
          } else if (data.sensorId) {
            markAreaNotifyFailed(data.sensorId);
            addToast('Failed to notify citizens in ' + data.areaName);
          }
        });

        return () => {
          if (cleanupSim) cleanupSim();
          socket.disconnect();
        };
      } catch (err) {
        console.warn('Socket connection error, running standalone mode:', err);
      }
    }

    return () => {
      if (cleanupSim) cleanupSim();
    };
  }, [setConnected, setAlerts, addAlert, updateSensors, setPersons, setUnits, addToast, markAreaNotified, markAreaNotifyFailed]);

  return socketRef;
}