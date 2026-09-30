import React, { useState, useEffect } from 'react'
import {
  Bell,
  Send,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Smartphone,
  ShieldAlert,
  Loader2,
  Users
} from 'lucide-react'
import { SEEDED_ADVISORIES } from '../services/mockData'
import { publishAdvisoryRequest, fetchAdvisoriesList } from '../services/api'

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
    fetchAdvisoriesList().then((res) => {
      if (res.data) setAdvisoryHistory(res.data)
    })
  }, [])

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
          border: '1px solid #d4e595',
          borderRadius: 'var(--panel-radius)',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          boxShadow: 'var(--card-shadow)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: '#ffffff',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--lime-deep)'
            }}>
              <CheckCircle2 size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <b style={{ color: 'var(--ink)', fontSize: 14 }}>✓ ADVISORY PUBLISHED SUCCESSFULLY</b>
                <span className="p4-pill-badge green">ACTIVE ON CITIZEN APP</span>
              </div>
              <span style={{ fontSize: 12, color: 'var(--ink-secondary)' }}>
                Broadcast ID: <b>{publishedAlert.id}</b> · Target: <b>{publishedAlert.location}</b> ({publishedAlert.severity}) · Timestamp: <b>{publishedAlert.timestamp} IST</b>
              </span>
            </div>
          </div>
          <button
            className="p4-outline-btn"
            style={{ padding: '6px 12px' }}
            onClick={() => setPublishedAlert(null)}
          >
            DISMISS
          </button>
        </div>
      )}

      {/* 2-Column: Composer (Left) & Mobile Citizen Preview (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 20 }}>
        {/* Left: Composer */}
        <div className="p4-panel-box">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bell size={18} style={{ color: 'var(--ink)' }} />
              <h3 className="p4-box-title">
                OFFICIAL ADVISORY COMPOSER
              </h3>
            </div>
            <span className="p4-badge-tag">AUTHORITY DISPATCH</span>
          </div>

          <form onSubmit={handlePublish} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--ink-muted)', textTransform: 'uppercase' }}>Target Incident</label>
                <input
                  type="text"
                  className="p4-clean-input"
                  value={selectedIncident}
                  onChange={(e) => setSelectedIncident(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--ink-muted)', textTransform: 'uppercase' }}>Affected Location</label>
                <input
                  type="text"
                  className="p4-clean-input"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--ink-muted)', textTransform: 'uppercase' }}>Severity Level</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    style={{
                      flex: 1,
                      padding: '7px 0',
                      borderRadius: 12,
                      border: '1px solid',
                      borderColor: severity === lvl ? 'var(--ink)' : 'var(--border)',
                      background: severity === lvl ? 'var(--ink)' : 'var(--surface-soft)',
                      color: severity === lvl ? 'var(--lime)' : 'var(--ink)',
                      fontWeight: 700,
                      fontSize: 11,
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--ink-muted)', textTransform: 'uppercase' }}>Quick Situation Presets</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {templates.map((tmpl) => (
                  <button
                    key={tmpl.title}
                    type="button"
                    className="p4-outline-btn"
                    style={{ fontSize: 11, padding: '5px 12px', borderRadius: 14 }}
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--ink-muted)', textTransform: 'uppercase' }}>
                Official Advisory Text (Citizen Facing)
              </label>
              <textarea
                className="p4-clean-textarea"
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Compose clear, actionable safety instructions for citizens..."
              />
              <span style={{ fontSize: 10, color: 'var(--ink-muted)' }}>
                Characters: {message.length} / 280 · High priority emergency broadcast
              </span>
            </div>

            {/* Publish Button */}
            <button
              type="submit"
              className="p4-ink-btn"
              style={{ padding: '14px', fontSize: 13, justifyContent: 'center' }}
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

        {/* Right: Realistic Citizen Mobile App Live Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px' }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--ink)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Smartphone size={13} style={{ color: 'var(--ink)' }} />
              CITIZEN APP LIVE PREVIEW
            </span>
            <span style={{ fontSize: 10, color: 'var(--ink-muted)' }}>Real-time sync</span>
          </div>

          <div style={{
            background: '#ffffff',
            border: '3px solid var(--border)',
            borderRadius: 36,
            padding: 16,
            boxShadow: 'var(--card-shadow)',
            maxWidth: 340,
            margin: '0 auto',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 14
          }}>
            <div style={{ width: 50, height: 4, background: '#cbd5e1', borderRadius: 2, margin: '0 auto' }} />

            <div style={{
              background: 'var(--surface-soft)',
              borderRadius: 22,
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              minHeight: 380,
              border: '1px solid var(--border)'
            }}>
              {/* Phone Status Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>
                <span>18:23</span>
                <span>5G 📶 98%</span>
              </div>

              {/* Citizen App Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                <ShieldAlert size={18} style={{ color: 'var(--ink)' }} />
                <div>
                  <b style={{ color: 'var(--ink)', fontSize: 12 }}>SURAKSHA CITIZEN</b>
                  <small style={{ display: 'block', fontSize: 9, color: 'var(--ink-muted)' }}>Public Safety Notification</small>
                </div>
              </div>

              {/* Floating Emergency Push Notification */}
              <div style={{
                background: '#ffffff',
                border: '1px solid #ffd7da',
                borderRadius: 16,
                padding: 14,
                boxShadow: '0 4px 14px rgba(239, 68, 68, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, color: '#99212e', fontSize: 11 }}>
                    <AlertTriangle size={13} />
                    <span>🚨 SAFETY ADVISORY</span>
                  </div>
                  <span className={`p4-pill-badge ${severity === 'CRITICAL' || severity === 'HIGH' ? 'red' : 'amber'}`} style={{ fontSize: 8 }}>
                    {severity}
                  </span>
                </div>

                <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--ink)', fontWeight: 600 }}>
                  {message || 'Advisory text preview will appear here in real time as you compose...'}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 9, color: 'var(--ink-muted)', borderTop: '1px solid var(--border-light)', paddingTop: 6 }}>
                  <span>Event Authority</span>
                  <span style={{ color: 'var(--lime-deep)', fontWeight: 700 }}>JUST NOW</span>
                </div>
              </div>

              {/* Simulated app context */}
              <div style={{ marginTop: 'auto', background: '#ffffff', padding: 10, borderRadius: 14, fontSize: 10, color: 'var(--ink-secondary)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink)', fontWeight: 700, marginBottom: 2 }}>
                  <Users size={12} />
                  <span>Geofence Radius: 1.5 km</span>
                </div>
                <span>All citizens in the Gate 3 zone receive immediate notification and route recommendations.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Advisory History Section */}
      <div className="p4-panel-box">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 className="p4-box-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={16} style={{ color: 'var(--ink)' }} />
            PUBLISHED ADVISORY AUDIT LOG
          </h3>
          <span style={{ fontSize: 11, color: 'var(--ink-muted)' }}>
            Chronological registry of all official broadcasts
          </span>
        </div>

        <table className="p4-clean-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>INCIDENT</th>
              <th>SEVERITY</th>
              <th>LOCATION</th>
              <th>ADVISORY MESSAGE</th>
              <th>PUBLISHED AT</th>
              <th>STATUS</th>
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
                <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-secondary)' }}>
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
  )
}
