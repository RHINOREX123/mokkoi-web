# Mokkoi — "Keeps your AI-built app alive"

**Status:** plan for founder review, 2026-10-29. Nothing is built yet.
**One-liner:** Mokkoi watches the apps people build with AI, catches what breaks,
and hands their agent the fix.

**Background research:**
- `Desktop/MILLION DOLLAR $$$$/IDEA_CATALOGUE.md` (cards #11–13)
- `…/mokkoi_validation/` (QuickTables teardown, mokkoi.com Check)

---

## 1. The product in one picture

```
 Paste your app URL ──► Mokkoi scans it (2 min) ──► Health report: score /100
        │                                            🔴 DB open to anyone
        │                                            🟠 signup broken since Tue
        │                                            🟢 SEO fine
        ▼                                                │
 Mokkoi re-checks every day ──► alert (email/Slack) ──► "Fix it" = ready prompt
                                                         for Lovable / Claude Code
                                                         (or pulled directly by the
                                                         agent through Mokkoi's MCP)
```

**Who it's for:** people with a **live** app built on Lovable, Bolt, Replit, v0,
Cursor or Claude Code who have no developer, ops or security person. Agencies that
build such apps for clients are the second segment.

## 2. Sentry vs Lovable's scan vs Mokkoi

| | **Sentry** | **Lovable built-in scan** | **Indie scanners** (Vibecheck, VibeEval, Vibesecur…) | **Mokkoi** |
|---|---|---|---|---|
| What it watches | Code errors and crashes *inside* the app | Your code and DB rules *before publish* | One-off security scan | The **live app from the outside, every day**, plus code and DB if connected |
| Setup | Install an SDK in the code (developer job) | Built in, Lovable only | Paste URL | **Paste URL**; connect GitHub or Supabase for more depth |
| Catches "backend deleted / paused / down" | No (no errors fire if nobody can log in) | No | No | **Yes** |
| Catches "signup broke after last change" | Only if it throws an error | No | No | **Yes**: an agent actually signs up every day |
| Works across builders | Yes | Lovable only | Some | **Yes**: Lovable, Bolt, Replit, v0, Cursor, Claude Code |
| Explains in plain English | No (stack traces) | Partly | Partly | **Yes** |
| Fix | Seer AI suggests a code fix (developer) | Auto-fix inside Lovable | Report | **Fix prompt and MCP for any agent**, plus guard rules so the bug doesn't come back |

**Positioning:** Sentry is for developers. Lovable's scan only runs at publish
time. **Mokkoi is the always-on night watchman for non-developers, across every AI
builder.**

**Honest risks:**
- Lovable keeps improving its scan.
- Sentry or a scanner could launch a "vibe" tier.
- **Defence:** post-launch, cross-platform, journey testing that actually *uses*
  the app, and partnership with the builders instead of competing with them.

## 3. What Mokkoi checks

### Level 1: Outside only (paste a URL)

These checks are safe on any app.

- Up or down, response time, SSL and domain expiry.
- **Backend alive:** the Supabase or Firebase project resolves and responds. This
  is the check that would have caught mokkoi.com.
- Secrets leaked in the JS bundle: service-role key, Stripe `sk_`, OpenAI or
  Anthropic keys.
- Security headers, CORS `*` on API routes.
- SEO basics: robots.txt (and whether it's real or HTML), sitemap, canonical,
  `lang`, OG tags, blank first paint.
- Performance: bundle size, Lighthouse score, console errors, broken links.
- Detects which tool built the app (Lovable / Bolt / v0 fingerprints), so the
  report can speak that tool's language.

### Level 2: Owner-verified

The owner proves the app is theirs with a DNS TXT record, a meta tag, or a
GitHub/Supabase connection. The active checks below are **never** run on apps
the user hasn't verified.

- **Supabase RLS read test with the anon key:** which tables return data to a
  stranger.
- **RLS policy lint with an AI reviewer:**
  - `USING (true)` on ALL policies;
  - "unclaimed row" patterns;
  - policies whose name doesn't match what they do.

  (These found #4 and #5 on mokkoi.com.)
- **API route audit (GitHub):**
  - routes that skip auth;
  - auth that fails open;
  - client-trusted user IDs in checkout;
  - missing Stripe webhook signature check;
  - unprotected AI endpoints that burn credits.

### Level 3: Journey checks (an agent uses the app)

- Every day a browser agent runs the owner's critical paths with a test account:
  sign up, log in, do the core action, check out in Stripe test mode.
- Alert: "Signup has failed since Tuesday's deploy. Here's the screenshot and the
  fix prompt."

## 4. Where agent harnesses and REA fit

### Agent harness: yes, this is the core engine

Mokkoi's checker *is* an agent harness. It is the same idea as Claude Code, but
specialised for watching apps.

- **Loop and model:** Claude Agent SDK (or Claude Managed Agents later). Use Haiku
  for routine checks and Sonnet/Opus for judgement: RLS policy review, root cause,
  writing the fix.
- **Tools:**
  - headless browser (Playwright, or Browserbase as a hosted option);
  - HTTP fetcher;
  - DNS/SSL probe;
  - Supabase anon prober (verified apps only);
  - GitHub repo reader;
  - Lighthouse.
- **Skills (playbooks):** one skill per check family (`supabase-rls`,
  `exposed-secrets`, `auth-routes`, `seo-basics`, `journey-signup` …). Adding a
  check means adding a skill. The crew in `Desktop/mokkoi-crew` is the same
  pattern.
- **Permissions and hooks:** hard rules in the harness. Active probes only on
  verified domains, read-only by default, no writes ever.
- **Output harness pack:** for each finding, Mokkoi writes:
  1. the **fix prompt**;
  2. a **guard rule** to add to the user's `AGENTS.md` / `CLAUDE.md` / Lovable
     knowledge, e.g. "every new table must enable RLS with owner-only policies".

  The user's own agent then stops re-creating the bug. That turns Mokkoi from
  "alarm" into "it makes your AI builder smarter". **Neither Sentry nor the
  scanners do this.**
- **Mokkoi MCP server:** the user's Claude Code or Cursor can ask Mokkoi "what's
  broken in my app?" and fix it in place. We already built an MCP server once
  (`mcp-server/`, published as `mokkoi-mcp`), so the know-how is here.

### REA (Reverse Engineer Anything): helpful, but not for v1

- **What it is:** [morluto/rea](https://github.com/morluto/rea), an MIT-licensed
  MCP server and CLI that lets agents take apart web apps (page structure,
  scripts, network, HAR files), JS/Electron, Android APKs, .NET and binaries. It
  runs locally and has no hosted product.
- **v1 doesn't need it.** Every check run on QuickTables and mokkoi.com used plain
  browser and fetch calls.
- **Use it later for:**
  1. **Deep bundle analysis.** Map a built app's routes, API calls and network
     traffic from a HAR file, to find hidden endpoints and leaked keys.
  2. **Teardowns:** the public "how is X built" pages that market Mokkoi.
  3. **Mobile:** Android APK checks if Mokkoi ever covers Rork-style mobile apps.
- **Risks:**
  - The project is very new.
  - Fake trojan copies circulate, so pin the official npm package and run it in
    a sandbox only.
  - It may launch its own hosted product.

### Teardowns: marketing, not the product

The QuickTables-style x-ray becomes free public pages ("How X is built and what's
broken in it"). They bring search traffic and shares, and each ends with **"Check
your own app free →"**.

## 5. What we reuse from `mokkoi-web`

| Reuse | From | Note |
|---|---|---|
| Auth, accounts | Supabase auth, `AuthPage`, `auth-helper.ts` | **Fix the fail-open bug first** (Check #02, finding 3) |
| Payments | `create-checkout`, `create-topup`, `stripe-webhook` | Fix the client-trusted `userId` (finding 7) |
| Usage and credits, rate limits | `usage_logs`, `plan-rate-limiter.ts`, `userPlan.ts` | |
| Claude calls with model routing and prompt caching | `api/generate.ts` patterns | Haiku for routine, Sonnet for judgement |
| MCP server | `mcp-server/` | Same pattern, new tools: `get_issues`, `get_fix`, `rescan` |
| App shell, dashboard, landing, pricing | `src/pages`, `src/components` | Restyle for the new product |
| **Drop** | Snack, react-native-web runtime, normalizer, canvas, RN generation | Tag the repo `mobile-builder-final` before deleting |

**New pieces:**
- **Scheduler:** Vercel cron or Supabase `pg_cron`.
- **Browser worker:** Playwright on a small Railway/Fly box, or Browserbase.
  Vercel functions are a poor fit for a full Chrome, and the Vercel 12-function
  limit already bit us.
- **Email alerts:** Resend.
- **Fresh Supabase project:** about +$10/mo on your Pro plan. Don't restore the old
  mobile-builder backup.

## 6. Pricing (to test in interviews)

| Plan | Price | What you get |
|---|---|---|
| **Free** | $0 | 1 app, weekly outside scan, health score, 3 fix prompts |
| **Pro** | $19–29/mo | 3 apps, daily checks, instant alerts, all fix prompts, verified RLS/secret checks, MCP |
| **Builder / Agency** | $79–99/mo | 15+ apps, journey checks, white-label client reports ("your site's monthly health") |

## 7. Execution plan

### Week 0–1: Validate before building

- Replace the dead mokkoi.com app with a **landing page and waitlist**. Use the
  one-liner, a sample report, and "Check my app free (beta)".
- Publish 3 public x-rays (QuickTables, plus 2 popular Lovable or Bolt apps). Use
  outside checks only and never name a vulnerability on someone else's app
  publicly.
- Post in r/lovable, r/vibecoding, r/SaaS, the Lovable Discord, X and Indie
  Hackers. **Offer free manual health checks** to people with live apps, and run
  them by hand the way we did for mokkoi.com.
- Hold 10 interviews (Mom Test): how do you know your app is working today? What
  broke last month? What would you pay?
- **Go/no-go gate:** at least 100 waitlist sign-ups **and** at least 5 people who
  say "I'd pay" (ideally pre-pay $19).

### Weeks 2–4: MVP (Level 1 + alerts)

- Paste URL → scan → health report page (score, findings, fix prompts).
- Owner verification (meta tag / DNS TXT).
- Daily re-check plus email alerts.
- Stripe Pro plan.
- Harness v1: Agent SDK loop, 6–8 check skills, Haiku/Sonnet routing.

### Weeks 5–8: Depth

- Supabase connection (verified RLS read test plus AI policy lint).
- GitHub connection (route and auth audit).
- Journey checks (signup and login agent).
- Mokkoi MCP server plus guard-rule export (the `AGENTS.md` pack).

### Months 3–6: Distribution and acquisition track

- Agency tier and white-label reports.
- **Integrations:** a Lovable/Bolt "connect Mokkoi" flow, a GitHub app and a
  Claude Code plugin. Pitch Lovable a **partnership** first (the Sutro path).
- **"State of AI-built apps" report:** aggregated, anonymised stats from scans,
  aimed at press and backlinks.
- Teardown library for search traffic.
- **Metrics acquirers care about:** apps monitored, ARR, integrations, and how
  many issues were found and fixed.

## 8. Rules we don't break

- Active probing (RLS reads, auth tests, journeys) **only on owner-verified apps**.
  Public x-rays use passive, public data only.
- Read-only by default; Mokkoi never writes to a user's database.
- Never publicly expose a specific vulnerability in someone else's app. Notify the
  owner privately instead.
- Store user credentials and tokens encrypted. Request the minimum OAuth scopes.

## 9. Decisions for the founder

1. **Name for the product inside Mokkoi** (e.g. just "Mokkoi", or "Mokkoi Watch").
2. **Pricing:** start at $19 or $29 for Pro?
3. **Browser worker:** self-hosted Playwright (cheaper, more work) or Browserbase
   (faster to ship, roughly pay per use)?
4. **First integration to pitch:** Lovable (biggest), Bolt, or Supabase?

## Sources

- Lovable's built-in security scan: https://docs.lovable.dev/features/security
- Sentry MCP and Seer: https://docs.sentry.io/ai/mcp/
- Indie scanners and vibe-app breach stats (vendor numbers, indicative only):
  - https://www.symbioticsec.ai/blog/we-scanned-1-072-vibe-coded-apps-98-had-security-flaws
  - https://www.vibecheck.it.com/compare
  - https://vibe-eval.com/guides/best-vibe-coding-security-tools/
- REA: https://github.com/morluto/rea
- Supabase billing (about $10 per extra project): https://supabase.com/docs/guides/platform/billing-faq
