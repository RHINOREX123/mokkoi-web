// Transactional email through Resend (optional: everything works without RESEND_API_KEY,
// the founder just sends links by hand).
import { PLAN_LABELS, type XrayOrder } from './types.js'

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY)
}

async function send(to: string, subject: string, text: string) {
  if (!emailConfigured()) return { sent: false as const, reason: 'RESEND_API_KEY not set' }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.XRAY_EMAIL_FROM || 'Mokkoi <reports@mokkoi.com>', to: [to], reply_to: process.env.XRAY_CONTACT_EMAIL || 'mokkoidev@gmail.com', subject, text }),
  })
  if (!res.ok) return { sent: false as const, reason: `Resend HTTP ${res.status}` }
  return { sent: true as const }
}

const siteUrl = () => (process.env.MOKKOI_PUBLIC_URL || 'https://mokkoi.com').replace(/\/$/, '')

export function sendOrderReceived(order: XrayOrder) {
  return send(
    order.email,
    `We've got your ${PLAN_LABELS[order.plan]} order`,
    `Thanks for your order.\n\nReport: ${PLAN_LABELS[order.plan]}\nListing: ${order.listing_url}\nOrder ID: ${order.id}\n\nWe'll email you a payment link shortly. Once it's paid, ${order.plan === 'quick' ? 'your report is usually ready within a few hours, after a person has reviewed it' : 'we start work and deliver within the time shown on the site'}.\n\nQuestions? Just reply to this email.\n\nMokkoi\n${siteUrl()}\n\nReports are informational only and are not legal, financial or investment advice.`,
  )
}

export function sendReportReady(order: XrayOrder, shareToken: string) {
  return send(
    order.email,
    `Your ${PLAN_LABELS[order.plan]} is ready`,
    `Your report on ${order.listing_url} is ready:\n\n${siteUrl()}/r/${shareToken}\n\nAnyone with this link can read the report, so share it only with people you trust (your advisors, partners or the seller).\n\nQuestions about a finding? Reply to this email.\n\nMokkoi\n\nReports are informational only and are not legal, financial or investment advice. Verify before you buy.`,
  )
}
