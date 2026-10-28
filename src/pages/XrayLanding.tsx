import { useState } from 'react'
import { XRAY_PLANS, xrayOrderHref } from '../constants/xray'
import { SAMPLES, FINDINGS, CHECK_GROUPS, COMPARE_ROWS, FAQ } from './xray/content'
import { XrayNav, RunForm, XrayFooter } from './xray/chrome'
import './xray-landing.css'

const STEPS = [
  { title: 'Paste the link', body: 'A Flippa or Acquire listing, or just the website. Nothing to install, no seller needed.' },
  { title: 'Mokkoi investigates', body: 'Stack, security, domain history, traffic, reviews and every listing claim. With seller access: Stripe, analytics and code.' },
  { title: 'You get a verdict', body: 'A score, red flags with evidence, and the exact questions to ask the seller before you make an offer.' },
]

const RULES = [
  { title: "Evidence or it isn't in the report", body: "Every finding links to its source. Anything we can't prove is marked as a question, not a fact." },
  { title: 'We only look, unless the owner says yes', body: "Without the seller's consent we use public information only. No logins, no testing their systems." },
  { title: 'Informational, not advice', body: "Mokkoi helps you ask better questions. It isn't legal, financial or investment advice." },
]

function scoreTone(score: number) {
  if (score >= 70) return 'verified'
  if (score >= 45) return 'unverified'
  return 'contradicted'
}

