// Copy and sample data for the Mokkoi X-ray landing. Samples come from real checks
// (docs/mokkoi-due-diligence-spec-2026-10-29.md, mokkoi_validation reports).

export type Status = 'contradicted' | 'unverified' | 'verified'

export interface SampleClaim { claim: string; correction?: string; status: Status; label: string; source: string }
export interface Sample {
  id: string
  tab: string
  title: string
  meta: string
  score: number
  verdictLead: string
  verdict: string
  claims: SampleClaim[]
}

export const SAMPLES: Sample[] = [
  {
    id: 'video',
    tab: 'AI video SaaS',
    title: 'AI video SaaS on Flippa',
    meta: 'Asking $25,000, checked 29 Oct 2026',
    score: 41,
    verdictLead: "Don't value this on the headline.",
    verdict: "The listing's own data shows about half the MRR the title claims.",
    claims: [
      { claim: '~$1.7K MRR', correction: '$968 MRR, 18 subscribers', status: 'contradicted', label: 'Contradicted', source: 'Flippa metrics panel' },
      { claim: '80% margin', status: 'unverified', label: "Doesn't add up", source: 'Profit vs revenue math' },
      { claim: '10% churn', status: 'unverified', label: 'Ask', source: 'Monthly churn, about 70% a year' },
      { claim: 'Stripe connected', status: 'verified', label: 'Verified', source: 'Flippa data integration' },
    ],
  },
  {
    id: 'geo',
    tab: 'IP location API',
    title: '12-year-old IP location API on Flippa',
    meta: 'Starting bid $4,500, checked 29 Oct 2026',
    score: 58,
    verdictLead: 'Real and stable, but check two things first.',
    verdict: "The profit figure doesn't match the MRR, and the data licence behind the product isn't disclosed.",
    claims: [
      { claim: 'Site age 12 years', status: 'verified', label: 'Verified', source: 'Domain registered June 2014' },
      { claim: '$123/mo profit at 71%', correction: '71% of $594 MRR is about $420', status: 'contradicted', label: 'Contradicted', source: 'Listing metrics' },
      { claim: 'Costs: hosting, domain, email', status: 'unverified', label: 'Incomplete', source: 'No data licence listed' },
      { claim: 'Ruby on Rails', status: 'verified', label: 'Verified', source: 'Server headers and cookies' },
    ],
  },
  {
    id: 'own',
    tab: 'Our own old app',
    title: 'Mokkoi v1, our own AI design app',
    meta: 'Not for sale. We x-rayed ourselves first.',
    score: 22,
    verdictLead: "The website works. The product doesn't.",
    verdict: 'The landing page loads in about a second, but the database behind it was deleted, so nobody can sign in.',
    claims: [
      { claim: 'Live product, sign up free', correction: 'Database domain no longer exists', status: 'contradicted', label: 'Contradicted', source: 'DNS and API check' },
      { claim: 'Ready for search engines', status: 'unverified', label: 'Partly', source: 'robots.txt returns an HTML page' },
      { claim: 'Fast to load', status: 'verified', label: 'Verified', source: 'About 1 s to interactive' },
      { claim: 'No secret keys exposed', status: 'verified', label: 'Verified', source: 'Public code scan' },
    ],
  },
]

export const FINDINGS: { area: string; status: Status; title: string; body: string }[] = [
  { area: 'Revenue', status: 'contradicted', title: 'The title says $1.7K MRR. The platform says $968.', body: "We compare every claim in the listing against the listing's own verified data." },
  { area: 'Market', status: 'unverified', title: 'Same price since 2016, 50 times more included.', body: 'Archived pricing pages show when a business has been quietly losing pricing power.' },
  { area: 'Tech', status: 'contradicted', title: "The app's backend no longer exists.", body: "The site loads, but sign-in can't work. We check that the database and API actually respond." },
  { area: 'Transfer', status: 'unverified', title: 'The core data licence may not transfer.', body: "We flag what you'd lose on handover: licences, personal accounts, keys tied to the founder." },
]

export const CHECK_GROUPS: { name: string; level: string; checks: string[] }[] = [
  { name: 'Tech and security', level: 'Every report', checks: ['Stack and hosting', 'Backend and API actually respond', 'Secret keys leaked in public code', 'SSL, security headers, uptime'] },
  { name: 'History', level: 'Every report', checks: ['Domain age and ownership changes', 'Pivots and content changes over the years', 'Pricing history', 'Signs of active maintenance'] },
  { name: 'Traffic and search', level: 'Every report', checks: ['Traffic vs the revenue claimed', 'Search ranking and backlink quality', 'Index health and sitemap', 'Bot traffic patterns (with analytics access)'] },
  { name: 'Market and reputation', level: 'Every report', checks: ['Reviews and complaints', 'Competitors and free alternatives', 'Dependence on one channel or one AI provider'] },
  { name: 'Revenue', level: 'Full and Deep', checks: ['MRR, churn and cohorts from Stripe', 'Customer concentration', 'Refunds and chargebacks', 'True costs and margin'] },
  { name: 'Handover', level: 'Full and Deep', checks: ['Licences and third-party terms', 'Accounts tied to the founder', 'Code ownership and quality', 'Hidden AI and API costs'] },
]

export const COMPARE_ROWS: { label: string; diy: string; mokkoi: string; human: string }[] = [
  { label: 'Cost', diy: 'Free', mokkoi: '$49 to $499', human: '$1,500 to $2,900+' },
  { label: 'Time', diy: 'Days of evenings', mokkoi: '15 minutes to 48 hours', human: '1 to 2 weeks' },
  { label: 'Evidence for every finding', diy: 'If you keep notes', mokkoi: 'Yes, linked', human: 'Usually' },
  { label: 'Checks the code and backend', diy: 'Only if you can code', mokkoi: 'Yes', human: 'Sometimes extra' },
  { label: 'Practical for every deal you look at', diy: 'Not really', mokkoi: 'Yes', human: 'No, one deal at a time' },
]

export const FAQ: { q: string; a: string }[] = [
  { q: 'Does the seller know I ran a report?', a: "No. A Quick X-ray only uses public information, the same things any buyer could look up. Deeper checks (Stripe, analytics, code) need the seller to give access, so they'll know about those." },
  { q: 'The listing hides the website. What do I paste?', a: 'Paste whatever you can see: the listing link, or the website address from your own Flippa or Acquire account after you sign their NDA. We never log in to marketplaces for you.' },
  { q: 'How accurate is it?', a: "Every finding links to its evidence. When we can't prove something, it's marked as a question for the seller, not stated as fact. A report helps you ask better questions; it isn't a guarantee." },
  { q: 'Can this replace a full due diligence?', a: 'For small deals, many buyers use a Full or Deep X-ray as their main check. For bigger deals, use Mokkoi to decide which one deserves a paid human audit. Either way it is information, not legal or financial advice.' },
  { q: 'What kinds of businesses can you check?', a: 'Anything with a website, but we are best at software: SaaS, AI apps, APIs and tools. Ecommerce and content sites get the tech, history, traffic and reputation checks.' },
  { q: "What if you can't produce a report?", a: "If we can't deliver the report you paid for, you get a full refund." },
]
