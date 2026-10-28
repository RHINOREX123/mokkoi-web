import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { XrayPlan } from '../../lib/xray/types'
import { XRAY_CONTACT_EMAIL, XRAY_PLANS, XRAY_VERIFIED_PLAN } from '../constants/xray'
import { XrayFooter, XrayNav } from './xray/chrome'
import './xray-landing.css'
import './xray/order.css'

const PLAN_OPTIONS = [
  ...XRAY_PLANS.map((p) => ({ id: p.id as XrayPlan, name: p.name, price: p.price, when: p.when, blurb: p.features[0] + (p.features[1] ? `, ${p.features[1].toLowerCase()}` : '') })),
  { id: 'verified' as XrayPlan, name: XRAY_VERIFIED_PLAN.name, price: XRAY_VERIFIED_PLAN.price, when: XRAY_VERIFIED_PLAN.when, blurb: 'For sellers: a checked report on your own business to share with buyers' },
]

type Fields = Partial<Record<'plan' | 'listing_url' | 'website_url' | 'email' | 'terms', string>>
type Placed = { id: string; plan: XrayPlan; email: string; listing: string }

function Confirmation({ placed }: { placed: Placed }) {
  const plan = PLAN_OPTIONS.find((p) => p.id === placed.plan)!
  return (
    <div className="xr-o-done">
      <h1>Order received.</h1>
      <p className="xr-lede">
        We've saved your {plan.name} for <strong className="xr-o-break">{placed.listing}</strong>.
      </p>
      <ol className="xr-o-next">
        <li><strong>Payment link.</strong> We'll email a payment link for {plan.price} to {placed.email}, usually within a few hours.</li>
        <li><strong>We run the checks.</strong> {placed.plan === 'quick' ? 'Once paid, Mokkoi runs the Quick X-ray and a person reviews it before it goes out.' : 'Once paid, we start work and keep you posted.'}</li>
        <li><strong>Your report.</strong> You get a private link by email. {placed.plan === 'quick' ? 'Usually within a few hours of payment.' : `${plan.when} of payment.`}</li>
      </ol>
      <p className="xr-fine">Order reference {placed.id.slice(0, 8)}. Questions? Write to <a href={`mailto:${XRAY_CONTACT_EMAIL}`}>{XRAY_CONTACT_EMAIL}</a>.</p>
      <p><Link className="xr-btn xr-btn-ghost" to="/">Back to Mokkoi</Link></p>
    </div>
  )
}

