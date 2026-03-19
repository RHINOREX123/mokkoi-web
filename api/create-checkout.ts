import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticateRequest } from './auth-helper.js'

const PRICE_IDS: Record<string, Record<string, string>> = {
  pro: {
    monthly: 'price_pro_monthly',
    annual: 'price_pro_annual',
  },
  max: {
    monthly: 'price_max_monthly',
    annual: 'price_max_annual',
  },
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

  const Stripe = (await import('stripe')).default
  const stripe = new Stripe(stripeKey)

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
      success_url: 'https://mokkoi.com/app?upgraded=true',
      cancel_url: 'https://mokkoi.com/pricing',
    })

    return res.status(200).json({ checkoutUrl: session.url })
  } catch (err) {
    console.error('Stripe checkout error:', err)
    const message = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ error: `Checkout failed: ${message}` })
  }
}
