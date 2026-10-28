import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { XRAY_CONTACT_EMAIL, xrayOrderHref } from '../../constants/xray'

/** Shared top nav for the X-ray landing and its legal/support pages. */
export function XrayNav({ home = false }: { home?: boolean }) {
  const anchor = (id: string) => (home ? `#${id}` : `/#${id}`)
  return (
    <nav className="xr-nav" aria-label="Main">
      <Link className="xr-logo" to="/">mokkoi<span aria-hidden="true" /></Link>
      <ul>
        <li><a href={anchor('checks')}>What we check</a></li>
        <li><a href={anchor('how')}>How it works</a></li>
        <li><a href={anchor('pricing')}>Pricing</a></li>
        <li><a href={anchor('sellers')}>For sellers</a></li>
        <li><a href={anchor('faq')}>FAQ</a></li>
      </ul>
    </nav>
  )
}

/** Listing URL input + order button. Sends the URL along with the Quick X-ray order. */
export function RunForm({ id, buttonLabel = 'Run a Quick X-ray for $49' }: { id: string; buttonLabel?: string }) {
  const [listingUrl, setListingUrl] = useState('')
  const onRun = (e: FormEvent) => {
    e.preventDefault()
    window.location.href = xrayOrderHref('quick', listingUrl.trim())
  }
  return (
    <form className="xr-run" onSubmit={onRun}>
      <label htmlFor={id} className="xr-sr">Listing or website URL</label>
      <input
        id={id}
        type="url"
        inputMode="url"
        placeholder="Paste a Flippa listing or website URL"
        value={listingUrl}
        onChange={(e) => setListingUrl(e.target.value)}
      />
      <button className="xr-btn" type="submit">{buttonLabel}</button>
    </form>
  )
}

export function XrayFooter() {
  return (
    <footer className="xr-footer-full">
      <div className="xr-wrap xr-footer-grid">
        <div className="xr-footer-brand">
          <Link className="xr-logo" to="/">mokkoi<span aria-hidden="true" /></Link>
          <p>Due diligence reports for people buying small online businesses.</p>
        </div>
        <div>
          <h2>Product</h2>
          <ul>
            <li><a href="/#checks">What we check</a></li>
            <li><a href="/#pricing">Pricing</a></li>
            <li><a href="/#sellers">For sellers</a></li>
            <li><a href="/#faq">FAQ</a></li>
          </ul>
        </div>
        <div>
          <h2>Help</h2>
          <ul>
            <li><Link to="/support">Support</Link></li>
            <li><a href={`mailto:${XRAY_CONTACT_EMAIL}`}>{XRAY_CONTACT_EMAIL}</a></li>
            <li><a href="https://x.com/Mokkoi_dev" rel="noopener noreferrer" target="_blank">X (Twitter)</a></li>
          </ul>
        </div>
        <div>
          <h2>Legal</h2>
          <ul>
            <li><Link to="/terms">Terms of use</Link></li>
            <li><Link to="/privacy">Privacy policy</Link></li>
            <li><Link to="/refunds">Refund policy</Link></li>
          </ul>
        </div>
      </div>
      <div className="xr-wrap xr-footer-base">
        <span>© 2026 Mokkoi</span>
        <span>Reports are informational only and are not legal, financial or investment advice.</span>
      </div>
    </footer>
  )
}