export default function XrayOrderPage() {
  const [params] = useSearchParams()
  const initialPlan = (PLAN_OPTIONS.find((p) => p.id === params.get('plan'))?.id ?? 'quick') as XrayPlan
  const [plan, setPlan] = useState<XrayPlan>(initialPlan)
  const [listingUrl, setListingUrl] = useState(params.get('url') ?? '')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [email, setEmail] = useState('')
  const [listingText, setListingText] = useState('')
  const [notes, setNotes] = useState('')
  const [terms, setTerms] = useState(false)
  const [company, setCompany] = useState('') // honeypot
  const [errors, setErrors] = useState<Fields>({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const [placed, setPlaced] = useState<Placed | null>(null)

  useEffect(() => {
    document.title = 'Order a report | Mokkoi'
  }, [])
  useEffect(() => {
    if (placed) window.scrollTo(0, 0)
  }, [placed])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setFormError('')
    setErrors({})
    try {
      const res = await fetch('/api/xray?action=order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, listing_url: listingUrl, website_url: websiteUrl, email, listing_text: listingText, notes, terms, company }),
      })
      const j = (await res.json().catch(() => ({}))) as { id?: string; error?: string; fields?: Fields }
      if (res.ok && j.id) {
        setPlaced({ id: j.id, plan, email, listing: listingUrl })
      } else {
        setErrors(j.fields ?? {})
        setFormError(j.error ?? 'The order did not go through. Try again in a minute.')
      }
    } catch {
      setFormError(`The order did not go through: check your connection and try again, or email ${XRAY_CONTACT_EMAIL}.`)
    } finally {
      setBusy(false)
    }
  }

  const err = (k: keyof Fields) => errors[k] && <span className="xr-o-err" id={`${k}-err`}>{errors[k]}</span>

  return (
    <div className="xr">
      <div className="xr-wrap">
        <XrayNav />
        <main className="xr-o">
          {placed ? (
            <Confirmation placed={placed} />
          ) : (
            <>
              <h1>Order a report</h1>
              <p className="xr-lede">Tell us which business to check and where to send the report. You'll pay by a secure link we email you.</p>

              <form className="xr-o-form" onSubmit={onSubmit} noValidate>
                <fieldset className="xr-o-plans">
                  <legend>Report</legend>
                  {PLAN_OPTIONS.map((p) => (
                    <label key={p.id} className={`xr-o-plan${plan === p.id ? ' is-on' : ''}`}>
                      <input type="radio" name="plan" value={p.id} checked={plan === p.id} onChange={() => setPlan(p.id)} />
                      <span className="xr-o-plan-name">{p.name}</span>
                      <span className="xr-o-plan-price">{p.price}</span>
                      <span className="xr-o-plan-when">{p.when}</span>
                      <span className="xr-o-plan-blurb">{p.blurb}</span>
                    </label>
                  ))}
                </fieldset>
                {err('plan')}

                <div className="xr-o-field">
                  <label htmlFor="o-listing">{plan === 'verified' ? 'Your listing or website' : 'Listing or website to check'}</label>
                  <input id="o-listing" type="url" inputMode="url" autoComplete="url" placeholder="https://flippa.com/12345678" value={listingUrl} onChange={(e) => setListingUrl(e.target.value)} aria-invalid={!!errors.listing_url} aria-describedby={errors.listing_url ? 'listing_url-err' : undefined} required />
                  {err('listing_url')}
                </div>

                <div className="xr-o-field">
                  <label htmlFor="o-website">The business's website <span className="xr-o-opt">(if the listing doesn't show it)</span></label>
                  <input id="o-website" type="url" inputMode="url" placeholder="https://example.com" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} aria-invalid={!!errors.website_url} aria-describedby={errors.website_url ? 'website_url-err' : undefined} />
                  {err('website_url')}
                </div>

                <div className="xr-o-field">
                  <label htmlFor="o-email">Email for the report</label>
                  <input id="o-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} aria-describedby={errors.email ? 'email-err' : undefined} required />
                  {err('email')}
                </div>

                <details className="xr-o-more">
                  <summary>Add listing details we can't see</summary>
                  <p className="xr-fine">Flippa shows traffic and financials only to signed-in buyers. Paste anything from those tabs or from the seller, and we'll check it against the evidence. We never log in to marketplaces for you.</p>
                  <label htmlFor="o-text" className="xr-sr">Listing details</label>
                  <textarea id="o-text" rows={6} value={listingText} onChange={(e) => setListingText(e.target.value)} maxLength={20000} />
                  <label htmlFor="o-notes">Anything you want us to look at</label>
                  <textarea id="o-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} />
                </details>

                <div className="xr-o-hp" aria-hidden="true">
                  <label htmlFor="o-company">Company</label>
                  <input id="o-company" tabIndex={-1} autoComplete="off" value={company} onChange={(e) => setCompany(e.target.value)} />
                </div>

                <label className="xr-o-check">
                  <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} aria-invalid={!!errors.terms} />
                  <span>I accept the <Link to="/terms" target="_blank">terms</Link> and understand reports are informational, not legal, financial or investment advice.</span>
                </label>
                {err('terms')}

                {formError && <p className="xr-o-formerr" role="alert">{formError}</p>}
                <button className="xr-btn" type="submit" disabled={busy}>{busy ? 'Placing order…' : `Place order for ${PLAN_OPTIONS.find((p) => p.id === plan)!.price}`}</button>
                <p className="xr-fine">Nothing is charged now. We email a payment link, and you can cancel before paying.</p>
              </form>
            </>
          )}
        </main>
      </div>
      <XrayFooter />
    </div>
  )
}
