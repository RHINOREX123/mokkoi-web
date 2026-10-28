# Mokkoi Due Diligence — product & system design

**Status:** design draft for founder review, 2026-10-29. Nothing is built.

**One-liner:** *The $99 x-ray before you spend $50,000.* Mokkoi checks any small online
business (SaaS, AI app, content site, ecommerce) before you buy it, and gives you a
plain-English verdict with evidence, red flags, and the questions to ask the seller.

**Why Mokkoi (not ThriveForge-sized effort):** reports are sold one at a time, each one is
done when it is delivered, there is no face or daily outreach, and the engine is the same
one we used by hand on QuickTables and mokkoi.com.

---

## 1. The market gap

| Option today | Price | Speed | Problem |
|---|---|---|---|
| DIY (most micro-buyers) | $0 | days to weeks | Buyers miss technical, security, and traffic-fraud issues |
| Quick human review (e.g. Centurica) | about $199 | days | Limited depth |
| Flippa DD service | from about $1,500 (3rd-party figure) | days | Too costly to screen many listings |
| WebAcquisition micro-SaaS DD | $2,900+ | 7 days | Too costly before an LOI |
| Tech DD firms | $8K–95K | 2–4 weeks | Built for big deals |
| **Mokkoi** | **$49–499** | **minutes to 24 h** | It is the screen *before* you pay for (or instead of) a human audit |

**Two buyers of reports:**
1. **Acquirers.** Screen many listings fast, then go deep on one. Serial buyers screen dozens, so they want a subscription.
2. **Sellers.** A "Mokkoi Verified" report raises trust and sale price. The seller pays, and the badge sits in the listing, which also works as marketing because every buyer who sees the listing sees Mokkoi.

## 2. How Mokkoi "sees" a business: 3 access levels

The rule: **what Mokkoi may touch depends on who has given permission.** A buyer is
*not* the owner, so without seller consent everything is passive and public.

### Level 0: Public x-ray (only a listing URL or website URL needed)
Passive, public data only. No logins, no form submits, no probing the backend.

| Check | Source / tool |
|---|---|
| Tech stack, builder fingerprint (Lovable, Bolt, WordPress, Shopify…) | Headless browser, JS bundle and header fingerprints (open-source Wappalyzer rule sets) |
| Site health: up, speed, errors, SSL, security headers, **backend alive** | Browser plus fetch, PageSpeed Insights API (free), DNS and SSL probes |
| Secrets leaked in public JS (service keys, Stripe `sk_`, AI keys) | Bundle scan; REA later for deep bundle and HAR analysis |
| Domain age and ownership history | WHOIS / RDAP |
| **Site history**: pivots, when content appeared, past owners | Wayback Machine CDX API (free) |
| Traffic plausibility | Third-party traffic estimates (Similarweb-type API or cheaper SEO APIs such as DataForSEO), Google index count |
| SEO and backlinks: quality, spam links, sudden drops | SEO API, sitemap and robots, Search Console (Level 1 only) |
| Reputation: reviews, Reddit/X/Product Hunt mentions, complaints | Web and Reddit search, Trustpilot/G2/app-store ratings |
| **Platform risk**: thin "ChatGPT wrapper", single-API dependency, ToS-violating niche | AI analysis of the product and its pricing |
| **Listing claims vs evidence**: revenue vs traffic, "passive" vs real work, age claims | Parse the listing and cross-check every claim against the above |

### Level 1: Seller-shared (seller gives read-only access)
- **Stripe**: a restricted read-only API key, or the Flippa-verified data → MRR, churn, cohorts, refunds, customer concentration.
- **Google Analytics / Search Console**: read-only user → real traffic, sources, bot patterns.
- **Hosting / DB**: read-only console or billing exports → real costs and margin.
- With the seller's written consent, the **active** security checks that Mokkoi Check uses (Supabase RLS read test and similar) become allowed.

