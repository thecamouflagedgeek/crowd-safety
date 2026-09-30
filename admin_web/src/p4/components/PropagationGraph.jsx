import React, { useState } from 'react'
import {
  Filter,
  X
} from 'lucide-react'
import { GRAPH_NETWORK } from '../services/mockData'

export function PropagationGraph({
  data = GRAPH_NETWORK,
  onSelectNode,
  onNavigateVerify
}) {
  const [activeFilter, setActiveFilter] = useState('ALL')
  const [selectedNode, setSelectedNode] = useState(data.nodes.find(n => n.id === 'cctv_01') || data.nodes[0])
  const [hoveredId, setHoveredId] = useState(null)

  // 2D flat monochromatic yellow palette
  const center = { x: 370, y: 260 }

  const networkNodes = [
    {
      id: 'INC001',
      label: 'INC001 CORE',
      sub: 'Crowd Anomaly',
      type: 'incident',
      r: 58,
      x: center.x,
      y: center.y,
      bg: '#142034',
      border: '#d8f344',
      textColor: '#ffffff',
      status: 'ACTIVE',
      confidence: 0.91,
      claim: 'Multi-camera computer vision crowd surge detected at Gate 3'
    },
    {
      id: 'cctv_01',
      label: 'CCTV 01',
      sub: '86% Dens',
      type: 'cctv',
      r: 42,
      x: 230,
      y: 130,
      bg: '#eaf4bb',
      border: '#a7cc08',
      textColor: '#142034',
      status: 'VERIFIED',
      credibility: 0.94,
      location: 'Gate 3 Concourse',
      timestamp: '18:08',
      claim: 'Density rising steadily past 86%',
      satellites: [
        { id: 'sat-1', label: '18:02', sub: 'Baseline', r: 18, dx: -45, dy: -26, bg: '#fef9c3', border: '#ca8a04', floatClass: 'p4-float-node-1' },
        { id: 'sat-2', label: 'Spike', sub: '18:08', r: 19, dx: -55, dy: 20, bg: '#fef08a', border: '#eab308', floatClass: 'p4-float-node-2' }
      ]
    },
    {
      id: 'cctv_02',
      label: 'CCTV 02',
      sub: '0.19 m/s',
      type: 'cctv',
      r: 40,
      x: 210,
      y: 380,
      bg: '#fef08a',
      border: '#ca8a04',
      textColor: '#142034',
      status: 'VERIFIED',
      credibility: 0.90,
      location: 'Gate 3 Perimeter',
      timestamp: '18:19',
      claim: 'Exit flow bottleneck; velocity at 0.19 m/s',
      satellites: [
        { id: 'sat-3', label: 'Tailback', sub: '45m', r: 19, dx: -45, dy: 26, bg: '#eaf4bb', border: '#a7cc08', floatClass: 'p4-float-node-3' }
      ]
    },
    {
      id: 'citizen_C014',
      label: 'Citizen C014',
      sub: 'Field Report',
      type: 'citizen',
      r: 44,
      x: 510,
      y: 130,
      bg: '#fef9c3',
      border: '#ca8a04',
      textColor: '#142034',
      status: 'VERIFIED',
      credibility: 0.78,
      location: 'Gate 3 Turnstiles',
      timestamp: '18:17',
      claim: 'Heavy crowd congestion near Gate 3',
      satellites: [
        { id: 'sat-4', label: 'GPS Geotag', sub: '±4m', r: 20, dx: 45, dy: -36, bg: '#eff6ce', border: '#a7cc08', floatClass: 'p4-float-node-2' },
        { id: 'sat-5', label: '3 Upvotes', sub: 'Verified', r: 19, dx: 60, dy: 16, bg: '#fef08a', border: '#ca8a04', floatClass: 'p4-float-node-1' }
      ]
    },
    {
      id: 'official_A001',
      label: 'Marshals R-4',
      sub: 'Authority',
      type: 'official',
      r: 44,
      x: 550,
      y: 280,
      bg: '#d8f344',
      border: '#142034',
      textColor: '#142034',
      status: 'VERIFIED',
      credibility: 0.98,
      location: 'Gate 3 Booth',
      timestamp: '18:21',
      claim: 'On-ground marshal confirmation of crowd rush',
      satellites: [
        { id: 'sat-6', label: 'Radio Confirmed', sub: '18:21', r: 20, dx: 54, dy: -24, bg: '#fef08a', border: '#ca8a04', floatClass: 'p4-float-node-3' }
      ]
    },
    {
      id: 'news_N003',
      label: 'News N003',
      sub: 'Wire Bulletin',
      type: 'news',
      r: 39,
      x: 480,
      y: 410,
      bg: '#eff6ce',
      border: '#c3db29',
      textColor: '#142034',
      status: 'SUPPORTING',
      credibility: 0.74,
      location: 'North Metro Zone',
      timestamp: '18:20',
      claim: 'Large evening crowd arriving from North Metro',
      satellites: [
        { id: 'sat-7', label: 'Metro Feed', sub: '18:20', r: 18, dx: 45, dy: 24, bg: '#fef9c3', border: '#eab308', floatClass: 'p4-float-node-1' }
      ]
    },
    {
      id: 'social_S021',
      label: 'Social S021',
      sub: '28 Mentions',
      type: 'social',
      r: 37,
      x: 120,
      y: 250,
      bg: '#fef9c3',
      border: '#eab308',
      textColor: '#142034',
      status: 'UNVERIFIED',
      credibility: 0.45,
      location: 'Gate 3 Public',
      timestamp: '18:18',
      claim: 'Posts complaining about turnstile delay',
      satellites: [
        { id: 'sat-8', label: '#Rush', sub: '18:18', r: 17, dx: -38, dy: -22, bg: '#fef08a', border: '#ca8a04', floatClass: 'p4-float-node-2' }
      ]
    }
  ]

  const filteredNodes = networkNodes.filter(node => {
    if (node.type === 'incident') return true
    if (activeFilter === 'ALL') return true
    if (activeFilter === 'CCTV') return node.type === 'cctv'
    if (activeFilter === 'VERIFIED') return node.status === 'VERIFIED'
    if (activeFilter === 'UNVERIFIED') return node.status === 'UNVERIFIED'
    return true
  })

  return (
    <div className="p4-bubble-cluster-box" style={{ height: 560 }}>
      {/* Top Filter Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#ffffff', padding: '6px 14px', borderRadius: 16, border: '1px solid var(--border)' }}>
          <Filter size={13} style={{ color: 'var(--ink)' }} />
          <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink-secondary)' }}>FILTER NETWORK:</span>
          {['ALL', 'CCTV', 'VERIFIED', 'UNVERIFIED'].map((tab) => (
            <button
              key={tab}
              style={{
                background: activeFilter === tab ? 'var(--ink)' : 'transparent',
                color: activeFilter === tab ? 'var(--lime)' : 'var(--ink-secondary)',
                border: 'none',
                padding: '4px 10px',
                borderRadius: 10,
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onClick={() => setActiveFilter(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <span className="p4-pill-badge yellow">● MULTI-SOURCE CONVERGENCE</span>
          <span className="p4-pill-badge green">MONOCHROMATIC 2D VIEW</span>
        </div>
      </div>

      {/* 2D Monochromatic Bubble SVG Network */}
      <svg
        viewBox="0 0 740 500"
        style={{ width: '100%', height: '100%', userSelect: 'none' }}
      >
        {/* Subtle background radar circles */}
        <circle cx={center.x} cy={center.y} r={230} fill="none" stroke="#edf2e8" strokeWidth="1.5" />
        <circle cx={center.x} cy={center.y} r={160} fill="none" stroke="#e2ebd8" strokeWidth="1.2" strokeDasharray="4 6" />
        <circle cx={center.x} cy={center.y} r={95} fill="none" stroke="#d5e3cb" strokeWidth="1" />

        {/* Connecting Lines between Sources and Incident */}
        {filteredNodes.filter(n => n.type !== 'incident').map((node) => {
          const isSelected = selectedNode?.id === node.id
          const isHovered = hoveredId === node.id

          return (
            <g key={`spoke-${node.id}`}>
              <line
                x1={center.x}
                y1={center.y}
                x2={node.x}
                y2={node.y}
                stroke={isSelected || isHovered ? '#142034' : '#ccd9c4'}
                strokeWidth={isSelected || isHovered ? 2.5 : 1.5}
                strokeDasharray={node.status === 'VERIFIED' ? 'none' : '3 4'}
              />

              {/* Sub-spokes to satellites */}
              {node.satellites && node.satellites.map((sat) => (
                <line
                  key={`sat-line-${sat.id}`}
                  x1={node.x}
                  y1={node.y}
                  x2={node.x + sat.dx}
                  y2={node.y + sat.dy}
                  stroke="#d7e3ce"
                  strokeWidth="1.2"
                />
              ))}
            </g>
          )
        })}

        {/* Floating 2D Satellite Nodes */}
        {filteredNodes.filter(n => n.satellites).map((node) =>
          node.satellites.map((sat) => {
            const sx = node.x + sat.dx
            const sy = node.y + sat.dy

            return (
              <g
                key={sat.id}
                className="p4-bubble-node"
                style={{ transformOrigin: `${sx}px ${sy}px` }}
              >
                <circle
                  cx={sx}
                  cy={sy}
                  r={sat.r}
                  fill={sat.bg}
                  stroke={sat.border}
                  strokeWidth="1.3"
                />
                <text
                  x={sx}
                  y={sy - 2}
                  fontSize="7.5"
                  fontFamily="Manrope, sans-serif"
                  fontWeight="800"
                  fill="#142034"
                  textAnchor="middle"
                >
                  {sat.label}
                </text>
                <text
                  x={sx}
                  y={sy + 7}
                  fontSize="6.5"
                  fontFamily="'DM Sans', sans-serif"
                  fontWeight="600"
                  fill="#445262"
                  textAnchor="middle"
                >
                  {sat.sub}
                </text>
              </g>
            )
          })
        )}

        {/* 2D Primary Yellow Source Nodes */}
        {filteredNodes.filter(n => n.type !== 'incident').map((node) => {
          const isSelected = selectedNode?.id === node.id
          const isHovered = hoveredId === node.id

          return (
            <g
              key={node.id}
              className="p4-2d-bubble"
              style={{ transformOrigin: `${node.x}px ${node.y}px` }}
              onClick={() => {
                setSelectedNode(node)
                if (onSelectNode) onSelectNode(node)
              }}
              onMouseEnter={() => setHoveredId(node.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {/* Active selection ring */}
              {(isSelected || isHovered) && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.r + 7}
                  fill="none"
                  stroke="#142034"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                />
              )}

              {/* 2D Flat Circle */}
              <circle
                cx={node.x}
                cy={node.y}
                r={node.r}
                fill={node.bg}
                stroke={node.border}
                strokeWidth={isSelected ? 3 : 2}
              />

              <text
                x={node.x}
                y={node.y - 4}
                fontSize="11"
                fontFamily="Manrope, sans-serif"
                fontWeight="800"
                fill={node.textColor}
                textAnchor="middle"
              >
                {node.label}
              </text>
              <text
                x={node.x}
                y={node.y + 11}
                fontSize="9"
                fontFamily="'DM Sans', sans-serif"
                fontWeight="700"
                fill="#445262"
                textAnchor="middle"
              >
                {node.sub}
              </text>
            </g>
          )
        })}

        {/* Center INC001 Bubble */}
        <g style={{ transformOrigin: `${center.x}px ${center.y}px` }}>
          <circle
            cx={center.x}
            cy={center.y}
            r={66}
            fill="none"
            stroke="#d8f344"
            strokeWidth="2"
            opacity="0.6"
          />

          <circle
            cx={center.x}
            cy={center.y}
            r={58}
            fill="#142034"
            stroke="#d8f344"
            strokeWidth="3.5"
          />

          <text
            x={center.x}
            y={center.y - 18}
            fontSize="9"
            fontFamily="Manrope, sans-serif"
            fontWeight="800"
            letterSpacing="0.1em"
            fill="#d8f344"
            textAnchor="middle"
          >
            INC001 CORE
          </text>

          <text
            x={center.x}
            y={center.y + 8}
            fontSize="26"
            fontFamily="Manrope, sans-serif"
            fontWeight="800"
            fill="#ffffff"
            textAnchor="middle"
          >
            86%
          </text>

          <text
            x={center.x}
            y={center.y + 24}
            fontSize="8.5"
            fontFamily="'DM Sans', sans-serif"
            fontWeight="700"
            fill="#eaf4bb"
            textAnchor="middle"
          >
            GATE 3 · HIGH RISK
          </text>
        </g>
      </svg>

      {/* Floating Node Telemetry Inspector */}
      {selectedNode && (
        <aside
          style={{
            position: 'absolute',
            top: 16,
            right: 18,
            bottom: 16,
            width: 285,
            background: 'rgba(255, 255, 255, 0.98)',
            border: '1px solid var(--border)',
            borderRadius: 20,
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            zIndex: 20,
            boxShadow: '0 12px 30px rgba(20, 32, 52, 0.1)',
            overflowY: 'auto'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="p4-badge-tag">{selectedNode.type ? selectedNode.type.toUpperCase() : 'SOURCE'} INSPECTOR</span>
            <button
              className="p4-close-btn"
              style={{ width: 26, height: 26 }}
              onClick={() => setSelectedNode(null)}
            >
              <X size={14} />
            </button>
          </div>

          <div>
            <h4 style={{ margin: '0 0 2px', fontSize: 16, fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--font-title)' }}>
              {selectedNode.label}
            </h4>
            <span style={{ fontSize: 11, color: 'var(--ink-muted)' }}>
              Node ID: <b>{selectedNode.id}</b>
            </span>
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span className={`p4-pill-badge ${selectedNode.status === 'VERIFIED' ? 'green' : 'amber'}`}>
              ● {selectedNode.status || 'ACTIVE'}
            </span>
            <span className="p4-pill-badge yellow">
              {Math.round((selectedNode.credibility || selectedNode.confidence || 0.85) * 100)}% RELIABILITY
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--ink-muted)', textTransform: 'uppercase' }}>
              Reported Observation
            </span>
            <div style={{
              background: 'var(--surface-soft)',
              borderLeft: '3px solid var(--lime-border)',
              padding: '10px 12px',
              borderRadius: '0 12px 12px 0',
              fontSize: 12,
              lineHeight: 1.45,
              color: 'var(--ink)'
            }}>
              "{selectedNode.claim || 'Primary incident detection: multi-camera crowd density spike'}"
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11 }}>
            <div style={{ background: 'var(--surface-soft)', padding: 8, borderRadius: 12, border: '1px solid var(--border)' }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--ink-muted)' }}>LOCATION</span>
              <div style={{ color: 'var(--ink)', fontWeight: 700, marginTop: 2 }}>
                {selectedNode.location || 'Gate 3'}
              </div>
            </div>
            <div style={{ background: 'var(--surface-soft)', padding: 8, borderRadius: 12, border: '1px solid var(--border)' }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--ink-muted)' }}>TIMESTAMP</span>
              <div style={{ color: 'var(--ink)', fontWeight: 700, marginTop: 2 }}>
                {selectedNode.timestamp || '18:21'}
              </div>
            </div>
          </div>

          {onNavigateVerify && (
            <button
              className="p4-ink-btn"
              style={{ marginTop: 'auto', width: '100%', justifyContent: 'center' }}
              onClick={() => onNavigateVerify(selectedNode)}
            >
              <span>Cross-Check in Verification</span>
            </button>
          )}
        </aside>
      )}
    </div>
  )
}
