import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { trackEvent } from '../lib/analytics'

interface Props {
  children: ReactNode
  fallbackMessage?: string
  /** Optional custom fallback. If provided, replaces the default inline fallback
   *  markup entirely. `fallbackMessage` is ignored when `fallback` is set. */
  fallback?: ReactNode
  /** When set, `componentDidCatch` fires a PostHog `runtime_error_boundary_catch`
   *  event tagged with this surface label (e.g. "runtime"). Existing canvas-side
   *  usage of ErrorBoundary leaves this unset and remains telemetry-free.
   *  Added Week 5 Day 0 (telemetry instrumentation). */
  telemetrySurface?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    if (this.props.telemetrySurface) {
      // First non-empty line of the component stack — the failing component
      // name + immediate parent. Sliced to keep PostHog property cardinality
      // bounded (full stacks vary per render and would explode unique values).
      const firstStackLine = (errorInfo.componentStack || '')
        .split('\n')
        .map(s => s.trim())
        .find(s => s.length > 0) || ''
      trackEvent('runtime_error_boundary_catch', {
        error_message: error.message.slice(0, 200),
        error_name: error.name,
        component_stack_first_line: firstStackLine.slice(0, 200),
        surface: this.props.telemetrySurface,
      })
    }
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback !== undefined) {
        return this.props.fallback
      }
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: 16,
          padding: 32,
          background: '#0A0A0A',
          color: '#e2e8f0',
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'rgba(248,113,113,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24,
          }}>
            !
          </div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#f1f5f9' }}>
            {this.props.fallbackMessage || 'Something went wrong'}
          </h3>
          <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', textAlign: 'center', maxWidth: 300 }}>
            An unexpected error occurred. Try reloading this section.
          </p>
          <button
            onClick={this.handleReload}
            style={{
              padding: '8px 20px',
              borderRadius: 8,
              background: 'rgba(99,102,241,0.15)',
              border: '1px solid rgba(99,102,241,0.3)',
              color: '#818cf8',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.25)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.15)' }}
          >
            Reload
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
