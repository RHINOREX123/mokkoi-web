// Mokkoi X-ray ordering config. Set these in Vercel / .env once checkout exists.
// VITE_XRAY_ORDER_URL: hosted checkout link (e.g. Lemon Squeezy). The listing URL
// is appended as a custom field so the report job knows what to check.
export const XRAY_ORDER_URL: string | undefined = import.meta.env.VITE_XRAY_ORDER_URL || undefined
export const XRAY_CONTACT_EMAIL: string = import.meta.env.VITE_XRAY_CONTACT_EMAIL || 'mokkoidev@gmail.com'

export const XRAY_PLANS = [
  {
    id: 'quick',
    name: 'Quick X-ray',
    price: '$49',
    when: 'Ready in about 15 minutes',
    features: ['Public data only', 'Claims vs evidence', 'Tech, security, domain history', 'Questions for the seller'],
    cta: 'Run a Quick X-ray',
  },
  {
    id: 'full',
    name: 'Full X-ray',
    price: '$199',
    when: 'Ready within 24 hours',
    features: ['Everything in Quick', 'Real revenue, churn and customers from Stripe', 'Real traffic from analytics', 'True costs and margin'],
    cta: 'Order a Full X-ray',
    featured: true,
  },
  {
    id: 'deep',
    name: 'Deep X-ray',
    price: '$499',
    when: 'Ready within 48 hours',
    features: ['Everything in Full', 'Code and security audit', 'Hidden AI and API costs', 'Handover risks'],
    cta: 'Order a Deep X-ray',
  },
] as const

export type XrayPlanId = (typeof XRAY_PLANS)[number]['id']

/** Where a "run/order" action should go for a given plan and listing URL. */
export function xrayOrderHref(plan: XrayPlanId | 'verified', listingUrl = ''): string {
  if (XRAY_ORDER_URL) {
    const u = new URL(XRAY_ORDER_URL)
    u.searchParams.set('checkout[custom][plan]', plan)
    if (listingUrl) u.searchParams.set('checkout[custom][listing_url]', listingUrl)
    return u.toString()
  }
  const subject = `Mokkoi ${plan} X-ray order`
  const body = listingUrl ? `Listing or website to check: ${listingUrl}` : 'Listing or website to check: '
  return `mailto:${XRAY_CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
