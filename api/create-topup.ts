import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticateRequest } from './_lib/auth-helper.js'

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

  const { userId, email } = req.body ?? {}

  const Stripe = (await import('stripe')).default
  const stripe = new Stripe(stripeKey)

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: email || undefined,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Mokkoi Credits Top-up',
              description: '100 credits for Mokkoi AI screen generation',
            },
            unit_amount: 500, // $5.00 in cents
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: userId || user.id,
        type: 'topup',
        credits: '100',
      },
      success_url: 'https://mokkoi.com/app?topup=true',
      cancel_url: 'https://mokkoi.com/pricing',
    })

    return res.status(200).json({ checkoutUrl: session.url })
  } catch (err) {
    console.error('Stripe top-up error:', err)
    const message = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ error: `Top-up failed: ${message}` })
  }
}
