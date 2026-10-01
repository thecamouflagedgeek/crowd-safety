import React, { useState } from 'react'
import { ArrowRight, ArrowUpRight, Radio, Gauge, Timer, Plus, Minus, Crosshair } from 'lucide-react'
import { IncidentLifecycle } from '../components/IncidentLifecycle'
import '../styles/propagation-orion.css'

const HUB_CONFIDENCE = 91

// Sources feeding INC001. Replace with backend data when ready.
const NODES = [
  { id: 'cctv1', label: 'CCTV 01', score: 94, signals: 1540, first: '18:08', color: '#6a5ae0',
    role: 'Optical flow detected the density surge at the gate concourse.',
    sats: [['Motion', 87], ['Density', 62], ['Flow', 34]] },
  { id: 'cctv2', label: 'CCTV 02', score: 90, signals: 1320, first: '18:19', color: '#8f7dff',
    role: 'Second camera triangulated the congestion on the perimeter.',
    sats: [['Overlap', 76], ['Density', 58], ['Flow', 41]] },
  { id: 'citizen', label: 'Citizen C014', score: 78, signals: 214, first: '18:17', color: '#ec6fb5',
    role: 'Field report from the Citizen App corroborating heavy crowding.',
    sats: [['Agree', 66], ['Geotag', 52], ['Recent', 31]] },
  { id: 'marshals', label: 'Marshals', score: 98, signals: 38, first: '18:05', color: '#14a366',
    role: 'Ground team radio call confirming crowding at the gate.',
    sats: [['Radio', 91], ['On site', 88], ['Detail', 64]] },
  { id: 'news', label: 'News N003', score: 74, signals: 27, first: '18:26', color: '#f59a1f',
    role: 'Wire coverage published after the incident was classified.',
    sats: [['Match', 59], ['Lag', 22], ['Cited', 38]] },
  { id: 'social', label: 'Social', score: 45, signals: 612, first: '18:19', color: '#ee5a7a',
    role: 'High volume, low reliability. Awaiting cross-check.',
    sats: [['Volume', 81], ['Dupes', 47], ['Bots?', 29]] }
]

const STEPS = [
  { time: '18:02', t: 'Optical inception', d: 'CCTV 01 & 02 detect surge' },
  { time: '18:17', t: 'Human signal', d: 'Citizen C014 corroborates' },
  { time: '18:21', t: 'Convergence hub', d: `INC001 synthesized at ${HUB_CONFIDENCE}%` },
  { time: '18:23', t: 'Authority validation', d: 'Gate 3 congestion verified' }
]

const tierOf = (p) => (p >= 90 ? { name: 'Verified', c: 'v' } : p >= 70 ? { name: 'Probable', c: 'p' } : { name: 'Unconfirmed', c: 'u' })

