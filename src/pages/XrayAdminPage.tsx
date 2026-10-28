import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { PLAN_LABELS, type OrderWithReport, type StoredReport, type XrayOrderStatus } from '../../lib/xray/types'
import ReportView from './xray/ReportView'
import './xray-landing.css'
import './xray/admin.css'

const TOKEN_KEY = 'xray-admin-token'

const STATUS_LABEL: Record<XrayOrderStatus, string> = {
  awaiting_payment: 'Awaiting payment',
  queued: 'Queued',
  running: 'Running',
  review: 'Ready for review',
  approved: 'Sent',
  manual: 'Paid, deliver by hand',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

function readToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}

const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Founder-only: /admin/xray. Authenticates every API call with XRAY_ADMIN_TOKEN. */
export default function XrayAdminPage() {
  const [token, setToken] = useState(readToken)
  const [draft, setDraft] = useState('')
  const [orders, setOrders] = useState<OrderWithReport[] | null>(null)
  const [storeKind, setStoreKind] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyId, setBusyId] = useState('')
  const [preview, setPreview] = useState<StoredReport | null>(null)

  useEffect(() => {
    document.title = 'X-ray admin | Mokkoi'
  }, [])

  const api = useCallback(
    async <T,>(action: string, init?: { body?: unknown; query?: string }): Promise<T> => {
      const res = await fetch(`/api/xray?action=${action}${init?.query ?? ''}`, {
        method: init?.body ? 'POST' : 'GET',
        headers: { Authorization: `Bearer ${token}`, ...(init?.body ? { 'Content-Type': 'application/json' } : {}) },
        body: init?.body ? JSON.stringify(init.body) : undefined,
      })
      const j = (await res.json().catch(() => ({}))) as T & { error?: string }
      if (res.status === 401) {
        try {
          sessionStorage.removeItem(TOKEN_KEY)
        } catch {
          /* ignore */
        }
        setToken('')
        throw new Error('That admin token was not accepted.')
      }
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`)
      return j
    },
    [token],
  )

  const load = useCallback(async () => {
    if (!token) return
    try {
      const j = await api<{ orders: OrderWithReport[]; store: string }>('admin-orders')
      setOrders(j.orders)
      setStoreKind(j.store)
      setError('')
    } catch (e) {
      setError((e as Error).message)
    }
  }, [api, token])

  useEffect(() => {
    load()
  }, [load])

  const signIn = (e: FormEvent) => {
    e.preventDefault()
    try {
      sessionStorage.setItem(TOKEN_KEY, draft.trim())
    } catch {
      /* the token still works for this tab */
    }
    setToken(draft.trim())
    setDraft('')
  }

  const act = async (op: string, o: OrderWithReport, label: string) => {
    setBusyId(o.id)
    setNotice('')
    try {
      const j = await api<{ note?: string; email?: { sent: boolean; reason?: string }; report?: { share_token: string } }>('admin', { body: { op, orderId: o.id, reportId: o.latest_report?.id } })
      const mail = j.email ? (j.email.sent ? ' Email sent to the customer.' : ` Email not sent (${j.email.reason}); send the link yourself.`) : ''
      setNotice(`${label}: done.${j.note ? ` ${j.note}.` : ''}${mail}`)
      if (j.report?.share_token) await copyLink(j.report.share_token, false)
      await load()
    } catch (e) {
      setNotice(`${label} failed: ${(e as Error).message}`)
    } finally {
      setBusyId('')
    }
  }

  const copyLink = async (shareToken: string, say = true) => {
    const url = `${window.location.origin}/r/${shareToken}`
    try {
      await navigator.clipboard.writeText(url)
      if (say) setNotice(`Copied ${url}`)
    } catch {
      setNotice(`Report link: ${url}`)
    }
  }

  const openPreview = async (o: OrderWithReport) => {
    if (!o.latest_report) return
    try {
      setPreview(await api<StoredReport>('admin-report', { query: `&id=${o.latest_report.id}` }))
      window.scrollTo(0, 0)
    } catch (e) {
      setNotice(`Could not open the report: ${(e as Error).message}`)
    }
  }

  if (!token) {
    return (
      <div className="xr">
        <div className="xr-wrap xr-a-gate">
          <Link className="xr-logo" to="/">mokkoi<span aria-hidden="true" /></Link>
          <h1>X-ray admin</h1>
          <form onSubmit={signIn}>
            <label htmlFor="a-token">Admin token</label>
            <input id="a-token" type="password" autoComplete="current-password" value={draft} onChange={(e) => setDraft(e.target.value)} />
            <button className="xr-btn" type="submit" disabled={!draft.trim()}>Open admin</button>
          </form>
          <p className="xr-fine">The token is the XRAY_ADMIN_TOKEN value from Vercel. It's kept in this tab only.{error && ` ${error}`}</p>
        </div>
      </div>
    )
  }

  if (preview) {
    const o = orders?.find((x) => x.id === preview.order_id)
    return (
      <div className="xr">
        <div className="xr-wrap xr-a-previewbar">
          <button type="button" className="xr-r-print" onClick={() => setPreview(null)}>Back to orders</button>
          <span>
            {preview.status === 'approved' ? 'Approved and shareable' : 'Draft: the customer cannot see this yet'}, score {preview.score}, model cost ${preview.cost_usd.toFixed(2)}, engine {preview.harness_version}
          </span>
          {o && preview.status !== 'approved' && (
            <button type="button" className="xr-btn" disabled={busyId === o.id} onClick={async () => { await act('approve', o, 'Approve'); setPreview(null) }}>Approve and copy link</button>
          )}
          {preview.status === 'approved' && <button type="button" className="xr-btn" onClick={() => copyLink(preview.share_token)}>Copy link</button>}
        </div>
        {notice && <p className="xr-wrap xr-a-notice" role="status">{notice}</p>}
        <ReportView report={preview.report} approvedAt={preview.approved_at} />
      </div>
    )
  }

  return (
    <div className="xr">
      <div className="xr-wrap xr-a">
        <div className="xr-a-top">
          <Link className="xr-logo" to="/">mokkoi<span aria-hidden="true" /></Link>
          <div className="xr-a-topright">
            {storeKind === 'file' && <span className="xr-tag xr-tag-unverified">Local test data (file store)</span>}
            <button type="button" className="xr-r-print" onClick={load}>Refresh</button>
          </div>
        </div>
        <h1>Orders</h1>
        {error && <p className="xr-o-formerr" role="alert">{error}</p>}
        {notice && <p className="xr-a-notice" role="status">{notice}</p>}
        {orders === null ? (
          <p>Loading…</p>
        ) : orders.length === 0 ? (
          <p className="xr-a-empty">No orders yet. New orders from the site appear here as “Awaiting payment”.</p>
        ) : (
          <div className="xr-r-tablewrap">
            <table className="xr-a-table">
              <thead>
                <tr><th scope="col">Order</th><th scope="col">Listing</th><th scope="col">Status</th><th scope="col">Report</th><th scope="col"><span className="xr-sr">Actions</span></th></tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const r = o.latest_report
                  const busy = busyId === o.id
                  return (
                    <tr key={o.id}>
                      <td>
                        <strong>{PLAN_LABELS[o.plan]}</strong>
                        <span className="xr-a-sub">{when(o.created_at)}</span>
                        <span className="xr-a-sub">{o.email}</span>
                      </td>
                      <td className="xr-a-url">
                        <a href={o.listing_url} target="_blank" rel="noopener noreferrer">{o.listing_url.replace(/^https?:\/\//, '')}</a>
                        {o.website_url && <span className="xr-a-sub">{o.website_url.replace(/^https?:\/\//, '')}</span>}
                        {(o.listing_text || o.notes) && <span className="xr-a-sub">Has buyer notes</span>}
                      </td>
                      <td>
                        <span className={`xr-a-status xr-a-${o.status}`}>{STATUS_LABEL[o.status]}</span>
                        {o.last_error && <span className="xr-a-sub xr-a-error" title={o.last_error}>{o.last_error.slice(0, 90)}</span>}
                      </td>
                      <td>
                        {r ? (
                          <>
                            <button type="button" className="xr-a-link" onClick={() => openPreview(o)}>
                              {r.score}/100 {r.verdict}
                            </button>
                            <span className="xr-a-sub">${r.cost_usd.toFixed(2)}, {r.status}</span>
                          </>
                        ) : (
                          <span className="xr-a-sub">None yet</span>
                        )}
                      </td>
                      <td className="xr-a-actions">
                        {o.status === 'awaiting_payment' && <button type="button" disabled={busy} onClick={() => act('mark-paid', o, 'Mark paid')}>Mark paid</button>}
                        {o.plan === 'quick' && ['review', 'approved', 'failed'].includes(o.status) && <button type="button" disabled={busy} onClick={() => act('run', o, 'Re-run')}>Re-run</button>}
                        {o.status === 'review' && r && <button type="button" disabled={busy} onClick={() => openPreview(o)}>Review</button>}
                        {r?.status === 'approved' && <button type="button" onClick={() => copyLink(r.share_token)}>Copy link</button>}
                        {o.status === 'manual' && <button type="button" disabled={busy} onClick={() => act('delivered', o, 'Mark delivered')}>Mark delivered</button>}
                        {['awaiting_payment', 'queued', 'review', 'manual', 'failed'].includes(o.status) && (
                          <button type="button" className="xr-a-quiet" disabled={busy} onClick={() => window.confirm('Cancel this order?') && act('cancel', o, 'Cancel')}>Cancel</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="xr-fine xr-a-help">
          Quick X-rays: Mark paid queues the order; the runner picks it up within 10 minutes (or right away if GitHub dispatch is set up), then it shows as Ready for review.
          Full, Deep and Verified orders are recorded for delivery by hand.
        </p>
      </div>
    </div>
  )
}
