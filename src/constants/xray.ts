// Mokkoi X-ray ordering config.
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

/** Seller "Verified" report, sold alongside the buyer plans. */
export const XRAY_VERIFIED_PLAN = { id: 'verified', name: 'Mokkoi Verified', price: '$149', when: 'Ready within 48 hours' } as const

export type XrayOrderPlanId = XrayPlanId | 'verified'

/** Where a "run/order" action goes: the order form, prefilled with the plan and listing URL. */
export function xrayOrderHref(plan: XrayOrderPlanId, listingUrl = ''): string {
  const q = new URLSearchParams({ plan })
  if (listingUrl) q.set('url', listingUrl)
  return `/order?${q.toString()}`
}
