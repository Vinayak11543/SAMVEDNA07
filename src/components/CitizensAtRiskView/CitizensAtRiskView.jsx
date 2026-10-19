import React, { useState, useMemo, useCallback } from 'react';
import useStore from '../../store/useStore';
import { haversineKm } from '../../utils/formatters';

export default function CitizensAtRiskView() {
  const persons = useStore((s) => s.persons);
  const sensors = useStore((s) => s.sensors);
  const addToast = useStore((s) => s.addToast);
  const notifiedAreas = useStore((s) => s.notifiedAreas);
  const markAreaNotifying = useStore((s) => s.markAreaNotifying);
  const markAreaNotified = useStore((s) => s.markAreaNotified);
  const markAreaNotifyFailed = useStore((s) => s.markAreaNotifyFailed);
  const [search, setSearch] = useState('');

  // Assign each person to the nearest sensor/monitoring area
  const areaGroups = useMemo(() => {
    if (!sensors.length || !persons.length) return [];

    const areaMap = {};
    sensors.forEach((s) => {
      areaMap[s.id] = {
        sensorId: s.id,
        name: s.name,
        place: s.place,
        state: s.state,
        lat: s.lat,
        lng: s.lng,
        citizens: []
      };
    });

    persons.forEach((person) => {
      if (person.lat == null || person.lng == null) return;
      let minDist = Infinity;
      let nearestId = null;
      sensors.forEach((s) => {
        const d = haversineKm(person.lat, person.lng, s.lat, s.lng);
        if (d < minDist) {
          minDist = d;
          nearestId = s.id;
        }
      });
      if (nearestId && areaMap[nearestId]) {
        areaMap[nearestId].citizens.push(person);
      }
    });

    return Object.values(areaMap)
      .sort((a, b) => b.citizens.length - a.citizens.length);
  }, [sensors, persons]);

  // Filter by search
  const filteredGroups = useMemo(() => {
    if (!search.trim()) return areaGroups;
    const q = search.toLowerCase();
    return areaGroups
      .map((group) => {
        const areaMatch =
          group.name?.toLowerCase().includes(q) ||
          group.place?.toLowerCase().includes(q) ||
          group.state?.toLowerCase().includes(q);
        const matchedCitizens = group.citizens.filter(
          (p) =>
            p.name?.toLowerCase().includes(q) ||
            p.phone?.toLowerCase().includes(q) ||
            p.profession?.toLowerCase().includes(q) ||
            p.status?.toLowerCase().includes(q)
        );
        if (areaMatch) return group;
        if (matchedCitizens.length > 0) return { ...group, citizens: matchedCitizens };
        return null;
      })
      .filter(Boolean);
  }, [areaGroups, search]);

  const totalFiltered = useMemo(
    () => filteredGroups.reduce((sum, g) => sum + g.citizens.length, 0),
    [filteredGroups]
  );


  // Send one SMS to the phone configured on the SMSgate server environment.
  // The destination number is fixed on the server and cannot be supplied by the browser.
  const sendSmsToMyPhone = useCallback(async (message, pin) => {
    const response = await fetch('/api/send-sms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ pin, message })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || 'SMS request failed.');
    }

    return data;
  }, []);

  const handleNotifyPerson = useCallback(async (person) => {
    const pin = window.prompt('Enter your SMSgate alert PIN:');
    if (!pin) return;

    try {
      const result = await sendSmsToMyPhone(
        `SAMVEDNA ALERT: Notification requested for ${person.name}. Status: ${person.status || 'UNKNOWN'}. Please check the SAMVEDNA dashboard.`,
        pin
      );

      addToast(`SMS accepted by SMSgate for your phone. ID: ${result.smsId || 'queued'}.`);
    } catch (error) {
      addToast('SMS failed: ' + error.message);
    }
  }, [sendSmsToMyPhone, addToast]);

  const handleNotifyArea = useCallback(async (group) => {
    const pin = window.prompt('Enter your SMSgate alert PIN:');
    if (!pin) return;

    markAreaNotifying(group.sensorId);

    try {
      const result = await sendSmsToMyPhone(
        `SAMVEDNA DISASTER ALERT: Notification requested for ${group.name}, ${group.place}, ${group.state}. ${group.citizens.length} citizen records are listed in this monitoring area. Please check the dashboard.`,
        pin
      );

      // This status represents one SMS accepted for your phone, not messages sent to citizens.
      markAreaNotified(group.sensorId, 1);
      addToast(`SMS accepted by SMSgate for your phone. ID: ${result.smsId || 'queued'}.`);
    } catch (error) {
      markAreaNotifyFailed(group.sensorId);
      addToast('SMS failed: ' + error.message);
    }
  }, [
    sendSmsToMyPhone,
    markAreaNotifying,
    markAreaNotified,
    markAreaNotifyFailed,
    addToast
  ]);


  const getStatusBadge = (status) => {
    switch (status) {
      case 'IN ZONE':
        return <span className="citizen-badge badge-inzone">IN ZONE</span>;
      case 'NOTIFIED':
        return <span className="citizen-badge badge-notified">NOTIFIED</span>;
      case 'EVACUATED':
        return <span className="citizen-badge badge-evacuated">EVACUATED</span>;
      case 'SAFE':
      default:
        return <span className="citizen-badge badge-safe">SAFE</span>;
    }
  };

  return (
    <div className="citizens-view" id="citizens-view">
      <div className="citizens-header">
        <div className="citizens-header-left">
          <h2 className="citizens-title">Citizens at Risk Directory</h2>
          <span className="citizens-subtitle">
            Live civil protection registry — {totalFiltered} persons monitored across {filteredGroups.length} areas
          </span>
        </div>

        <div className="citizens-header-right">
          <div className="citizens-search-box">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search name, phone, profession, area..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              id="citizens-search-input"
            />
            {search && (
              <button className="search-clear-btn" onClick={() => setSearch('')}>×</button>
            )}
          </div>
        </div>
      </div>

      <div className="citizens-area-groups" id="citizens-area-groups">
        {filteredGroups.map((group) => {
          const areaNotif = notifiedAreas[group.sensorId];
          const isNotified = areaNotif?.status === 'notified';
          const isSending = areaNotif?.status === 'sending';
          const isFailed = areaNotif?.status === 'failed';
          const citizenCount = group.citizens.length;

          return (
            <div key={group.sensorId} className="citizen-area-section" id={'area-section-' + group.sensorId}>
              <div className="citizen-area-header">
                <div className="citizen-area-info">
                  <span className="citizen-area-name">{group.name}</span>
                  <span className="citizen-area-meta">
                    {group.place}, {group.state}
                  </span>
                  <span className="citizen-area-count">
                    {citizenCount} {citizenCount === 1 ? 'CITIZEN' : 'CITIZENS'}
                  </span>
                </div>

                <div className="citizen-area-actions">
                  {isNotified && (
                    <span className="area-notify-status notified">
                      SMS ACCEPTED FOR YOUR PHONE
                    </span>
                  )}
                  {isFailed && (
                    <span className="area-notify-status failed">LAST SMS FAILED</span>
                  )}
                  <button
                    className={'btn-notify-area' + (isSending ? ' sending' : '') + (isFailed ? ' retry' : '')}
                    onClick={() => handleNotifyArea(group)}
                    disabled={isSending}
                    id={'notify-area-' + group.sensorId}
                  >
                    {isSending ? 'SENDING SMS...' : isFailed ? 'RETRY SMS' : 'NOTIFY MY PHONE'}
                  </button>
                </div>
              </div>

              {citizenCount > 0 ? (
                <div className="citizens-grid">
                  {group.citizens.map((person) => (
                    <div
                      key={person.id}
                      className={'citizen-card' + (person.status === 'IN ZONE' ? ' in-hazard-zone' : '')}
                      id={'citizen-card-' + person.id}
                    >
                      <div className="citizen-card-header">
                        <div className="citizen-name-wrap">
                          <span className="citizen-name">{person.name}</span>
                          <span className="citizen-profession">{person.profession}</span>
                        </div>
                        {getStatusBadge(person.status)}
                      </div>

                      <div className="citizen-card-body">
                        <div className="citizen-info-row">
                          <span className="citizen-icon-label" style={{ fontSize: 10, opacity: 0.6 }}>TEL:</span>
                          <span className="citizen-phone">{person.phone}</span>
                        </div>
                        {person.distanceToImpact !== undefined && (
                          <div className="citizen-info-row">
                            <span className="citizen-icon-label" style={{ fontSize: 10, opacity: 0.6 }}>LOC:</span>
                            <span className="citizen-dist">
                              {person.distanceToImpact} km from epicenter
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="citizen-card-actions">
                        <button
                          className="btn-citizen-action"
                          onClick={() => handleNotifyPerson(person)}
                        >
                          Send SMS to My Phone
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="citizen-area-empty">
                  No citizens currently registered in this monitoring zone
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
