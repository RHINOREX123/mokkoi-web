/**
 * Single source of truth for Mokkoi pricing tiers.
 * Used by /pricing page (PricingPage.tsx) and the landing-page embed (PricingSection.tsx).
 */

export type PlanId = 'free' | 'hobby' | 'pro' | 'team'

export interface Plan {
  id: PlanId
  name: string
  tagline: string
  monthlyPrice: number          // USD/month
  annualPrice: number           // USD/year (already discounted ~20%)
  perSeat?: boolean             // team tier only
  minSeats?: number
  creditsPerMonth: number       // pooled-per-seat for team
  badge?: 'most-popular'
  cta: string
  ctaMode: 'signup' | 'waitlist' | 'mailto'
  ctaTarget?: string            // mailto: address or route
  overage?: string              // human-readable overage rate
  features: string[]            // bullet list, plain text
}

export const ANNUAL_DISCOUNT_PCT = 15

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'Try Mokkoi',
    monthlyPrice: 0,
    annualPrice: 0,
    creditsPerMonth: 50,
    cta: 'Get started free',
    ctaMode: 'signup',
    features: [
      '50 credits / month',
      'Mobile-web bridge (paste from Lovable, Bolt, v0)',
      'Inline phone preview',
      'Single project',
    ],
  },
  {
    id: 'hobby',
    name: 'Hobby',
    tagline: 'Build on the side',
    monthlyPrice: 12,
    annualPrice: 122,
    creditsPerMonth: 110,
    cta: 'Start Hobby',
    ctaMode: 'waitlist',
    features: [
      '110 credits / month',
      'Everything in Free',
      'GitHub export',
      'Unlimited projects',
      'Email support',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Ship products',
    monthlyPrice: 29,
    annualPrice: 296,
    creditsPerMonth: 260,
    badge: 'most-popular',
    cta: 'Start Pro',
    ctaMode: 'waitlist',
    overage: '$0.12 / credit',
    features: [
      '260 credits / month',
      'Everything in Hobby',
      'MCP API access',
      'Custom branding (no Mokkoi watermark)',
      'Priority generation queue',
      'Overage at $0.12 / credit',
    ],
  },
  {
    id: 'team',
    name: 'Team',
    tagline: 'Build together',
    monthlyPrice: 79,
    annualPrice: 806,
    perSeat: true,
    minSeats: 3,
    creditsPerMonth: 700,
    cta: 'Talk to a founder',
    ctaMode: 'mailto',
    ctaTarget: 'sahil@mokkoi.com',
    overage: '$0.10 / credit',
    features: [
      '700 pooled credits / seat / month',
      'Everything in Pro',
      'Shared workspace + project handoff',
      'Centralized billing',
      'SSO (Google Workspace, Okta)',
      'Dedicated Slack with founders',
      'Overage at $0.10 / credit',
    ],
  },
]

export const CREDIT_COSTS = [
  { credits: 2, label: 'Single screen edit' },
  { credits: 5, label: 'New screen' },
  { credits: 8, label: 'Screenshot → screen' },
  { credits: 15, label: '3-screen flow' },
  { credits: 20, label: 'Full app (8 screens average)' },
]

export const FAQS = [
  {
    q: 'Why credits, not "messages"?',
    a: "A one-line tweak shouldn't cost the same as a full 8-screen app. Credits scale with the work: 2 for an edit, 5 for a new screen, 20 for a full app.",
  },
  {
    q: 'What if I run out?',
    a: "Top up anytime at the going rate, or upgrade — we'll prorate the difference. Unused credits roll over for one month on Pro and Team.",
  },
  {
    q: 'Can I use Mokkoi without coding?',
    a: 'Yes. Describe an app, get screens, export to React Native or push to GitHub.',
  },
  {
    q: 'How does Mokkoi compare to Lovable or Bolt?',
    a: 'They build web. We build native mobile-first — and we can import what you already built on those tools.',
  },
  {
    q: 'Do you support iOS deploys?',
    a: 'GitHub export today; managed TestFlight / EAS deployment lands soon (waitlist on Pro).',
  },
  {
    q: 'What models do you use?',
    a: 'Claude Sonnet 4.6 with prompt caching, plus our own Mokkoi prompt pipeline tuned for React Native fidelity.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Annual plans refund unused months pro-rata in the first 14 days.',
  },
]

export const HERO = {
  headline: 'Pricing that ships with you.',
  subhead:
    'Build native mobile apps from one prompt. Pay for what you generate — nothing else.',
}

export const TRUST_BAND = 'No surprise bills. Hard caps by default. Toggle on overage when you’re shipping fast.'
