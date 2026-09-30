import React from 'react'
import { Clock, Shield, Video, Users, CheckCircle, Info } from 'lucide-react'

export function EvidenceTimeline({
  events = [],
  selectedEvent,
  onSelectEvent
}) {
  const getSourceIcon = (sourceType = '') => {
    switch (sourceType.toUpperCase()) {
      case 'CCTV':
        return <Video size={13} style={{ color: 'var(--p4-accent-lime)' }} />
      case 'CITIZEN':
        return <Users size={13} style={{ color: 'var(--p4-accent-amber)' }} />
      case 'AUTHORITY':
      case 'OFFICIAL':
        return <Shield size={13} style={{ color: 'var(--p4-accent-blue)' }} />
      default:
        return <Info size={13} style={{ color: 'var(--p4-text-secondary)' }} />
    }
  }

  const getSeverityBadgeClass = (sev = '') => {
    switch (sev.toUpperCase()) {
      case 'HIGH':
      case 'CRITICAL':
        return 'p4-pill-badge red'
      case 'MEDIUM':
        return 'p4-pill-badge amber'
      default:
        return 'p4-pill-badge lime'
    }
  }

  return (
    <div className="p4-timeline-container">
      <div className="p4-section-header">
        <h3 className="p4-section-title">
          <Clock size={16} style={{ color: 'var(--p4-accent-lime)' }} />
          CHRONOLOGICAL RECONSTRUCTION TIMELINE
        </h3>
        <span style={{ fontSize: 11, color: 'var(--p4-text-secondary)' }}>
          Click an event node to inspect synchronized evidence & forensic metadata
        </span>
      </div>

      <div className="p4-timeline-stream">
        {events.map((evt) => {
          const isSelected = selectedEvent?.id === evt.id

          return (
            <div
              key={evt.id}
              className={`p4-timeline-node ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelectEvent(evt)}
            >
              <div className="p4-timeline-pin" />

              <div className="p4-node-time">
                {evt.time || evt.timestamp}
              </div>

              <div className="p4-node-body">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="p4-node-title">{evt.event}</span>
                  {evt.severity && (
                    <span className={getSeverityBadgeClass(evt.severity)}>
                      {evt.severity}
                    </span>
                  )}
                </div>
                <div className="p4-node-source" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {getSourceIcon(evt.sourceType || evt.source)}
                  <span>Source: {evt.source}</span>
                  {evt.detail && (
                    <span style={{ color: 'var(--p4-text-muted)' }}>
                      — {evt.detail.slice(0, 75)}...
                    </span>
                  )}
                </div>
              </div>

              <div className="p4-node-badges">
                <span className="p4-pill-badge green" style={{ fontSize: 9 }}>
                  <CheckCircle size={10} style={{ display: 'inline', marginRight: 3 }} />
                  VERIFIED
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
