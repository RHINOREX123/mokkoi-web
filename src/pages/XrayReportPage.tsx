import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { XrayReport } from '../../lib/xray/types'
import { XRAY_CONTACT_EMAIL } from '../constants/xray'
import ReportView from './xray/ReportView'
import './xray-landing.css'

type State = { kind: 'loading' } | { kind: 'ready'; report: XrayReport; approvedAt: string | null } | { kind: 'missing' } | { kind: 'error' }

/** Shared report link: /r/:token. Only approved reports are served. */
export default function XrayReportPage() {
  const { token = '' } = useParams()
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let live = true
    fetch(`/api/xray?action=report&token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!live) return
        if (res.status === 404) return setState({ kind: 'missing' })
        if (!res.ok) return setState({ kind: 'error' })
        const j = (await res.json()) as { report: XrayReport; approved_at: string | null }
        setState({ kind: 'ready', report: j.report, approvedAt: j.approved_at })
      })
      .catch(() => live && setState({ kind: 'error' }))
    return () => {
      live = false
    }
  }, [token])

  useEffect(() => {
    if (state.kind === 'ready') document.title = `${state.report.target.title ?? 'Report'} | Mokkoi X-ray`
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [state])

  return (
    <div className="xr">
      <div className="xr-wrap xr-r-bar">
        <Link className="xr-logo" to="/">mokkoi<span aria-hidden="true" /></Link>
        {state.kind === 'ready' && (
          <span className="xr-r-bar-note">
            Private report. Anyone with this link can read it.{' '}
            <button type="button" className="xr-r-print" onClick={() => window.print()}>Save as PDF</button>
          </span>
        )}
      </div>
      {state.kind === 'loading' && <div className="xr-wrap xr-r-state" aria-busy="true"><p>Loading the report…</p></div>}
      {state.kind === 'missing' && (
        <div className="xr-wrap xr-r-state">
          <h1>This report isn't available.</h1>
          <p>The link may be mistyped, or the report hasn't been released yet. Check the link in your email, or write to <a href={`mailto:${XRAY_CONTACT_EMAIL}`}>{XRAY_CONTACT_EMAIL}</a>.</p>
        </div>
      )}
      {state.kind === 'error' && (
        <div className="xr-wrap xr-r-state">
          <h1>The report didn't load.</h1>
          <p>Refresh the page to try again. If it keeps failing, write to <a href={`mailto:${XRAY_CONTACT_EMAIL}`}>{XRAY_CONTACT_EMAIL}</a>.</p>
        </div>
      )}
      {state.kind === 'ready' && <ReportView report={state.report} approvedAt={state.approvedAt} />}
    </div>
  )
}