export default function XrayLanding() {
  const [sampleId, setSampleId] = useState(SAMPLES[0].id)
  const sample = SAMPLES.find((s) => s.id === sampleId) ?? SAMPLES[0]

  return (
    <div className="xr">
      <div className="xr-wrap">
        <XrayNav home />

        <header className="xr-hero">
          <div>
            <h1>Know what you're buying.</h1>
            <p className="xr-lede">
              Mokkoi checks a SaaS or AI app before you buy it on Flippa or Acquire. We look at the code, the
              traffic and the revenue claims, and show you the evidence for everything we find.
            </p>
            <RunForm id="xr-url" />
            <p className="xr-fine">Report in about 15 minutes. Public data only, unless the seller shares access.</p>
          </div>

          <div className="xr-blueprint">
            <div className="xr-samples" role="tablist" aria-label="Sample reports">
              {SAMPLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  id={`xr-tab-${s.id}`}
                  aria-selected={s.id === sample.id}
                  aria-controls="xr-sample-panel"
                  onClick={() => setSampleId(s.id)}
                >
                  {s.tab}
                </button>
              ))}
            </div>
            <article
              key={sample.id}
              className="xr-sheet"
              id="xr-sample-panel"
              role="tabpanel"
              aria-labelledby={`xr-tab-${sample.id}`}
            >
              <div className="xr-sheet-head">
                <div>
                  <h2>{sample.title}</h2>
                  <p>{sample.meta}</p>
                </div>
                <div className={`xr-score xr-score-${scoreTone(sample.score)}`} aria-label={`Score ${sample.score} out of 100`}>
                  {sample.score}<small>/100</small>
                </div>
              </div>
              <p className="xr-verdict"><strong>{sample.verdictLead}</strong> {sample.verdict}</p>
              <table className="xr-claims">
                <thead>
                  <tr><th>The listing says</th><th>We found</th><th>Source</th></tr>
                </thead>
                <tbody>
                  {sample.claims.map((c) => (
                    <tr key={c.claim}>
                      <td className="xr-claim">
                        {c.correction ? <><s>{c.claim}</s><span className="xr-fix">{c.correction}</span></> : c.claim}
                      </td>
                      <td><span className={`xr-tag xr-tag-${c.status}`}>{c.label}</span></td>
                      <td>{c.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="xr-sheet-foot">A full report adds red flags, evidence links and questions for the seller.</p>
            </article>
          </div>
        </header>
      </div>

      <section id="catches" className="xr-section xr-tinted">
        <div className="xr-wrap">
          <h2 className="xr-sec">Things sellers don't put in the listing.</h2>
          <p className="xr-intro">Every finding comes with the evidence behind it: a screenshot, a record, a link. These are from real checks.</p>
          <div className="xr-finds">
            {FINDINGS.map((f) => (
              <div className="xr-find" key={f.title}>
                <span className={`xr-tag xr-tag-${f.status}`}>{f.area}</span>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="checks" className="xr-section">
        <div className="xr-wrap">
          <h2 className="xr-sec">What goes into every report.</h2>
          <p className="xr-intro">The Quick X-ray covers the first four groups from public data. Revenue and handover checks need the seller to share access.</p>
          <div className="xr-checks">
            {CHECK_GROUPS.map((g) => (
              <div className="xr-check" key={g.name}>
                <div className="xr-check-head">
                  <h3>{g.name}</h3>
                  <span className={g.level === 'Every report' ? 'xr-level' : 'xr-level xr-level-plus'}>{g.level}</span>
                </div>
                <ul>{g.checks.map((c) => <li key={c}>{c}</li>)}</ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="xr-section xr-tinted">
        <div className="xr-wrap">
          <h2 className="xr-sec">How a report is made.</h2>
          <ol className="xr-steps">
            {STEPS.map((s) => (
              <li className="xr-step" key={s.title}><h3>{s.title}</h3><p>{s.body}</p></li>
            ))}
          </ol>
        </div>
      </section>

      <section id="compare" className="xr-section">
        <div className="xr-wrap">
          <h2 className="xr-sec">Between doing it yourself and hiring an advisor.</h2>
          <div className="xr-compare-wrap">
            <table className="xr-compare-table">
              <thead>
                <tr><th scope="col"><span className="xr-sr">Question</span></th><th scope="col">Doing it yourself</th><th scope="col" className="xr-col-us">Mokkoi</th><th scope="col">Human due diligence</th></tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((r) => (
                  <tr key={r.label}>
                    <th scope="row">{r.label}</th>
                    <td>{r.diy}</td>
                    <td className="xr-col-us">{r.mokkoi}</td>
                    <td>{r.human}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section id="pricing" className="xr-section">
        <div className="xr-wrap">
          <h2 className="xr-sec">Check ten deals for the price of one audit.</h2>
          <div className="xr-plans">
            {XRAY_PLANS.map((p) => (
              <div className={`xr-plan${'featured' in p && p.featured ? ' xr-plan-main' : ''}`} key={p.id}>
                <h3>{p.name}</h3>
                <div className="xr-price">{p.price}</div>
                <div className="xr-when">{p.when}</div>
                <ul>{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
                <a className={`xr-btn${'featured' in p && p.featured ? '' : ' xr-btn-ghost'}`} href={xrayOrderHref(p.id)}>{p.cta}</a>
              </div>
            ))}
          </div>
          <p className="xr-compare">
            Human due diligence for small deals usually costs <b>$1,500 to $2,900</b>. Use Mokkoi to decide which deal
            deserves one.
          </p>
        </div>
      </section>

      <section id="sellers" className="xr-section xr-band">
        <div className="xr-wrap xr-sellers">
          <div>
            <h2 className="xr-sec">Selling? Show buyers the proof first.</h2>
            <p className="xr-intro">
              Get a Mokkoi Verified report on your own business and link it in your listing. Buyers trust numbers
              someone else checked, and serious ones move faster.
            </p>
            <p className="xr-band-cta"><a className="xr-btn" href={xrayOrderHref('verified')}>Get verified from $149</a></p>
          </div>
          <div className="xr-badge" aria-hidden="true"><div><b>Verified</b><span>by Mokkoi</span></div></div>
        </div>
      </section>

      <section id="faq" className="xr-section">
        <div className="xr-wrap xr-faq-grid">
          <h2 className="xr-sec">Questions buyers ask us.</h2>
          <div className="xr-faq">
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="xr-section xr-tinted">
        <div className="xr-wrap">
          <h2 className="xr-sec">How we keep it fair.</h2>
          <div className="xr-rules">
            {RULES.map((r) => <div key={r.title}><h3>{r.title}</h3><p>{r.body}</p></div>)}
          </div>
        </div>
      </section>

      <section className="xr-section xr-final">
        <div className="xr-wrap">
          <h2 className="xr-sec">Looking at a deal right now?</h2>
          <p className="xr-intro">Paste the listing. You'll know what to ask the seller before your next message.</p>
          <RunForm id="xr-url-final" />
        </div>
      </section>

      <XrayFooter />
    </div>
  )
}
