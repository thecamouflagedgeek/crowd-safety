import React from 'react'
import { Filter, Clock, MapPin, AlertTriangle, RefreshCw } from 'lucide-react'

export function IncidentSelectorBar({
  incidents = [],
  selectedIncident,
  onSelectIncident,
  timeRange = '18:00 — 18:30',
  onRefresh
}) {
  return (
    <div className="p4-control-bar">
      <div className="p4-selector-group">
        <div className="p4-selector-field">
          <Filter size={14} style={{ color: 'var(--p4-accent-blue)' }} />
          <span className="p4-field-label">Incident:</span>
          <select
            className="p4-select-dropdown"
            value={selectedIncident?.id || 'INC001'}
            onChange={(e) => {
              const found = incidents.find((i) => i.id === e.target.value)
              if (found) onSelectIncident(found)
            }}
          >
            {incidents.map((inc) => (
              <option key={inc.id} value={inc.id}>
                {inc.id} — {inc.type} ({inc.location})
              </option>
            ))}
          </select>
        </div>

        <div className="p4-selector-field">
          <MapPin size={14} style={{ color: 'var(--p4-accent-lime)' }} />
          <span className="p4-field-label">Location:</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>
            {selectedIncident?.location || 'Gate 3'}
          </span>
        </div>

        <div className="p4-selector-field">
          <Clock size={14} style={{ color: 'var(--p4-text-secondary)' }} />
          <span className="p4-field-label">Time Window:</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#cbd5e1', fontFamily: 'var(--p4-font-mono)' }}>
            {timeRange}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className={`p4-pill-badge ${selectedIncident?.severity === 'HIGH' ? 'red' : 'amber'}`}>
          <AlertTriangle size={12} style={{ display: 'inline', marginRight: 4 }} />
          {selectedIncident?.severity || 'HIGH'} SEVERITY
        </span>
        <span className="p4-pill-badge lime">
          {Math.round((selectedIncident?.confidence || 0.91) * 100)}% CONFIDENCE
        </span>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p4-cctv-btn"
            title="Refresh incident telemetry"
          >
            <RefreshCw size={13} />
          </button>
        )}
      </div>
    </div>
  )
}
