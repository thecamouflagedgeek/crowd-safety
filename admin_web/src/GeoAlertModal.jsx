import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Radio, Siren, X } from 'lucide-react'
import { API_BASE } from './p4/services/api'

const CELL = 0.05 // must match kZoneCellDeg in the Flutter app
const INTERVAL_S = 10
const zoneIdFor = (lat, lon) => `${Math.floor(lat / CELL)}_${Math.floor(lon / CELL)}`

const DEFAULT_MSG =
  'A high-risk public-safety incident is near your last known safety zone. Avoid the affected area and follow the official advisory.'

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(12,20,32,.55)', backdropFilter: 'blur(4px)',
  display: 'grid', placeItems: 'center', zIndex: 9999, padding: 16,
}
const card = {
  width: 'min(520px, 100%)', maxHeight: '92vh', overflow: 'auto', background: '#fff',
  borderRadius: 24, padding: 24, boxShadow: '0 30px 80px rgba(0,0,0,.35)', color: '#0e1a2b',
}
const label = { fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#64748b', marginBottom: 6, display: 'block' }
const input = { width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid #d7dde6', fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit' }

export default function GeoAlertButton({ incident }) {
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState('all') // incident | custom | all
  const [lat, setLat] = useState('19.0760')
  const [lon, setLon] = useState('72.8777')
  const [severity, setSeverity] = useState('HIGH')
  const [message, setMessage] = useState(DEFAULT_MSG)
  const [running, setRunning] = useState(false)
  const [sent, setSent] = useState(0)
  const [next, setNext] = useState(INTERVAL_S)
  const [error, setError] = useState('')

  const timer = useRef(null)
  const tick = useRef(null)
  const cfg = useRef({})

  // zone the alerts are addressed to
  const zone = useMemo(() => {
    if (target === 'all') return null
    const la = target === 'incident' ? Number(incident?.latitude) : Number(lat)
    const lo = target === 'incident' ? Number(incident?.longitude) : Number(lon)
    if (!Number.isFinite(la) || !Number.isFinite(lo)) return undefined // invalid
    return zoneIdFor(la, lo)
  }, [target, incident, lat, lon])

  // the interval always reads the latest values
  cfg.current = { zone, severity, message, incidentId: incident?.id }

  const sendOnce = useCallback(async () => {
    const c = cfg.current
    try {
      const r = await fetch(`${API_BASE}/broadcasts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: c.message,
          severity: c.severity,
          zone_id: c.zone ?? null,
          incident_id: c.incidentId ?? null,
        }),
      })
      if (!r.ok) throw new Error(String(r.status))
      setSent((n) => n + 1)
      setError('')
    } catch {
      setError('Could not reach the alert service. Will retry on the next tick.')
    }
  }, [])

  const stop = useCallback(() => {
    clearInterval(timer.current)
    clearInterval(tick.current)
    setRunning(false)
  }, [])

  const start = () => {
    if (zone === undefined) { setError('Enter a valid latitude and longitude.'); return }
    setError('')
    setSent(0)
    setRunning(true)
    setNext(INTERVAL_S)
    sendOnce()
    timer.current = setInterval(() => { sendOnce(); setNext(INTERVAL_S) }, INTERVAL_S * 1000)
    tick.current = setInterval(() => setNext((n) => (n > 1 ? n - 1 : INTERVAL_S)), 1000)
  }

  useEffect(() => () => { clearInterval(timer.current); clearInterval(tick.current) }, [])

  const targetNote =
    zone === null ? 'Every opted-in citizen'
    : zone === undefined ? 'Invalid location'
    : `Zone ${zone} (about 5 km cell)`

  const modal = open && createPortal(
    <div style={overlay} onClick={() => setOpen(false)}>
      <div style={card} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#d94452', fontWeight: 800, fontSize: 12, letterSpacing: '.08em' }}>
              <Siren size={16} /> RESILIENT GEO-ALERTS
            </div>
            <h2 style={{ margin: '6px 0 4px', fontSize: 22 }}>Send location-based alerts</h2>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b', lineHeight: 1.45 }}>
              Sends an alert every {INTERVAL_S} seconds. Only citizens who have turned on
              “Get alerts near my area” and whose current area is in the target zone will see it.
            </p>
          </div>
          <button onClick={() => setOpen(false)} aria-label="Close" style={{ background: 'none', border: 0, cursor: 'pointer', color: '#64748b' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ marginTop: 18 }}>
          <span style={label}>Target area</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              ['incident', incident ? `Selected incident` : 'Selected incident (none)'],
              ['custom', 'Custom location'],
              ['all', 'All opted-in'],
            ].map(([k, t]) => (
              <button
                key={k}
                disabled={running || (k === 'incident' && !incident)}
                onClick={() => setTarget(k)}
                style={{
                  padding: '8px 14px', borderRadius: 999, fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
                  border: '1px solid ' + (target === k ? '#0e1a2b' : '#d7dde6'),
                  background: target === k ? '#0e1a2b' : '#fff', color: target === k ? '#e4ff3b' : '#0e1a2b',
                  opacity: running || (k === 'incident' && !incident) ? .5 : 1,
                }}
              >{t}</button>
            ))}
          </div>

          {target === 'incident' && incident && (
            <p style={{ fontSize: 12.5, color: '#475569', margin: '8px 0 0' }}>
              {incident.type} · {incident.location} ({Number(incident.latitude).toFixed(4)}, {Number(incident.longitude).toFixed(4)})
            </p>
          )}
          {target === 'custom' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input style={input} disabled={running} value={lat} onChange={(e) => setLat(e.target.value)} placeholder="Latitude" />
              <input style={input} disabled={running} value={lon} onChange={(e) => setLon(e.target.value)} placeholder="Longitude" />
            </div>
          )}
          <p style={{ fontSize: 12, color: '#16a34a', fontWeight: 700, margin: '8px 0 0' }}>→ {targetNote}</p>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <div style={{ flex: '0 0 130px' }}>
            <span style={label}>Severity</span>
            <select style={input} disabled={running} value={severity} onChange={(e) => setSeverity(e.target.value)}>
              <option>HIGH</option><option>MEDIUM</option><option>LOW</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <span style={label}>Message</span>
            <textarea style={{ ...input, minHeight: 74, resize: 'vertical' }} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
        </div>

        {running && (
          <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 14, background: '#fff1f2', border: '1px solid #fecdd3', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, fontWeight: 700, color: '#be123c' }}>
            <span>● Broadcasting · {sent} sent</span>
            <span>Next in {next}s</span>
          </div>
        )}
        {error && <p style={{ color: '#d94452', fontSize: 12.5, margin: '10px 0 0' }}>{error}</p>}

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          {!running ? (
            <button onClick={start} style={{ flex: 1, padding: '13px 18px', borderRadius: 999, border: 0, background: '#d94452', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
              Start sending (every {INTERVAL_S}s)
            </button>
          ) : (
            <button onClick={stop} style={{ flex: 1, padding: '13px 18px', borderRadius: 999, border: 0, background: '#0e1a2b', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
              Stop
            </button>
          )}
          <button onClick={() => setOpen(false)} style={{ padding: '13px 18px', borderRadius: 999, border: '1px solid #d7dde6', background: '#fff', fontWeight: 700, cursor: 'pointer' }}>
            Close
          </button>
        </div>
        <p style={{ fontSize: 11.5, color: '#94a3b8', margin: '12px 0 0', lineHeight: 1.4 }}>
          Demo only. Alerts expire after 30 minutes. Closing this window does not stop sending, so use Stop.
        </p>
      </div>
    </div>,
    document.body
  )

  return (
    <>
      <button
        className="ev-btn ink"
        style={{ padding: '7px 14px', fontSize: 11, background: running ? '#d94452' : undefined, color: running ? '#fff' : undefined }}
        onClick={() => setOpen(true)}
      >
        {running ? <Radio size={12} /> : <Siren size={12} />}
        <span>{running ? `GEO-ALERTS LIVE · ${sent}` : 'SEND GEO-ALERTS'}</span>
      </button>
      {modal}
    </>
  )
}