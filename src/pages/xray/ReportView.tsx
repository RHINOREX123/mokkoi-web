import {
  PLAN_LABELS,
  REPORT_DISCLAIMER,
  SECTION_TITLES,
  type ClaimStatus,
  type Severity,
  type XrayReport,
} from '../../../lib/xray/types'
import './report.css'

const CLAIM_LABEL: Record<ClaimStatus, string> = { verified: 'Verified', unverified: 'Unverified', contradicted: 'Contradicted' }
const SEVERITY_LABEL: Record<Severity, string> = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', info: 'Note' }
const VERDICT_LABEL = { green: 'Worth pursuing', yellow: 'Proceed with care', red: 'Serious concerns' } as const

const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

function host(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** Evidence keys as links into the appendix. */
function Cites({ keys }: { keys: string[] }) {
  if (!keys.length) return null
  return (
    <span className="xr-r-cites">
      {keys.map((k) => (
        <a key={k} href={`#ev-${k}`} className="xr-r-cite" aria-label={`Evidence ${k}`}>
          {k}
        </a>
      ))}
    </span>
  )
}

function Section({ id, title, intro, children }: { id: string; title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="xr-r-sec" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`}>{title}</h2>
      {intro && <p className="xr-r-intro">{intro}</p>}
      {children}
    </section>
  )
}

export default function ReportView({ report, approvedAt }: { report: XrayReport; approvedAt?: string | null }) {
  const r = report
  const title = r.target.title || host(r.target.websiteUrl ?? r.target.listingUrl)
  const evidenceIndex = new Map(r.evidence.map((e) => [e.key, e]))
  const websiteOnly = r.target.marketplace === 'website'
  const listingId = r.target.listingUrl.match(/\/(\d{6,})/)?.[1]

  return (
    <article className="xr-r">
      <header className="xr-r-hero">
        <div className="xr-wrap xr-r-hero-grid">
          <div className="xr-r-target">
            <p className="xr-r-kind">{PLAN_LABELS[r.plan]} report</p>
            <h1>{title}</h1>
            <dl className="xr-r-meta">
              {!websiteOnly && <div><dt>Listing</dt><dd><a href={r.target.listingUrl} rel="noopener noreferrer nofollow" target="_blank">{host(r.target.listingUrl)}{listingId ? ` #${listingId}` : ''}</a></dd></div>}
              {r.target.websiteUrl && <div><dt>Website</dt><dd><a href={r.target.websiteUrl} rel="noopener noreferrer nofollow" target="_blank">{host(r.target.websiteUrl)}</a></dd></div>}
              <div><dt>Checked</dt><dd>{day(r.generatedAt)}</dd></div>
              <div><dt>Data used</dt><dd>{r.accessLevel === 0 ? 'Public information only' : 'Public information plus seller-shared access'}</dd></div>
            </dl>
          </div>

          <div className={`xr-r-sheet xr-r-${r.verdict.color}`}>
            <div className="xr-r-sheet-top">
              <div className="xr-r-score" aria-label={`Score ${r.verdict.score} out of 100`}>
                {r.verdict.score}<small>/100</small>
              </div>
              <p className="xr-r-band">{VERDICT_LABEL[r.verdict.color]}</p>
            </div>
            <p className="xr-r-headline">{r.verdict.headline}</p>
            <ul className="xr-r-summary">
              {r.verdict.summary.map((s) => <li key={s}>{s}</li>)}
            </ul>
          </div>
        </div>
      </header>

      <div className="xr-wrap xr-r-body">
        <nav className="xr-r-toc" aria-label="Report sections">
          <a href="#claims">Claims vs evidence</a>
          <a href="#flags">Red flags</a>
          <a href="#questions">Questions for the seller</a>
          <a href="#next">Before you close</a>
          <a href="#evidence">Evidence</a>
        </nav>

        <div className="xr-r-main">
          {r.claims.length > 0 && (
            <Section id="claims" title="Claims vs evidence" intro={`What the ${websiteOnly ? 'site' : 'listing'} says, checked against what we could find. Unverified means public data can't confirm it either way.`}>
              <div className="xr-r-tablewrap">
                <table className="xr-r-claims">
                  <thead>
                    <tr><th scope="col">{websiteOnly ? 'The site says' : 'The listing says'}</th><th scope="col">Status</th><th scope="col">What we found</th></tr>
                  </thead>
                  <tbody>
                    {r.claims.map((c, i) => (
                      <tr key={i} className={`xr-r-claim-${c.status}`}>
                        <td className="xr-r-claim-text">{c.status === 'contradicted' ? <s>{c.claim}</s> : c.claim}</td>
                        <td><span className={`xr-tag xr-tag-${c.status}`}>{CLAIM_LABEL[c.status]}</span></td>
                        <td>{c.finding} <Cites keys={c.evidenceKeys} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          <Section id="flags" title="Red flags" intro={r.redFlags.length ? 'Ranked by how much each one should change your offer. Every item links to its evidence.' : undefined}>
            {r.redFlags.length === 0 ? (
              <p className="xr-r-empty">No red flags survived review. That is unusual; read the limits below before relying on it.</p>
            ) : (
              <ol className="xr-r-flags">
                {r.redFlags.map((f) => (
                  <li key={f.key} className={`xr-r-flag xr-r-sev-${f.severity}`}>
                    <div className="xr-r-flag-head">
                      <span className="xr-r-sev">{SEVERITY_LABEL[f.severity]}</span>
                      <span className="xr-r-area">{SECTION_TITLES[f.section]}</span>
                    </div>
                    <h3>{f.title}</h3>
                    <p>{f.detail} <Cites keys={f.evidenceKeys} /></p>
                  </li>
                ))}
              </ol>
            )}
          </Section>

          {r.strengths.length > 0 && (
            <Section id="strengths" title="What checks out">
              <ul className="xr-r-list xr-r-good">
                {r.strengths.map((s, i) => <li key={i}>{s.text} <Cites keys={s.evidenceKeys} /></li>)}
              </ul>
            </Section>
          )}

          <Section id="questions" title="Questions for the seller" intro="Ask these before you make an offer. The first one matters most.">
            <ol className="xr-r-questions">
              {r.questions.map((q) => <li key={q}>{q}</li>)}
            </ol>
          </Section>

          <Section id="next" title="Before you close">
            <div className="xr-r-next">
              <div>
                <h3>Verify with seller access</h3>
                <ul className="xr-r-list">{r.verifyBeforeClosing.map((v) => <li key={v}>{v}</li>)}</ul>
              </div>
              <div>
                <h3>If you buy: first 30 days</h3>
                <ul className="xr-r-list">{r.first30Days.map((v) => <li key={v}>{v}</li>)}</ul>
              </div>
            </div>
            {r.valuation && (
              <div className="xr-r-valuation">
                <h3>Is the price in range?</h3>
                <p>{r.valuation}</p>
                <p className="xr-r-fine">Context only, not financial advice.</p>
              </div>
            )}
          </Section>

          <Section id="limits" title="What this report could not see">
            <ul className="xr-r-list">{r.limits.map((l) => <li key={l}>{l}</li>)}</ul>
          </Section>

          <Section id="evidence" title="Evidence" intro={`Every check Mokkoi ran, with its source and the time it was collected. ${r.requestLog.length} public requests in total, all read-only.`}>
            <div className="xr-r-tablewrap">
              <table className="xr-r-evidence">
                <thead>
                  <tr><th scope="col">Ref</th><th scope="col">Check</th><th scope="col">Result</th></tr>
                </thead>
                <tbody>
                  {r.evidence.map((e) => (
                    <tr key={e.key} id={`ev-${e.key}`}>
                      <th scope="row">{e.key}</th>
                      <td>
                        <strong>{e.title}</strong>
                        <span className="xr-r-when">{new Date(e.fetchedAt).toISOString().slice(0, 16).replace('T', ' ')} UTC</span>
                      </td>
                      <td>
                        {e.summary}
                        {e.sourceUrl && (
                          <a className="xr-r-src" href={e.sourceUrl} rel="noopener noreferrer nofollow" target="_blank">{host(e.sourceUrl)}</a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <details className="xr-r-log">
              <summary>Request log ({r.requestLog.length})</summary>
              <ul>
                {r.requestLog.map((q, i) => (
                  <li key={i}><span>{q.method}</span> {q.url} <em>{q.error ? `blocked or failed: ${q.error}` : q.status ?? ''}</em></li>
                ))}
              </ul>
            </details>
          </Section>

          <footer className="xr-r-foot">
            <p><strong>{REPORT_DISCLAIMER}</strong></p>
            <p>
              Made by Mokkoi on {day(r.generatedAt)}{approvedAt ? `, reviewed ${day(approvedAt)}` : ''}. Engine {r.harnessVersion}. Findings cite evidence
              {evidenceIndex.size ? ` (${evidenceIndex.size} items)` : ''}; anything we could not prove is listed as a question.
            </p>
          </footer>
        </div>
      </div>
    </article>
  )
}