// Geometry (Lepus-style network: hub -> source -> metric rings -> signal leaves)
const CX = 500, CY = 380, RX = 290, RY = 190
const ANGLES = [-60, 0, 60, 120, 180, 240]
const rad = (a) => (a * Math.PI) / 180
const step = (x, y, a, d) => [x + d * Math.cos(rad(a)), y + d * Math.sin(rad(a))]
const fmt = (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`)
const WINDOWS = { '5m': 0.2, '15m': 0.5, '30m': 1, '1h': 1.7 }
const LAYOUT = NODES.map((n, i) => {
  const a = ANGLES[i]
  const x = CX + RX * Math.cos(rad(a))
  const y = CY + RY * Math.sin(rad(a))
  const dir = (Math.atan2(y - CY, x - CX) * 180) / Math.PI
  const rings = [dir - 38, dir + 38].map((ra, k) => {
    const [rx, ry] = step(x, y, ra, 108)
    const share = k === 0 ? 0.58 : 0.42
    const leaves = [ra - 35, ra + 35].map((la, j) => {
      const [lx, ly] = step(rx, ry, la, 72)
      return { x: lx, y: ly, share: share * (j === 0 ? 0.6 : 0.4) }
    })
    return { x: rx, y: ry, label: n.sats[k][0], val: n.sats[k][1], leaves }
  })
  return { ...n, x, y, rings }
})

const TOTAL_SIGNALS = NODES.reduce((a, n) => a + n.signals, 0)
const AVG_TRUST = Math.round(NODES.reduce((a, n) => a + n.score, 0) / NODES.length)
const BARS = Array.from({ length: 64 }, (_, i) =>
  Math.min(66, 18 + Math.round(Math.abs(Math.sin(i * 0.7) + Math.cos(i * 0.31)) * 20 + (i > 38 ? 14 : 0))))
const barColor = (i) => (i < 14 ? '#f59a1f' : i < 40 ? '#8ea3b5' : '#e4ff3b')

function Contours() {
  return (
    <svg className="ip-contours" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {Array.from({ length: 18 }).map((_, i) => (
        <ellipse
          key={i}
          cx={210 + Math.sin(i) * 14}
          cy={150 + Math.cos(i * 1.3) * 10}
          rx={26 + i * 17}
          ry={16 + i * 11}
          transform={`rotate(${-18 + i * 2.5} 210 150)`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
        />
      ))}
    </svg>
  )
}

export function InformationPropagationPage({ onNavigate }) {
  const [selId, setSelId] = useState('cctv1')
  const [win, setWin] = useState('30m')
  const [zoom, setZoom] = useState(1)
  const sel = LAYOUT.find((n) => n.id === selId) || LAYOUT[0]
  const tier = tierOf(sel.score)
  const pick = (id) => setSelId(id)
  const ranked = [...NODES].sort((a, b) => b.score - a.score)

  return (
    <div className="p4-workspace ip-page">
      {/* HEADER */}
      <div className="ip-head">
        <div>
          <span className="ip-kicker">CONVERGENCE GRAPH INTELLIGENCE</span>
          <h1 className="ip-title">
            <span className="ip-chip-w">Live trace</span>
            Information <b>propagation</b>
          </h1>
          <p className="ip-sub">Trace how reports and observations converged on INC001.</p>
        </div>
        <button className="ip-btn ink" onClick={() => onNavigate('/verification')}>
          <span>PROCEED TO VERIFICATION MATRIX</span>
          <ArrowRight size={14} />
        </button>
      </div>

      <IncidentLifecycle currentStep="INVESTIGATING" incidentId="INC001" />

      {/* HERO + TILES */}
      <div className="ip-hero-grid">
        <section className="ip-hero">
          <div className="ip-blob">
            <Contours />
            <div className="ip-num">
              <b>{TOTAL_SIGNALS.toLocaleString('en-IN')}</b>
              <sup>SIGNALS</sup>
            </div>
          </div>
          <div className="ip-hero-text">
            <span className="ip-tag">{HUB_CONFIDENCE}% CONVERGED</span>
            <h2>Signals traced on INC001</h2>
            <p>Last 30 min · {NODES.length} independent sources<br />All feeds synced to the convergence hub</p>
            <div className="ip-hero-actions">
              <button className="ip-btn ink" onClick={() => onNavigate('/verification')}>
                <span>CROSS-CHECK</span>
                <ArrowRight size={13} />
              </button>
              <button className="ip-btn light" onClick={() => onNavigate('/evidence')}>
                <span>EVIDENCE</span>
              </button>
            </div>
          </div>
        </section>

        <div className="ip-tile">
          <div className="ip-tile-top"><span>Sources linked</span><span className="ip-tile-arrow"><Radio size={16} /></span></div>
          <div className="ip-tile-val">{NODES.length}<small>feeds</small></div>
          <span className="ip-dots" />
        </div>
        <div className="ip-tile slate">
          <div className="ip-tile-top"><span>Average trust</span><span className="ip-tile-arrow"><Gauge size={16} /></span></div>
          <div className="ip-tile-val">{AVG_TRUST}<small>%</small></div>
          <span className="ip-dots" />
        </div>
        <div className="ip-tile">
          <div className="ip-tile-top"><span>Time to converge</span><span className="ip-tile-arrow"><Timer size={16} /></span></div>
          <div className="ip-tile-val">4<small>min</small></div>
          <span className="ip-dots" />
        </div>
      </div>

      {/* STORY STEPPER */}
      <section className="ip-story">
        <div className="ip-card-head">
          <div>
            <h3 className="ip-card-title">How the signal travelled</h3>
            <div className="ip-card-sub">From first camera detection to authority validation</div>
          </div>
        </div>
        <div className="ip-steps">
          {STEPS.map((s, i) => (
            <div className="ip-step" key={s.t}>
              <i>{i + 1}</i>
              <time>{s.time} IST</time>
              <b>{s.t}</b>
              <small>{s.d}</small>
            </div>
          ))}
        </div>
      </section>

      {/* MAIN GRID */}
      <div className="ip-grid">
        {/* LEFT */}
        <div className="ip-col">
          <div className="ip-card">
            <div className="ip-card-head" style={{ marginBottom: 10 }}>
              <div>
                <h3 className="ip-card-title">Quantity of signals</h3>
                <div className="ip-card-sub">Tap a source to inspect it</div>
              </div>
            </div>
            <table className="ip-tbl">
              <thead><tr><th>SOURCE</th><th>TRUST</th><th>SIGNALS</th></tr></thead>
              <tbody>
                {NODES.map((n) => (
                  <tr key={n.id} className={`row ${selId === n.id ? 'on' : ''}`} onClick={() => pick(n.id)}>
                    <td><span className="ip-dot" style={{ background: n.color }} />{n.label}</td>
                    <td>{n.score}%</td>
                    <td>{n.signals.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="ip-share" aria-hidden="true">
              {NODES.map((n) => <i key={n.id} style={{ width: `${(n.signals / TOTAL_SIGNALS) * 100}%`, background: n.color }} />)}
            </div>
            <p className="ip-share-note">Share of total signal volume by source</p>
          </div>
        </div>

        {/* CENTER: network (Lepus-style) */}
        <div className="ip-graph">
          <div className="ip-g-head">
            <div>
              <h3 className="ip-card-title">Convergence network</h3>
              <div className="ip-card-sub">Signals feeding INC001 · counts shown for the selected window</div>
            </div>
            <div className="ip-seg">
              {Object.keys(WINDOWS).map((w) => (
                <button key={w} className={win === w ? 'on' : ''} onClick={() => setWin(w)}>{w}</button>
              ))}
            </div>
          </div>

          <svg viewBox="0 0 1000 760" role="img" aria-label="Information convergence network for INC001">
            <defs>
              <radialGradient id="ipGlow" cx=".5" cy=".5" r=".5">
                <stop offset="0" stopColor="#e4ff3b" stopOpacity=".55" />
                <stop offset="1" stopColor="#e4ff3b" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="ipHubG" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#24313e" /><stop offset="1" stopColor="#0b1017" />
              </linearGradient>
              <radialGradient id="ipLime" cx=".35" cy=".3" r=".9">
                <stop offset="0" stopColor="#f6ffa0" /><stop offset=".55" stopColor="#e4ff3b" /><stop offset="1" stopColor="#c9e51f" />
              </radialGradient>
              <radialGradient id="ipInk" cx=".35" cy=".3" r=".9">
                <stop offset="0" stopColor="#3a4c5e" /><stop offset="1" stopColor="#0b1017" />
              </radialGradient>
            </defs>

            <g style={{ transform: `scale(${zoom})`, transformOrigin: `${CX}px ${CY}px`, transition: 'transform .35s ease' }}>
              <circle cx={CX} cy={CY} r="210" fill="url(#ipGlow)" />

              {/* edges */}
              {LAYOUT.map((n) => (
                <g key={`e-${n.id}`}>
                  {n.rings.map((r, k) => (
                    <g key={k}>
                      <line className="ip-edge soft" x1={n.x} y1={n.y} x2={r.x} y2={r.y} />
                      {r.leaves.map((l, j) => (
                        <line key={j} className="ip-edge soft" x1={r.x} y1={r.y} x2={l.x} y2={l.y} />
                      ))}
                    </g>
                  ))}
                  <line className={`ip-edge hub ${selId === n.id ? 'on' : ''}`} x1={CX} y1={CY} x2={n.x} y2={n.y} />
                </g>
              ))}

              {/* metric rings + signal leaves */}
              {LAYOUT.map((n) => (
                <g key={`s-${n.id}`}>
                  {n.rings.map((r, k) => (
                    <g key={k}>
                      {r.leaves.map((l, j) => {
                        const count = Math.max(1, Math.round(n.signals * l.share * WINDOWS[win]))
                        return (
                          <g key={j}>
                            <title>{`${n.label} · ${r.label}: ${count} signals`}</title>
                            <circle className="ip-leaf" cx={l.x} cy={l.y} r="25" />
                            <text className="ip-leaf-t" x={l.x} y={l.y + 4}>{fmt(count)}</text>
                          </g>
                        )
                      })}
                      <title>{`${n.label} · ${r.label} ${r.val}%`}</title>
                      <circle className={`ip-ring ${selId === n.id ? 'on' : ''}`} cx={r.x} cy={r.y} r="24" />
                      <text className="ip-ring-t" x={r.x} y={r.y + 4}>{r.val}%</text>
                    </g>
                  ))}
                </g>
              ))}

              {/* source nodes */}
              {LAYOUT.map((n) => {
                const on = selId === n.id
                return (
                  <g
                    key={n.id}
                    className={`ip-node ${on ? 'on' : ''}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`${n.label}, trust ${n.score}%`}
                    onClick={() => pick(n.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(n.id) } }}
                  >
                    <circle className="sph" cx={n.x} cy={n.y} r="52" fill={on ? 'url(#ipInk)' : 'url(#ipLime)'} />
                    {on && <circle className="ip-sel" cx={n.x} cy={n.y} r="62" />}
                    <text x={n.x} y={n.y - 8} style={{ fontSize: 11, fontWeight: 700, opacity: 0.8 }}>{n.label}</text>
                    <text x={n.x} y={n.y + 18} style={{ fontSize: 24, fontWeight: 800 }}>{n.score}%</text>
                  </g>
                )
              })}

              {/* hub */}
              <circle cx={CX} cy={CY} r="112" fill="none" stroke="#fff" strokeWidth="10" opacity=".9" />
              <circle
                cx={CX} cy={CY} r="112" fill="none" stroke="#a7cc08" strokeWidth="10" strokeLinecap="round"
                pathLength="100" strokeDasharray={`${HUB_CONFIDENCE} ${100 - HUB_CONFIDENCE}`}
                transform={`rotate(-90 ${CX} ${CY})`}
              />
              <circle cx={CX} cy={CY} r="96" fill="url(#ipHubG)" style={{ filter: 'drop-shadow(0 14px 26px rgba(11,16,23,.35))' }} />
              <text className="ip-hub-t1" x={CX} y={CY - 26}>INC001</text>
              <text className="ip-hub-t2" x={CX} y={CY + 14}>{HUB_CONFIDENCE}<tspan fontSize="18" dy="-14">%</tspan></text>
              <text className="ip-hub-t3" x={CX} y={CY + 38}>CONVERGED</text>
            </g>
          </svg>

          <div className="ip-g-legend">
            <span><i className="lg lime" />Source (trust)</span>
            <span><i className="lg ring" />Metric</span>
            <span><i className="lg leaf" />Signals</span>
          </div>

          <div className="ip-zoom">
            <button aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(1.4, +(z + 0.15).toFixed(2)))}><Plus size={16} /></button>
            <button aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.7, +(z - 0.15).toFixed(2)))}><Minus size={16} /></button>
            <button aria-label="Reset view" onClick={() => setZoom(1)}><Crosshair size={16} /></button>
          </div>
        </div>

        {/* RIGHT */}
        <div className="ip-col">
          <div className="ip-card slate">
            <span className={`ip-tier ${tier.c}`}>{tier.name.toUpperCase()}</span>
            <div className="ip-d-name">{sel.label}</div>
            <p className="ip-d-role">{sel.role}</p>

            <div className="ip-d-grid">
              <div><small>Trust</small><b>{sel.score}%</b></div>
              <div><small>First seen</small><b>{sel.first} IST</b></div>
              <div><small>Signals</small><b>{sel.signals.toLocaleString('en-IN')}</b></div>
              <div><small>Share</small><b>{Math.round((sel.signals / TOTAL_SIGNALS) * 100)}%</b></div>
            </div>

            {sel.sats.map(([l, v]) => (
              <div className="ip-meter" key={`${sel.id}-${l}`}>
                <div className="t"><span>{l}</span><span>{v}%</span></div>
                <span className="bar"><i style={{ width: `${v}%` }} /></span>
              </div>
            ))}

            <button className="ip-btn lime full" style={{ marginTop: 16 }} onClick={() => onNavigate('/verification')}>
              <span>CROSS-CHECK IN MATRIX</span>
              <ArrowRight size={13} />
            </button>
          </div>

          <div className="ip-card">
            <div className="ip-card-head" style={{ marginBottom: 12 }}>
              <div>
                <h3 className="ip-card-title">Trust ranking</h3>
                <div className="ip-card-sub">Most reliable first</div>
              </div>
            </div>
            <ul className="ip-rank">
              {ranked.map((n) => (
                <li key={n.id}>
                  <button className={selId === n.id ? 'on' : ''} onClick={() => pick(n.id)}>
                    <span>{n.label}</span>
                    <span className="trk"><i style={{ width: `${n.score}%` }} /></span>
                    <b>{n.score}%</b>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}