import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseConfig } from './auth-helper.js'

const PLAN_CREDITS: Record<string, number> = {
  free: 50,
  pro: 350,
  max: 1000,
}

export const config = {
  api: { bodyParser: false },
}

async function getRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!stripeKey) {
    console.warn('STRIPE_SECRET_KEY not set, ignoring webhook')
    return res.status(200).json({ received: true })
  }

  if (!webhookSecret) {
    console.warn('STRIPE_WEBHOOK_SECRET not set, processing without signature verification')
  }

  const { url, key } = getSupabaseConfig()
  if (!url || !key) {
    console.error('Supabase not configured')
    return res.status(500).json({ error: 'Database not configured' })
  }

  const supabaseAdmin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY || key)

  let event: any

  try {
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(stripeKey)
    const rawBody = await getRawBody(req)

    if (webhookSecret) {
      const sig = req.headers['stripe-signature'] as string
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
    } else {
      event = JSON.parse(rawBody.toString())
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return res.status(400).json({ error: 'Webhook verification failed' })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const userId = session.metadata?.userId
        const plan = session.metadata?.plan
        const isTopUp = session.metadata?.type === 'topup'

        if (isTopUp && userId) {
          // Credit top-up: add 100 credits
          const { data: sub } = await supabaseAdmin
            .from('subscriptions')
            .select('credits_remaining')
            .eq('user_id', userId)
            .single()

          if (sub) {
            await supabaseAdmin
              .from('subscriptions')
              .update({
                credits_remaining: sub.credits_remaining + 100,
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', userId)
          }

          await supabaseAdmin.from('credit_purchases').insert({
            user_id: userId,
            credits_amount: 100,
            amount_paid: 5.0,
            stripe_payment_id: session.payment_intent,
          })
          break
        }

        if (userId && plan && PLAN_CREDITS[plan]) {
          await supabaseAdmin.from('subscriptions').upsert({
            user_id: userId,
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
            plan,
            status: 'active',
            credits_remaining: PLAN_CREDITS[plan],
            credits_monthly_limit: PLAN_CREDITS[plan],
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' })
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object
        const customerId = subscription.customer

        const { data: sub } = await supabaseAdmin
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (sub) {
          await supabaseAdmin
            .from('subscriptions')
            .update({
              status: subscription.status === 'active' ? 'active'
                : subscription.status === 'past_due' ? 'past_due'
                : subscription.status === 'trialing' ? 'trialing'
                : 'cancelled',
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', sub.user_id)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        const customerId = subscription.customer

        await supabaseAdmin
          .from('subscriptions')
          .update({
            plan: 'free',
            status: 'cancelled',
            credits_remaining: 50,
            credits_monthly_limit: 50,
            stripe_subscription_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId)
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object
        const customerId = invoice.customer

        // Reset credits to monthly limit on renewal
        const { data: sub } = await supabaseAdmin
          .from('subscriptions')
          .select('credits_monthly_limit')
          .eq('stripe_customer_id', customerId)
          .single()

        if (sub) {
          await supabaseAdmin
            .from('subscriptions')
            .update({
              credits_remaining: sub.credits_monthly_limit,
              current_period_end: new Date(invoice.lines?.data?.[0]?.period?.end * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_customer_id', customerId)
        }
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }
  } catch (err) {
    console.error('Webhook handler error:', err)
    return res.status(500).json({ error: 'Webhook processing failed' })
  }

  return res.status(200).json({ received: true })
}
