import React, { useState, useEffect } from 'react'
import {
  Share2,
  ArrowRight
} from 'lucide-react'
import { IncidentLifecycle } from '../components/IncidentLifecycle'
import { PropagationGraph } from '../components/PropagationGraph'
import { fetchSourceGraph } from '../services/api'
import { GRAPH_NETWORK } from '../services/mockData'

export function InformationPropagationPage({ onNavigate }) {
  const [graphData, setGraphData] = useState(GRAPH_NETWORK)

  useEffect(() => {
    fetchSourceGraph('INC001').then((res) => {
      if (res.data) setGraphData(res.data)
    })
  }, [])

  return (
    <div className="p4-workspace">
      {/* Header */}
      <div className="p4-page-header">
        <div className="p4-header-info">
          <span className="p4-badge-tag">CONVERGENCE GRAPH INTELLIGENCE</span>
          <h1 className="p4-page-title">
            <Share2 size={24} style={{ color: 'var(--ink)' }} />
            INFORMATION PROPAGATION
          </h1>
          <p className="p4-page-subtitle">
            Trace how reports and observations converged on INC001.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="p4-ink-btn"
            onClick={() => onNavigate('/verification')}
          >
            <span>PROCEED TO VERIFICATION MATRIX</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* Incident Lifecycle Strip */}
      <IncidentLifecycle currentStep="INVESTIGATING" incidentId="INC001" />

      {/* The Story / Flow Kicker */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 12,
        background: 'var(--surface)',
        padding: '14px 20px',
        borderRadius: 'var(--panel-radius)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--card-shadow)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--lime-soft)', display: 'grid', placeItems: 'center', color: 'var(--lime-deep)', fontWeight: 800, fontSize: 13, border: '1px solid var(--lime-border)' }}>
            1
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink)' }}>Optical Inception</div>
            <div style={{ fontSize: 11, color: 'var(--ink-secondary)' }}>CCTV 01 & 02 detect surge</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: '#fef3c7', display: 'grid', placeItems: 'center', color: '#92400e', fontWeight: 800, fontSize: 13, border: '1px solid #fde68a' }}>
            2
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink)' }}>Human Signal</div>
            <div style={{ fontSize: 11, color: 'var(--ink-secondary)' }}>Citizen C014 corroborates</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--lime-soft)', display: 'grid', placeItems: 'center', color: 'var(--lime-deep)', fontWeight: 800, fontSize: 13, border: '1px solid var(--lime-border)' }}>
            3
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink)' }}>Convergence Hub</div>
            <div style={{ fontSize: 11, color: 'var(--ink-secondary)' }}>INC001 synthesized at 91%</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: '#d1fae5', display: 'grid', placeItems: 'center', color: '#065f46', fontWeight: 800, fontSize: 13, border: '1px solid #a7f3d0' }}>
            4
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink)' }}>Authority Validation</div>
            <div style={{ fontSize: 11, color: 'var(--ink-secondary)' }}>Gate 3 congestion verified</div>
          </div>
        </div>
      </div>

      {/* Dynamic Graph Visualizer */}
      <PropagationGraph
        data={graphData}
        onNavigateVerify={() => onNavigate('/verification')}
      />
    </div>
  )
}