### Level 2: Deep code audit (seller shares the repo)
- Read-only GitHub collaborator access, or a zip upload, run in a sandbox.
- **Checks:** security (the mokkoi.com-style findings), code quality and AI-generated-code risk, dependency and licence issues, test coverage, "bus factor".
- **Hidden costs:** AI API spend per user vs price.
- **Transferability:** accounts tied to the founder's personal email, hard-coded keys, third-party ToS.

## 3. The report (what the customer gets)

1. **Verdict page:** 🟢 / 🟡 / 🔴 plus a score out of 100, with a 5-line summary: "would we keep looking at this deal and why".
2. **Claims vs evidence table**: every claim in the listing, marked ✅ verified / ⚠️ unverified / ❌ contradicted, each linked to evidence.
3. **Red flags**, ranked, each with its evidence (screenshot, URL, data point).
4. **Sections:**
   - Tech & security
   - Traffic & SEO
   - Revenue & unit economics (Level 1)
   - Market & reputation
   - Platform risk
   - Transferability
5. **Questions to ask the seller**, generated from the gaps found.
6. **What to verify before closing** (and whether a human audit is worth it).
7. **Valuation sanity check.** Typical multiples for this kind of business, and whether the asking price is in range. Clearly labelled *not financial advice*.
8. **First-30-days plan if you buy.** This is also where Mokkoi Watch is upsold later.
9. **Evidence appendix**: every source, timestamped.

**Formats:** web report page (shareable link) and PDF.

## 4. Products & pricing (to validate)

| Product | Level | Price | Delivery |
|---|---|---|---|
| **Quick X-ray** | 0 | $49 | about 15 minutes |
| **Full X-ray** | 0 + 1 | $199 | within 24 h |
| **Deep X-ray** | 0 + 1 + 2 | $499 | within 48 h |
| **Buyer plan** | 0 | $99/mo for 5 Quick X-rays | serial acquirers |
| **Seller "Mokkoi Verified"** | 0 + 1 (+2) | $149–299 | badge plus public report link for the listing |

These are still 3–30× cheaper than human DD, so the pitch is "use Mokkoi to choose which deal deserves a $2,000 audit."

## 5. The agent harness: how Mokkoi actually runs a report

A report is a long, multi-step investigation, so it runs on an **agent harness** (Claude Agent SDK), not a single prompt.

```
 Order (listing URL + level + any seller access)
        │
        ▼
 ┌─────────────── ORCHESTRATOR (planner) ───────────────┐
 │ reads listing → extracts claims → plans investigation │
 └──────┬────────┬─────────┬─────────┬────────┬─────────┘
        ▼        ▼         ▼         ▼        ▼          (parallel subagents)
     Tech &   Traffic &  Revenue  Market &  Transfer-
     Security   SEO      (L1)    Reputation  ability
        │        │         │         │        │
        └────────┴────► EVIDENCE STORE ◄──────┘   every finding = claim + proof + source + time
                              │
                              ▼
                   SKEPTIC / VERIFIER agent
           (attacks each red flag; drops anything
            not backed by evidence; flags uncertainty)
                              │
                              ▼
                  REPORT WRITER + SCORER → web report + PDF
```

**Harness parts and how Mokkoi uses them:**
- **Model routing.**
  - Haiku: data gathering and parsing.
  - Sonnet: section analysis.
  - Opus: skeptic, verdict, and score.
  - Prompt caching on the skill instructions keeps cost per report low (target **< $2 in model cost for a $49 report**).
- **Tools:**
  - headless browser (Playwright, or Browserbase as a hosted option)
  - fetch, DNS/WHOIS/SSL
  - Wayback API, PageSpeed API, SEO/traffic API, web/Reddit search
  - Stripe/GA readers (L1), sandboxed repo reader (L2)
  - REA for deep bundle/HAR analysis
