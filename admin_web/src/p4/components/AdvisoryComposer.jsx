import React, { useState, useEffect } from 'react'
import {
  Send,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Loader2,
  Users
} from 'lucide-react'
import { SEEDED_ADVISORIES } from '../services/mockData'
import { publishAdvisoryRequest, fetchAdvisoriesList } from '../services/api'

/* ---------- Aesthetic tokens (styling only) ---------- */
const CARD = {
  background: '#ffffff',
  border: '1px solid var(--border-light)',
  borderRadius: 28,
  padding: 28,
  boxShadow: 'none',
  display: 'flex',
  flexDirection: 'column',
  gap: 20
}

const CARD_TITLE = {
  margin: 0,
  fontSize: 20,
  fontWeight: 600,
  letterSpacing: '-0.01em',
  color: 'var(--ink)',
  textTransform: 'none'
}

const CARD_SUBTITLE = {
  fontSize: 13,
  color: 'var(--ink-muted)',
  marginTop: 4
}

const FIELD_LABEL = {
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--ink-secondary)',
  textTransform: 'none',
  letterSpacing: 0
}

const FIELD_INPUT = {
  borderRadius: 16,
  padding: '12px 16px'
}

export function AdvisoryComposer({
  incidentId = 'INC001',
  initialMessage,
  onAdvisoryPublished
}) {
  const [selectedIncident, setSelectedIncident] = useState(incidentId)
  const [severity, setSeverity] = useState('HIGH')
  const [location, setLocation] = useState('Gate 3')
  const [message, setMessage] = useState(
    initialMessage || 'Severe congestion detected near Gate 3. Avoid the area until further notice.'
  )
  const [isPublishing, setIsPublishing] = useState(false)
  const [publishedAlert, setPublishedAlert] = useState(null)
  const [advisoryHistory, setAdvisoryHistory] = useState(SEEDED_ADVISORIES)

  useEffect(() => {
    fetchAdvisoriesList(incidentId).then((res) => {
      if (res.data) setAdvisoryHistory(res.data)
    })
  }, [incidentId])

  // The verification workspace can hand us a prefilled advisory message.
  useEffect(() => {
    if (initialMessage) setMessage(initialMessage)
  }, [initialMessage])

  const templates = [
    {
      title: 'Congestion Warning',
      text: 'Severe congestion detected near Gate 3. Avoid the area until further notice.',
      sev: 'HIGH'
    },
    {
      title: 'Gate Diversion',
      text: 'Gate 3 entry restricted due to high crowd density. Please proceed smoothly to Gate 4 North.',
      sev: 'HIGH'
    },
    {
      title: 'Situation Normalizing',
      text: 'Crowd conditions at Gate 3 are stabilizing. All turnstiles operating normally with managed flow.',
      sev: 'LOW'
    }
  ]

  const handlePublish = async (e) => {
    e.preventDefault()
    if (!message.trim()) return

    setIsPublishing(true)
    const payload = {
      incident_id: selectedIncident,
      severity,
      location,
      message,
      issued_by: 'Public Safety Command Authority'
    }

    const result = await publishAdvisoryRequest(payload)
    setIsPublishing(false)

    setPublishedAlert(result.data)
    setAdvisoryHistory((prev) => [result.data, ...prev])

    if (onAdvisoryPublished) {
      onAdvisoryPublished(result.data)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Published Banner if just published */}
      {publishedAlert && (
        <div style={{
          background: 'var(--lime-badge)',
          border: 'none',
          borderRadius: 28,
          padding: '20px 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          boxShadow: 'none'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: '#ffffff',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--lime-deep)'
            }}>
              <CheckCircle2 size={22} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <b style={{ color: 'var(--ink)', fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em' }}>
                  Advisory published successfully
                </b>
                <span className="p4-pill-badge green">ACTIVE ON CITIZEN APP</span>
              </div>
              <span style={{ fontSize: 13, color: 'var(--ink-secondary)' }}>
                Broadcast ID: <b>{publishedAlert.id}</b> · Target: <b>{publishedAlert.location}</b> ({publishedAlert.severity}) · Timestamp: <b>{publishedAlert.timestamp} IST</b>
              </span>
            </div>
          </div>
          <button
            className="p4-outline-btn"
            style={{ padding: '8px 18px', borderRadius: 999, background: '#ffffff' }}
            onClick={() => setPublishedAlert(null)}
          >
            DISMISS
          </button>
        </div>
      )}

      {/* 2-Column: Composer (Left) & Citizen Preview (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 20, alignItems: 'start' }}>
        {/* Left: Composer */}
        <div className="p4-panel-box" style={CARD}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <h3 className="p4-box-title" style={CARD_TITLE}>
                Compose advisory
              </h3>
              <div style={CARD_SUBTITLE}>Write what citizens will see, then publish it to the broadcast network</div>
            </div>
            <span className="p4-badge-tag">AUTHORITY DISPATCH</span>
          </div>

          <form onSubmit={handlePublish} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={FIELD_LABEL}>Target incident</label>
                <input
                  type="text"
                  className="p4-clean-input"
                  style={FIELD_INPUT}
                  value={selectedIncident}
                  onChange={(e) => setSelectedIncident(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={FIELD_LABEL}>Affected location</label>
                <input
                  type="text"
                  className="p4-clean-input"
                  style={FIELD_INPUT}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={FIELD_LABEL}>Severity level</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    style={{
                      flex: 1,
                      padding: '10px 0',
                      borderRadius: 999,
                      border: '1px solid',
                      borderColor: severity === lvl ? 'var(--ink)' : 'var(--border)',
                      background: severity === lvl ? 'var(--ink)' : '#ffffff',
                      color: severity === lvl ? 'var(--lime)' : 'var(--ink)',
                      fontWeight: 700,
                      fontSize: 11,
                      letterSpacing: '0.04em',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onClick={() => setSeverity(lvl)}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Presets */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={FIELD_LABEL}>Quick situation presets</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {templates.map((tmpl) => (
                  <button
                    key={tmpl.title}
                    type="button"
                    className="p4-outline-btn"
                    style={{ fontSize: 12, padding: '8px 16px', borderRadius: 999, background: '#ffffff' }}
                    onClick={() => {
                      setMessage(tmpl.text)
                      setSeverity(tmpl.sev)
                    }}
                  >
                    + {tmpl.title}
                  </button>
                ))}
              </div>
            </div>

            {/* Message Body */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={FIELD_LABEL}>
                Advisory text (citizen facing)
              </label>
              <textarea
                className="p4-clean-textarea"
                style={{ ...FIELD_INPUT, borderRadius: 20, padding: '14px 18px', lineHeight: 1.5 }}
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Compose clear, actionable safety instructions for citizens..."
              />
              <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                {message.length} / 280 characters · High priority emergency broadcast
              </span>
            </div>

            {/* Publish Button */}
            <button
              type="submit"
              className="p4-ink-btn"
              style={{ padding: '16px', fontSize: 13, justifyContent: 'center', borderRadius: 999 }}
              disabled={isPublishing || !message.trim()}
            >
              {isPublishing ? (
                <>
                  <Loader2 size={16} className="p4-spin" />
                  <span>TRANSMITTING ADVISORY TO BROADCAST NETWORK...</span>
                </>
              ) : (
                <>
                  <Send size={16} />
                  <span>PUBLISH ADVISORY NOW</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right: Live Citizen Preview */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          position: 'sticky',
          top: 90
        }}>
          {/* Preview label */}
          <div style={{
            background: 'linear-gradient(145deg, #ffffff, #fcfdfa)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--panel-radius)',
            padding: '20px',
            boxShadow: 'var(--card-shadow)',
            display: 'flex',
            flexDirection: 'column',
            gap: 14
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span className="p4-badge-tag" style={{ marginBottom: 6 }}>CITIZEN BROADCAST PREVIEW</span>
                <h3 className="p4-box-title" style={{ marginTop: 4, fontSize: 14 }}>Live preview</h3>
              </div>
              <Users size={18} style={{ color: 'var(--ink-muted)' }} />
            </div>

            {/* Phone mockup preview card */}
            <div style={{
              background: severity === 'CRITICAL' || severity === 'HIGH' ? '#fff1f2' : severity === 'MEDIUM' ? '#fffbeb' : '#f0fdf4',
              border: `1.5px solid ${severity === 'CRITICAL' || severity === 'HIGH' ? '#fecaca' : severity === 'MEDIUM' ? '#fde68a' : '#bbf7d0'}`,
              borderLeft: `4px solid ${severity === 'CRITICAL' || severity === 'HIGH' ? '#ef4444' : severity === 'MEDIUM' ? '#f59e0b' : '#22c55e'}`,
              borderRadius: 16,
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10
            }}>
              {/* Alert header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  color: severity === 'CRITICAL' || severity === 'HIGH' ? '#991b1b' : severity === 'MEDIUM' ? '#92400e' : '#166534',
                  textTransform: 'uppercase',
                  background: severity === 'CRITICAL' || severity === 'HIGH' ? '#fecaca' : severity === 'MEDIUM' ? '#fde68a' : '#bbf7d0',
                  padding: '3px 8px',
                  borderRadius: 8
                }}>
                  ⚠ {severity} SEVERITY
                </span>
                <span style={{ fontSize: 9, color: 'var(--ink-muted)', fontWeight: 600, marginLeft: 'auto' }}>
                  Vigil ALERT
                </span>
              </div>

              {/* Incident + Location */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--ink-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  {selectedIncident} · {location}
                </span>
              </div>

              {/* Message */}
              <p style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--ink)',
                lineHeight: 1.5,
                fontFamily: 'var(--font-body)'
              }}>
                {message || 'Advisory message will appear here...'}
              </p>

              {/* Footer */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 4, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                <span style={{ fontSize: 10, color: 'var(--ink-muted)', fontWeight: 600 }}>
                  Public Safety Command Authority · Just now
                </span>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-muted)', lineHeight: 1.4 }}>
              This preview reflects exactly what citizens will receive on the Vigil citizen app and digital signage boards.
            </p>
          </div>

          {/* Reach estimate */}
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 18,
            padding: '14px 18px',
            boxShadow: 'var(--card-shadow)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10
          }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--ink-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Broadcast reach
            </span>
            {[
              { label: 'Citizen app users (nearby)', value: '4,200+' },
              { label: 'Digital signage boards', value: '12 active' },
              { label: 'Emergency SMS relay', value: 'Enabled' }
            ].map((item) => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                <span style={{ color: 'var(--ink-secondary)' }}>{item.label}</span>
                <b style={{ color: 'var(--ink)', fontWeight: 700 }}>{item.value}</b>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Advisory History Section */}
      <div className="p4-panel-box" style={CARD}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h3 className="p4-box-title" style={CARD_TITLE}>
              Published advisory log
            </h3>
            <div style={CARD_SUBTITLE}>Chronological registry of all official broadcasts</div>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="p4-clean-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Incident</th>
                <th>Severity</th>
                <th>Location</th>
                <th>Advisory message</th>
                <th>Published at</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {advisoryHistory.map((adv, idx) => (
                <tr key={adv.id || idx}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 800 }}>{adv.id}</td>
                  <td><b style={{ color: 'var(--ink)' }}>{adv.incident_id}</b></td>
                  <td>
                    <span className={`p4-pill-badge ${adv.severity === 'CRITICAL' || adv.severity === 'HIGH' ? 'red' : 'amber'}`}>
                      {adv.severity}
                    </span>
                  </td>
                  <td>{adv.location}</td>
                  <td style={{ maxWidth: 360, color: 'var(--ink)' }}>"{adv.message}"</td>
                  <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--lime-deep)' }}>
                    {adv.timestamp || '18:23'} IST
                  </td>
                  <td>
                    <span className="p4-pill-badge green">● {adv.status || 'PUBLISHED'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}