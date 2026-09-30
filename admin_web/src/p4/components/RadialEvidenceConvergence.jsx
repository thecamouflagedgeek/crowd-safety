import React, { useState } from 'react'

export function RadialEvidenceConvergence({
  selectedNode,
  onSelectNode,
  density = 86,
  confidence = 91,
  incidentId = 'INC001'
}) {
  const [hoveredId, setHoveredId] = useState(null)

  // 2D flat monochromatic cluster matching the reference fan-out
  // Center is largest, rings decrease in size as they fan out
  const center = { x: 340, y: 250 }

  // Layer 1: Inner orbit (Medium-large bubbles, r=34-36)
  const primaryNodes = [
    {
      id: 'cctv_01',
      label: 'CCTV 01',
      sub: `${density}% Dens`,
      claim: 'Density rising steadily past 86% since 18:08',
      r: 36,
      x: 245,
      y: 165,
      bg: '#d8f344',
      border: '#142034',
      textColor: '#142034',
      layer: 1
    },
    {
      id: 'official_A001',
      label: 'Marshals R-4',
      sub: 'Verified',
      claim: 'Gate 3 congestion confirmed by on-ground marshals',
      r: 36,
      x: 435,
      y: 165,
      bg: '#eaf4bb',
      border: '#a7cc08',
      textColor: '#142034',
      layer: 1
    },
    {
      id: 'cctv_02',
      label: 'CCTV 02',
      sub: '0.19 m/s',
      claim: 'Exit flow bottleneck; movement velocity drop',
      r: 34,
      x: 240,
      y: 335,
      bg: '#fef08a',
      border: '#ca8a04',
      textColor: '#142034',
      layer: 1
    },
    {
      id: 'citizen_C014',
      label: 'Citizen C014',
      sub: '3 Reports',
      claim: 'Heavy crowd congestion near Gate 3 turnstiles',
      r: 35,
      x: 435,
      y: 330,
      bg: '#eff6ce',
      border: '#a7cc08',
      textColor: '#142034',
      layer: 1
    }
  ]

  // Layer 2: Intermediate orbit (Medium-small bubbles, r=23-25)
  const secondaryNodes = [
    {
      id: 'turnstiles_sensor',
      label: 'Turnstiles',
      sub: 'Flow -68%',
      claim: 'Automated turnstile flow dropped 68% below nominal capacity',
      r: 25,
      x: 340,
      y: 92,
      bg: '#fef9c3',
      border: '#ca8a04',
      textColor: '#142034',
      layer: 2
    },
    {
      id: 'news_N003',
      label: 'News N003',
      sub: 'Metro Wire',
      claim: 'Metro alerts unusually large evening crowd arriving',
      r: 25,
      x: 520,
      y: 250,
      bg: '#eff6ce',
      border: '#a7cc08',
      textColor: '#142034',
      layer: 2
    },
    {
      id: 'gate4_divert',
      label: 'Aux Gate 4',
      sub: 'Clear Exit',
      claim: 'Gate 4 operational; marshalling teams ready to divert',
      r: 24,
      x: 340,
      y: 408,
      bg: '#eaf4bb',
      border: '#a7cc08',
      textColor: '#142034',
      layer: 2
    },
    {
      id: 'social_S021',
      label: 'Social S021',
      sub: '28 Posts',
      claim: 'Social media mentions long queue at Gate 3',
      r: 24,
      x: 160,
      y: 250,
      bg: '#fef08a',
      border: '#ca8a04',
      textColor: '#142034',
      layer: 2
    }
  ]

  // Layer 3: Outer orbit (Smaller indicator bubbles, r=14-16)
  const tertiaryNodes = [
    { id: 'spike_1808', label: '18:08', sub: 'Spike', r: 16, x: 175, y: 120, bg: '#fef9c3', border: '#eab308' },
    { id: 'gps_tag', label: 'GPS', sub: '±4m', r: 15, x: 505, y: 125, bg: '#eff6ce', border: '#a7cc08' },
    { id: 'tailback_45m', label: '45m', sub: 'Queue', r: 15, x: 170, y: 380, bg: '#eaf4bb', border: '#a7cc08' },
    { id: 'radio_log', label: 'Radio', sub: '18:21', r: 15, x: 510, y: 375, bg: '#fef08a', border: '#ca8a04' },
    { id: 'base_normal', label: '18:02', sub: 'Normal', r: 14, x: 265, y: 75, bg: '#fefce8', border: '#ca8a04' },
    { id: 'upvotes_count', label: '+3', sub: 'Upvotes', r: 14, x: 420, y: 80, bg: '#eff6ce', border: '#a7cc08' }
  ]

  // Layer 4: Outermost orbit (Tiny accent bubbles, r=6-8, completing the fan-out gradient)
  const speckNodes = [
    { id: 'sp1', r: 8, x: 95, y: 170, bg: '#d8f344', border: '#a7cc08' },
    { id: 'sp2', r: 7, x: 90, y: 330, bg: '#fef08a', border: '#ca8a04' },
    { id: 'sp3', r: 8, x: 585, y: 175, bg: '#eaf4bb', border: '#a7cc08' },
    { id: 'sp4', r: 7, x: 590, y: 320, bg: '#eff6ce', border: '#a7cc08' },
    { id: 'sp5', r: 8, x: 485, y: 445, bg: '#fef9c3', border: '#eab308' },
    { id: 'sp6', r: 7, x: 195, y: 440, bg: '#fef08a', border: '#ca8a04' },
    { id: 'sp7', r: 6, x: 340, y: 470, bg: '#d8f344', border: '#a7cc08' },
    { id: 'sp8', r: 6, x: 340, y: 32, bg: '#eaf4bb', border: '#a7cc08' }
  ]

  const allInteractiveNodes = [...primaryNodes, ...secondaryNodes]
  const hoveredNode = allInteractiveNodes.find(n => n.id === hoveredId)

  return (
    <div style={{ position: 'relative', width: '100%', minHeight: 460, display: 'flex', flexDirection: 'column' }}>
      <svg
        viewBox="0 0 680 500"
        style={{ width: '100%', height: 'auto', maxHeight: 490, userSelect: 'none' }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Soft circular backdrop plate from Orion reference image */}
        <circle
          cx={center.x}
          cy={center.y}
          r={205}
          fill="#fbfcf8"
          stroke="#edf2e8"
          strokeWidth="1.5"
        />

        {/* Concentric subtle radar rings */}
        <circle cx={center.x} cy={center.y} r={245} fill="none" stroke="#f0f5ec" strokeWidth="1" strokeDasharray="4 6" />
        <circle cx={center.x} cy={center.y} r={175} fill="none" stroke="#e6eee0" strokeWidth="1.2" />
        <circle cx={center.x} cy={center.y} r={115} fill="none" stroke="#dbe7d3" strokeWidth="1.2" strokeDasharray="3 4" />
        <circle cx={center.x} cy={center.y} r={65} fill="none" stroke="#cddcc2" strokeWidth="1" />

        {/* Delicate spokes connecting Layer 1 to center */}
        {primaryNodes.map((node) => {
          const isSelected = selectedNode?.id === node.id
          const isHovered = hoveredId === node.id

          return (
            <line
              key={`spoke-${node.id}`}
              x1={center.x}
              y1={center.y}
              x2={node.x}
              y2={node.y}
              stroke={isSelected || isHovered ? '#142034' : '#d2dfca'}
              strokeWidth={isSelected || isHovered ? 2 : 1.2}
              strokeDasharray={isSelected ? 'none' : '3 4'}
            />
          )
        })}

        {/* Delicate spokes connecting Layer 2 to Layer 1 */}
        {secondaryNodes.map((sec) => (
          <line
            key={`sec-line-${sec.id}`}
            x1={center.x}
            y1={center.y}
            x2={sec.x}
            y2={sec.y}
            stroke="#e0ebd8"
            strokeWidth="1"
            strokeDasharray="2 3"
          />
        ))}

        {/* Layer 4: Tiny accent bubbles (Fan-out perimeter) */}
        {speckNodes.map((sp) => (
          <circle
            key={sp.id}
            cx={sp.x}
            cy={sp.y}
            r={sp.r}
            fill={sp.bg}
            stroke={sp.border}
            strokeWidth="1"
            opacity="0.8"
          />
        ))}

        {/* Layer 3: Smaller indicator bubbles (Outer ring) */}
        {tertiaryNodes.map((node) => (
          <g
            key={node.id}
            className="p4-bubble-node"
            style={{ transformOrigin: `${node.x}px ${node.y}px` }}
          >
            <circle
              cx={node.x}
              cy={node.y}
              r={node.r}
              fill={node.bg}
              stroke={node.border}
              strokeWidth="1.2"
            />
            <text
              x={node.x}
              y={node.y - 1}
              fontSize="7"
              fontFamily="Manrope, sans-serif"
              fontWeight="800"
              fill="#142034"
              textAnchor="middle"
            >
              {node.label}
            </text>
            <text
              x={node.x}
              y={node.y + 6}
              fontSize="6"
              fontFamily="'DM Sans', sans-serif"
              fontWeight="700"
              fill="#445262"
              textAnchor="middle"
            >
              {node.sub}
            </text>
          </g>
        ))}

        {/* Layer 2: Intermediate ring bubbles */}
        {secondaryNodes.map((node) => {
          const isSelected = selectedNode?.id === node.id
          const isHovered = hoveredId === node.id

          return (
            <g
              key={node.id}
              className="p4-bubble-node"
              style={{ transformOrigin: `${node.x}px ${node.y}px` }}
              onClick={() => onSelectNode(node)}
              onMouseEnter={() => setHoveredId(node.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {(isSelected || isHovered) && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.r + 5}
                  fill="none"
                  stroke="#142034"
                  strokeWidth="2"
                  strokeDasharray="3 3"
                />
              )}
              <circle
                cx={node.x}
                cy={node.y}
                r={node.r}
                fill={node.bg}
                stroke={node.border}
                strokeWidth={isSelected ? 2.5 : 1.8}
              />
              <text
                x={node.x}
                y={node.y - 2}
                fontSize="8.5"
                fontFamily="Manrope, sans-serif"
                fontWeight="800"
                fill={node.textColor}
                textAnchor="middle"
              >
                {node.label}
              </text>
              <text
                x={node.x}
                y={node.y + 7}
                fontSize="7"
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

        {/* Layer 1: Medium-large primary bubbles */}
        {primaryNodes.map((node) => {
          const isSelected = selectedNode?.id === node.id
          const isHovered = hoveredId === node.id

          return (
            <g
              key={node.id}
              className="p4-bubble-node"
              style={{ transformOrigin: `${node.x}px ${node.y}px` }}
              onClick={() => onSelectNode(node)}
              onMouseEnter={() => setHoveredId(node.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {(isSelected || isHovered) && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.r + 6}
                  fill="none"
                  stroke="#142034"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                />
              )}
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
                y={node.y - 3}
                fontSize="10.5"
                fontFamily="Manrope, sans-serif"
                fontWeight="800"
                fill={node.textColor}
                textAnchor="middle"
              >
                {node.label}
              </text>
              <text
                x={node.x}
                y={node.y + 9}
                fontSize="8.5"
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

        {/* Layer 0: Central Core Disc (Largest in the fan-out cluster) */}
        <g
          className="p4-bubble-node"
          style={{ transformOrigin: `${center.x}px ${center.y}px` }}
          onClick={() =>
            onSelectNode({
              id: incidentId,
              label: 'INC001 SURGE',
              claim: `Multi-camera computer vision crowd surge detected at Gate 3. Density: ${density}%. Confidence: ${confidence}%.`,
              status: 'CRITICAL',
              type: 'incident',
              timestamp: '18:18'
            })
          }
        >
          {/* Subtle outer halo ring */}
          <circle
            cx={center.x}
            cy={center.y}
            r={59}
            fill="none"
            stroke="#d8f344"
            strokeWidth="2.5"
            strokeDasharray="5 3"
          />

          {/* Central 2D Ink Circle */}
          <circle
            cx={center.x}
            cy={center.y}
            r={52}
            fill="#142034"
            stroke="#d8f344"
            strokeWidth="3"
          />

          {/* Center Text */}
          <text
            x={center.x}
            y={center.y - 12}
            fontSize="9"
            fontFamily="Manrope, sans-serif"
            fontWeight="800"
            fill="#d8f344"
            letterSpacing="0.1em"
            textAnchor="middle"
          >
            GATE 3 CORE
          </text>
          <text
            x={center.x}
            y={center.y + 6}
            fontSize="16"
            fontFamily="Manrope, sans-serif"
            fontWeight="800"
            fill="#ffffff"
            textAnchor="middle"
          >
            {density}% DENS
          </text>
          <text
            x={center.x}
            y={center.y + 22}
            fontSize="8.5"
            fontFamily="'DM Sans', sans-serif"
            fontWeight="700"
            fill="#a5b4c6"
            textAnchor="middle"
          >
            {confidence}% Confidence
          </text>
        </g>
      </svg>

      {/* Selected or Hovered Node Forensic Detail Card */}
      {(selectedNode || hoveredNode) && (
        <div style={{
          marginTop: 6,
          background: 'var(--surface-soft)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="p4-pill-badge yellow" style={{ fontSize: 9, padding: '2px 8px' }}>
                {(selectedNode || hoveredNode).label}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink)' }}>
                {(selectedNode || hoveredNode).sub || 'Forensic Stream'}
              </span>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: 11.5, color: 'var(--ink-secondary)', lineHeight: 1.35 }}>
              {(selectedNode || hoveredNode).claim}
            </p>
          </div>
          <span style={{ fontSize: 10, fontWeight: 800, color: '#116b4b', background: '#aee6ca', padding: '3px 8px', borderRadius: 8, whiteSpace: 'nowrap' }}>
            VERIFIED
          </span>
        </div>
      )}
    </div>
  )
}
