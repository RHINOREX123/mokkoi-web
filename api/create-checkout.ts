import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticateRequest } from './_lib/auth-helper.js'

// TODO: Set these environment variables in Vercel with real Stripe price IDs:
//   STRIPE_PRICE_PRO_MONTHLY=price_xxx
//   STRIPE_PRICE_PRO_ANNUAL=price_xxx
//   STRIPE_PRICE_MAX_MONTHLY=price_xxx
//   STRIPE_PRICE_MAX_ANNUAL=price_xxx
const PRICE_IDS: Record<string, Record<string, string>> = {
  pro: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || 'price_pro_monthly',
    annual: process.env.STRIPE_PRICE_PRO_ANNUAL || 'price_pro_annual',
  },
  max: {
    monthly: process.env.STRIPE_PRICE_MAX_MONTHLY || 'price_max_monthly',
    annual: process.env.STRIPE_PRICE_MAX_ANNUAL || 'price_max_annual',
  },
}

function isPlaceholderPriceId(priceId: string): boolean {
  return !priceId.startsWith('price_') || /^price_(pro|max)_(monthly|annual)$/.test(priceId)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const user = await authenticateRequest(req, res)
  if (!user) return

  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) {
    return res.status(200).json({ error: 'Payments coming soon', checkoutUrl: null })
  }

  const { plan, billingCycle, userId, email } = req.body ?? {}

  if (!plan || !PRICE_IDS[plan]) {
    return res.status(400).json({ error: 'Invalid plan' })
  }
  if (!billingCycle || !['monthly', 'annual'].includes(billingCycle)) {
    return res.status(400).json({ error: 'Invalid billing cycle' })
  }

  const selectedPriceId = PRICE_IDS[plan][billingCycle]
  if (isPlaceholderPriceId(selectedPriceId)) {
    return res.status(200).json({
      error: 'payments_not_configured',
      message: 'Payments are being set up. Please try again later.',
      checkoutUrl: null,
    })
  }

  const Stripe = (await import('stripe')).default
  const stripe = new Stripe(stripeKey)

  const baseUrl = req.headers.origin || process.env.MOKKOI_PUBLIC_URL || 'https://mokkoi.com'

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: email || undefined,
      line_items: [
        {
          price: PRICE_IDS[plan][billingCycle],
          quantity: 1,
        },
      ],
      metadata: {
        userId: userId || user.id,
        plan,
      },
      success_url: `${baseUrl}/app?upgraded=true`,
      cancel_url: `${baseUrl}/pricing`,
    })

    return res.status(200).json({ checkoutUrl: session.url })
  } catch (err) {
    console.error('Stripe checkout error:', err)
    const message = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ error: `Checkout failed: ${message}` })
  }
}
