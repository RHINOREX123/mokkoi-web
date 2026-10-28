// Order form validation, shared by the API and the order page.
import type { XrayPlan } from './types.js'

export const PLANS: readonly XrayPlan[] = ['quick', 'full', 'deep', 'verified']

export interface OrderInput {
  plan: XrayPlan
  listing_url: string
  website_url: string | null
  email: string
  notes: string | null
  listing_text: string | null
}

export type Validation = { ok: true; value: OrderInput } | { ok: false; errors: Record<string, string> }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function cleanUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null
  const s = raw.trim()
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    if (!u.hostname.includes('.') || u.username || u.password) return null
    return u.toString()
  } catch {
    return null
  }
}

const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

export function validateOrder(body: Record<string, unknown>): Validation {
  const errors: Record<string, string> = {}
  const plan = typeof body.plan === 'string' && (PLANS as readonly string[]).includes(body.plan) ? (body.plan as XrayPlan) : null
  if (!plan) errors.plan = 'Choose a report.'
  const listing = cleanUrl(body.listing_url)
  if (!listing) errors.listing_url = 'Paste a listing or website URL, like https://flippa.com/12345678.'
  const websiteRaw = str(body.website_url, 2048)
  const website = websiteRaw ? cleanUrl(websiteRaw) : null
  if (websiteRaw && !website) errors.website_url = "That doesn't look like a website address."
  const email = str(body.email, 320)
  if (!email || !EMAIL.test(email)) errors.email = 'Enter the email address we should send the report to.'
  if (body.terms !== true) errors.terms = 'Please accept the terms to place an order.'
  if (Object.keys(errors).length) return { ok: false, errors }
  return {
    ok: true,
    value: { plan: plan!, listing_url: listing!, website_url: website, email: email!.toLowerCase(), notes: str(body.notes, 4000), listing_text: str(body.listing_text, 20000) },
  }
}