- **Skills (playbooks):** one per check, e.g. `listing-claims`, `stack-fingerprint`, `backend-alive`, `leaked-secrets`, `wayback-history`, `traffic-plausibility`, `seo-backlinks`, `reputation`, `platform-risk`, `stripe-metrics`, `code-audit`, `transferability`, `valuation-sanity`. Adding a check means adding a skill.
- **Permissions and hooks (safety built into the harness, not left to the model's judgement):**
  - **L0 = GET-only allow-list.** A hook blocks any POST, form submit, or login against the target.
  - Active probes only when the order carries recorded seller consent.
  - Every request is logged, which is also what fills the evidence appendix.
- **Evidence-first rule:** a finding without attached evidence cannot reach the report. This is the anti-hallucination guard, and the reason buyers can trust it.
- **Budget and timeouts:** a cap on tokens and time per report level. Sessions resume if a step fails.
- **Evals (harness engineering):**
  - A benchmark set of real listings with known outcomes (sold, failed, fraud found), plus our QuickTables and mokkoi.com cases.
  - Every change to prompts or skills is re-run against it, and the change ships only if accuracy does not drop.
  - This is the moat: the harness gets measurably better with every report.

## 6. What we reuse from `mokkoi-web`

- Supabase auth, Stripe checkout and webhook, usage and credits (fix the Check #02 bugs first).
- The Claude API patterns: model routing and prompt caching.
- Landing, pricing, and dashboard shells.
- The MCP server know-how (a Mokkoi MCP for buyers' own agents comes later).
- **New:** report runner (background worker plus Agent SDK), evidence store table, report page and PDF render, order flow.

## 7. Rules we never break

- No active testing of a business without the **seller's** written consent. Buyers alone get passive Level 0 only.
- Never publish a report about a listing without the seller's permission. Buyer reports are private.
- Every report says: *informational, not legal, financial or investment advice; verify before you buy.*
- Seller credentials are read-only and least-scope, encrypted, and deleted after the report.
- Use only official APIs or permitted public data; respect robots.txt and rate limits.

## 8. Go-to-market (no face, low time)

- **Sample reports:** 2–3 anonymised Level 0 reports on public listings, showing real red flags with details redacted.
- **Search traffic:** pages like "how to do due diligence on a SaaS before buying", "Flippa listing red flags", "is this Acquire.com listing legit". Buyers search for exactly this.
- **Communities:** r/microsaas, r/SaaS, r/Entrepreneur, r/smallbusiness, Indie Hackers acquisition threads, and micro-acquisition newsletters (e.g. *The Business Inquirer*). Posts are text, not video.
- **Partnerships:**
  - apply to **Flippa's due-diligence partner directory**;
  - pitch Acquire.com, brokers, and escrow/legal providers on a referral fee.
- **Seller badge loop:** every "Mokkoi Verified" listing advertises Mokkoi to every buyer who views it.

## 9. Build plan (side-project pace, about 4–6 h/week from the founder)

| Phase | What | Founder does | Claude does |
|---|---|---|---|
| **1. Concierge (wk 1–2)** | Landing page plus "order a report" (Stripe link), 2 sample reports | Post in 3 communities, apply to the Flippa partner directory | Build the page, produce the sample reports and each paid report with Claude Code skills |
| **2. Automate L0 (wk 3–6)** | Harness v1: orchestrator, 6 skills, evidence store, skeptic, web report | Review reports before sending | Build the pipeline and evals |
| **3. L1 and seller badge (wk 7–10)** | Stripe/GA read-only connectors, "Mokkoi Verified" | Pitch 5 brokers / partners | Connectors, badge page |
| **4. L2 and buyer plan (later)** | Sandboxed code audit, subscription | — | Code-audit skills |

**Go/no-go after Phase 1:** at least 5 paid reports from strangers. Fewer than that, and we rethink the offer before automating anything.

## 10. Decisions for the founder

1. **Launch side:** buyers first, sellers first, or both? (Recommendation: buyers first, because they have the urgent pain; add the seller badge in Phase 3.)
2. **Entry price:** $49 or $99 for the Quick X-ray?
3. **Scope:** all online businesses, or start with **SaaS and AI apps only**? (Recommendation: SaaS/AI apps first, since that is our edge.)
4. **Paid data APIs:** budget about $50–100/mo for traffic and SEO data, or start with free sources only?

## 11. System architecture

**Design principle: code gathers, Claude judges.** Deterministic checks (DNS, SSL,
Wayback, pricing-page history, bundle scan, PageSpeed) are plain TypeScript functions.
They are cheap, repeatable and never hallucinate. Claude is used only where judgement
is needed: extracting claims, cross-checking evidence, the skeptic pass, verdict and
writing. This keeps cost per report around $1–2 and makes reports trustworthy.

```
 mokkoi.com (React/Vite on Vercel)          Vercel API functions
 ├─ Landing / pricing / order form   ──►    ├─ create-order → Stripe/Lemon Squeezy checkout
 ├─ Report viewer (shareable link)          ├─ payment webhook → insert job into `reports` (status=queued)
 └─ Dashboard (my reports)                  └─ get-report (RLS: owner only)
                                                     │
                                Supabase (Postgres + Storage + Auth)
                                ├─ orders, reports, findings, evidence (+ RLS)
                                └─ storage: screenshots, HAR files, PDFs
                                                     │  (worker polls queued jobs)
                                                     ▼
                     REPORT WORKER  (Node/TS on Railway or Fly, ~$5–20/mo)
                     ├─ 1. Collectors (plain code): listing parser, HTTP/headers, DNS/RDAP,
                     │     SSL, Wayback CDX, bundle/secret scan, PageSpeed, SEO API, search
                     │     → every result saved as an `evidence` row (source, timestamp)
                     ├─ 2. Harness (Anthropic TS SDK, tool runner):
                     │     Orchestrator ─► 5 specialist agents in parallel ─► Skeptic ─► Writer
                     │     tools = read_evidence, request_extra_check (allow-listed), add_finding
                     ├─ 3. Scorer + PDF render → upload → status=done → email the customer
                     └─ Safety hooks: GET-only on Level 0, consent check for active probes,
                        per-report token/time budget, full request log
```

**Level 2 (code audit).** Run inside an isolated sandbox: **Claude Managed Agents**
(Anthropic hosts the sandbox, about $0.08 per session-hour plus tokens) or the Claude
Agent SDK in a throwaway container. The seller's code never touches our main server.

**Agent harness setup:**
- **Orchestrator.** Reads the listing and the evidence index, extracts claims, and
  decides which specialists run and which extra checks they may request.
- **Specialists:** Tech & Security, Traffic & SEO, Revenue (Level 1), Market &
  Reputation, Transferability. Each one is a separate Claude call with its own
  skill prompt (cached), working only from the evidence store.
- **Skeptic.** Gets every proposed red flag and must keep it, downgrade it or drop
  it, with a reason. Findings without evidence IDs are rejected automatically in
  code, not by trusting the model.
- **Writer and scorer.** Turn the surviving findings into the report and a
  rubric-based score.
- **Evals.** A folder of benchmark listings, with QuickTables, mokkoi.com and
  PointP.in as the first three. A script re-runs them after every prompt or skill
  change and compares the findings.

## 12. Claude vs ChatGPT (OpenAI) API

**Recommendation: Claude.**
- Long agentic tool use and careful reasoning over messy evidence are exactly what
  this product needs. Claude is strong at both, and the 1M context window means a
  whole evidence pack fits in one call.
- The tooling fits the plan: the TypeScript SDK tool runner for the harness,
  prompt caching (cached reads cost about 10% of normal input), Batch API (50% off
  for non-urgent reports), and Managed Agents for sandboxed code audits.
- `mokkoi-web` already uses the Anthropic SDK with model routing and prompt caching
  (`api/generate.ts`), so it's a known path for us.
- Keep a thin model layer (one `callModel()` module) so switching or A/B testing
  another provider later is a small change, not a rewrite.

**Model routing:**

| Model | Price per million tokens (input / output) | Use it for |
|---|---|---|
| Claude Haiku 5.5 | $0.10 / $0.50 | Parsing and extraction |
| Claude Sonnet 5.5 | $2 / $10 | Specialists |
| Claude Opus 5.5 | $4 / $20 | Skeptic, verdict, writer |

Prices are Anthropic's list rates as of Oct 2026; check before launch.

## 13. Costs

### Model cost per report (estimate; measure on real runs)

| Report | Token assumption | Estimated Claude cost | Price | Gross margin on model cost |
|---|---|---|---|---|
| Quick X-ray (L0) | Haiku about 200K in / 20K out; 5 Sonnet specialists about 60K in / 8K out each; Opus skeptic+writer about 100K in / 15K out | **about $1.50–2.50** (less with caching) | $49–99 | about 95–97% |
| Full X-ray (L0+L1) | About 2× the Quick report | **about $3–6** | $199 | about 97% |
| Deep X-ray (+code) | Repo-size dependent, plus Managed Agents session time | **about $8–25** | $499 | about 95% |

Data APIs (SEO/traffic) add roughly $0.10–1 per report on pay-as-you-go plans.

### Monthly running costs (before revenue)

| Item | Cost/mo | Note |
|---|---|---|
| Supabase project | about $10 | Extra project on your existing Pro plan |
| Vercel Pro | $20 | Hobby is for non-commercial use, so a paid product needs Pro |
| Worker hosting (Railway/Fly) | about $5–20 | Runs collectors, Playwright and the harness |
| SEO/traffic data API | $0–50 | Start with free sources (Wayback, PageSpeed, RDAP), then add pay-as-you-go |
| Email (Resend) | $0 | Free tier is enough at the start |
| Error monitoring (Sentry free) | $0 | |
| Claude API | about $5–30 | Samples, testing and evals before revenue |
| **Total** | **about $40–130 / month** | |

### One-time and per-sale costs
- **Payments.** For a founder in India, selling globally, a merchant of record such as
  **Lemon Squeezy or Paddle** (about 5% + $0.50 per sale) handles international tax and
  VAT for you. Stripe directly is cheaper (about 3–4% for international cards) but
  leaves tax to you.
- **Legal pages** (terms, privacy, "not financial advice" disclaimer): $0–200 using
  generators or templates. Have a lawyer review once revenue starts.
- **Domain:** already owned (mokkoi.com).

### Budget to kick-start
- **Phase 1 (concierge, weeks 1–2):** about **$30–60** total. Vercel plus a few dollars
  of API for sample reports; reports are made with Claude Code by hand.
- **Phases 2–3 (automation, weeks 3–10):** about **$50–130/month**.
- **Realistic total to reach first revenue: about $150–400.** The main cost is time, not
  money. Five Quick X-ray sales at $49 cover a month of running costs.

## Sources
- Micro-SaaS DD pricing: https://webacquisition.com/due-diligence/saas-software/micro-saas/ ; https://vibehackers.io/ideas/redline-76bcd26a (3rd-party summary of Flippa and Centurica prices)
- Tech DD costs (vendor-authored): https://kolonell.com/en/blog/technical-due-diligence-audit-cost-saas-acquisition-new-york-2026
- DIY DD with little budget: https://skalingventures.substack.com/p/issue-3-dd-hacks-and-b2b-acquisition
- Flippa verified data and DD checklist: https://support.flippa.com/hc/en-us/articles/4842857720079-Understanding-verified-listings-on-Flippa ; https://flippa.com/blog/due-diligence-checklist/ ; https://flippa.com/blog/introducing-our-new-stripe-integration/
- Red flags from real deals: https://bigideasdb.com/saas-acquisition-due-diligence-checklist
- Stripe trust-score tools (adjacent competitor): https://makerstack.co/reviews/trustmrr-review/
