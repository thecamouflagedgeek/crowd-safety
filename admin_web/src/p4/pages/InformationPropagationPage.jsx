import React, { useState, useEffect } from 'react'
import {
  Share2,
  ArrowRight
} from 'lucide-react'
import { IncidentLifecycle } from '../components/IncidentLifecycle'
import { PropagationGraph } from '../components/PropagationGraph'
import { fetchSourceGraph } from '../services/api'
import { GRAPH_NETWORK } from '../services/mockData'

export function InformationPropagationPage({ onNavigate, incidentId = 'INC001' }) {
  const [graphData, setGraphData] = useState(GRAPH_NETWORK)

  useEffect(() => {
    let live = true
    fetchSourceGraph(incidentId || 'INC001').then((res) => {
      if (live && res.data) setGraphData(res.data)
    })
    return () => { live = false }
  }, [incidentId])

  return (
    <div className="p4-workspace">
      {/* Header */}
      <div className="p4-page-header">
        <div className="p4-header-info">
          <span className="p4-badge-tag">CONVERGENCE GRAPH INTELLIGENCE</span>
          <h1 className="p4-page-title">
            <Share2 size={24} style={{ color: 'var(--p4-accent-lime)' }} />
            INFORMATION PROPAGATION
          </h1>
          <p className="p4-page-subtitle">
            Trace how reports and observations converged on {incidentId || 'INC001'}.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="p4-btn p4-btn-primary"
            style={{ width: 'auto', padding: '9px 16px', fontSize: 11 }}
            onClick={() => onNavigate('/verification')}
          >
            <span>PROCEED TO VERIFICATION MATRIX</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* Incident Lifecycle Strip */}
      <IncidentLifecycle currentStep="INVESTIGATING" incidentId={incidentId || 'INC001'} />

      {/* The Story / Flow Kicker */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 12,
        background: 'rgba(13, 21, 36, 0.7)',
        padding: '12px 18px',
        borderRadius: 12,
        border: '1px solid var(--p4-panel-border)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(59, 130, 246, 0.2)', display: 'grid', placeItems: 'center', color: '#60a5fa', fontWeight: 800, fontSize: 12 }}>
            1
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>Optical Inception</div>
            <div style={{ fontSize: 10, color: 'var(--p4-text-muted)' }}>CCTV 01 & 02 detect surge</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(245, 158, 11, 0.2)', display: 'grid', placeItems: 'center', color: '#fbbf24', fontWeight: 800, fontSize: 12 }}>
            2
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>Human Signal</div>
            <div style={{ fontSize: 10, color: 'var(--p4-text-muted)' }}>Citizen report C014 corroborates</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(163, 230, 53, 0.2)', display: 'grid', placeItems: 'center', color: '#bef264', fontWeight: 800, fontSize: 12 }}>
            3
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>Convergence Hub</div>
            <div style={{ fontSize: 10, color: 'var(--p4-text-muted)' }}>INC001 synthesized at 91%</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(16, 185, 129, 0.2)', display: 'grid', placeItems: 'center', color: '#34d399', fontWeight: 800, fontSize: 12 }}>
            4
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>Authority Validation</div>
            <div style={{ fontSize: 10, color: 'var(--p4-text-muted)' }}>Gate 3 congestion verified</div>
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
