# Bolt-Style Landing + Template Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Mokkoi's template-grid Dashboard hero with a Bolt-style minimal landing, and add a fuzzy template-matcher so generation quality is preserved when templates are no longer visible.

**Architecture:** Two independent changes wired at the seam: (1) frontend Dashboard hero redesign (pure UI, no data changes) and (2) a pure-function template matcher in `api/lib/` that the planner calls before building its system prompt. `APP_TEMPLATES` data is untouched.

**Tech Stack:** React 19 + Vite, Vercel serverless TS functions, Anthropic SDK via fetch, vitest (new) for the matcher unit tests.

**Spec:** [docs/superpowers/specs/2026-04-22-bolt-style-landing-design.md](../specs/2026-04-22-bolt-style-landing-design.md)

**Locked decisions from spec §6:**
- Hero copy: **"What will you build today?"**
- Accent word in headline: **build**
- Credits indicator: move to top-right nav

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `api/lib/template-matcher.ts` | Create | Pure function: user prompt → matched template id or null + score |
| `api/lib/template-matcher.test.ts` | Create | Vitest unit tests: 6 positive cases + 6 negative cases |
| `api/generate-flow.ts` | Modify (~line 275) | Splice matched template's structural prior into planner system prompt |
| `api/lib/design-system.ts` | Modify | Export a function `buildPlannerSystem(matchedTemplateId?: string)` that composes the existing `APP_PLANNER_SYSTEM_PROMPT` with an optional template hint block |
| `src/pages/Dashboard.tsx` | Modify (lines ~700–870) | Hero redesign: new headline, remove template grid, compact "or start from" link, move credits to top nav |
| `src/data/appTemplates.ts` | **Unchanged** | Data stays as-is |
| `vitest.config.ts` | Create | Vitest config, api-only test include |
| `package.json` | Modify | Add `vitest` devDep + `test` script |

Tasks are ordered so backend (matcher) ships first — it's the load-bearing piece. Frontend redesign comes second because it's visually dramatic but depends on the matcher being wired for quality parity.

---

## Task 0: Test runner setup

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Add vitest as a devDependency**

```bash
npm install --save-dev vitest@^2.1.0
```

Expected: `package.json` updated, `node_modules/vitest` exists.

- [ ] **Step 2: Add `test` script to package.json**

In `package.json` `scripts` block, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['api/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
  },
})
```

- [ ] **Step 4: Verify vitest runs (no tests yet, should exit 0)**

Run: `npm test`
Expected: vitest prints "No test files found" and exits 0, OR finds no files and exits 0. Either is fine; non-zero exit means config broken.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest for api unit tests"
```

---

## Task 1: Template matcher — failing tests

**Files:**
- Create: `api/lib/template-matcher.test.ts`

- [ ] **Step 1: Write the test file**

```ts
import { describe, it, expect } from 'vitest'
import { matchTemplate } from './template-matcher'

describe('matchTemplate', () => {
  it('matches fitness template from explicit pill text', () => {
    const result = matchTemplate('A fitness tracking app')
    expect(result?.templateId).toBe('fitness')
    expect(result?.score).toBeGreaterThan(0.7)
  })

  it('matches food-delivery from "food delivery app"', () => {
    expect(matchTemplate('A food delivery app')?.templateId).toBe('food-delivery')
  })

  it('matches social-media from "social media app"', () => {
    expect(matchTemplate('A social media app')?.templateId).toBe('social-media')
  })

  it('matches ecommerce from "e-commerce shopping app"', () => {
    expect(matchTemplate('An e-commerce shopping app')?.templateId).toBe('ecommerce')
  })

  it('matches banking from "banking & finance app"', () => {
    expect(matchTemplate('A banking & finance app')?.templateId).toBe('banking')
  })

  it('matches music from "music streaming app"', () => {
    expect(matchTemplate('A music streaming app')?.templateId).toBe('music')
  })

  it('matches fitness from paraphrased input', () => {
    expect(matchTemplate('build me a workout tracker with exercises and progress charts')?.templateId).toBe('fitness')
  })

  it('matches food-delivery from paraphrased input', () => {
    expect(matchTemplate('I want a restaurant ordering and delivery app with cart and tracking')?.templateId).toBe('food-delivery')
  })

  it('returns null for generic prompts with no template match', () => {
    expect(matchTemplate('build me a to-do list')).toBeNull()
  })

  it('returns null for a puzzle game prompt', () => {
    expect(matchTemplate('a sudoku puzzle game with timer')).toBeNull()
  })

  it('returns null for empty prompt', () => {
    expect(matchTemplate('')).toBeNull()
  })

  it('returns null for a pet adoption app (no template)', () => {
    expect(matchTemplate('pet adoption marketplace')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm test`
Expected: 12 tests fail with "Cannot find module './template-matcher'" or "matchTemplate is not a function".

- [ ] **Step 3: Commit the failing tests**

```bash
git add api/lib/template-matcher.test.ts
git commit -m "test: add failing tests for template matcher"
```

---

## Task 2: Template matcher — implementation

**Files:**
- Create: `api/lib/template-matcher.ts`

- [ ] **Step 1: Write the matcher module**

Token-based scoring. For each template, we define a keyword set. Score = (matched keywords) / (total keywords in the template's set), weighted so that distinctive words ("fitness", "delivery") count more than generic words ("app"). Return the highest-scoring template if its score ≥ 0.5, else null.

```ts
// api/lib/template-matcher.ts
// Pure function: maps a user prompt to the best-fitting AppTemplate id, or null.
// Designed to recover the "hidden prior" benefit of the template grid after the
// grid is removed from the landing page.

interface TemplateKeywords {
  id: string
  primary: string[]   // must-have anchor terms (score boost)
  secondary: string[] // supporting terms
}

const TEMPLATE_KEYWORDS: TemplateKeywords[] = [
  {
    id: 'fitness',
    primary: ['fitness', 'workout', 'exercise', 'gym'],
    secondary: ['tracker', 'tracking', 'progress', 'health', 'calories', 'steps', 'muscle', 'cardio', 'yoga', 'hiit', 'strength'],
  },
  {
    id: 'food-delivery',
    primary: ['food', 'delivery', 'restaurant', 'restaurants'],
    secondary: ['order', 'ordering', 'menu', 'cart', 'cuisine', 'pizza', 'sushi', 'tracking', 'rider'],
  },
  {
    id: 'social-media',
    primary: ['social', 'feed', 'posts'],
    secondary: ['media', 'profile', 'followers', 'following', 'stories', 'messages', 'notifications', 'comments', 'likes'],
  },
  {
    id: 'ecommerce',
    primary: ['ecommerce', 'e-commerce', 'shopping', 'shop', 'store'],
    secondary: ['product', 'products', 'cart', 'checkout', 'catalog', 'buy', 'purchase'],
  },
  {
    id: 'banking',
    primary: ['banking', 'bank', 'finance', 'financial'],
    secondary: ['transactions', 'transfer', 'balance', 'account', 'wallet', 'payment', 'card', 'savings'],
  },
  {
    id: 'music',
    primary: ['music', 'song', 'songs', 'audio'],
    secondary: ['streaming', 'stream', 'playlist', 'playlists', 'player', 'album', 'artist', 'podcast'],
  },
]

const PRIMARY_WEIGHT = 2
const SECONDARY_WEIGHT = 1

export interface TemplateMatch {
  templateId: string
  score: number
}

export function matchTemplate(prompt: string): TemplateMatch | null {
  if (!prompt || !prompt.trim()) return null

  const tokens = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  const tokenSet = new Set(tokens)

  let best: TemplateMatch | null = null

  for (const t of TEMPLATE_KEYWORDS) {
    let hits = 0
    let maxPossible = 0

    for (const kw of t.primary) {
      maxPossible += PRIMARY_WEIGHT
      if (tokenSet.has(kw) || tokens.join(' ').includes(kw)) hits += PRIMARY_WEIGHT
    }
    for (const kw of t.secondary) {
      maxPossible += SECONDARY_WEIGHT
      if (tokenSet.has(kw)) hits += SECONDARY_WEIGHT
    }

    // Require at least one primary hit — prevents "cart" alone from matching ecommerce over food-delivery
    const primaryHit = t.primary.some(kw => tokenSet.has(kw) || tokens.join(' ').includes(kw))
    if (!primaryHit) continue

    const score = hits / maxPossible
    if (!best || score > best.score) best = { templateId: t.id, score }
  }

  if (!best || best.score < 0.15) return null
  return best
}
```

- [ ] **Step 2: Run tests, verify all pass**

Run: `npm test`
Expected: 12/12 passing. If any fail, tune the keyword sets and/or the 0.15 threshold — do NOT loosen tests.

- [ ] **Step 3: Commit**

```bash
git add api/lib/template-matcher.ts
git commit -m "feat: add fuzzy template matcher for planner prior"
```

---

## Task 3: Planner system-prompt composition

**Files:**
- Modify: `api/lib/design-system.ts` (add one export near the existing `APP_PLANNER_SYSTEM_PROMPT`)

- [ ] **Step 1: Read the existing planner prompt to understand the insertion point**

Run: `grep -n "APP_PLANNER_SYSTEM_PROMPT" api/lib/design-system.ts`
Expected: one `export const APP_PLANNER_SYSTEM_PROMPT = ...` line.

- [ ] **Step 2: Add a `buildPlannerSystem` function at the bottom of `design-system.ts`**

Paste the function. Do NOT remove or edit the existing `APP_PLANNER_SYSTEM_PROMPT` — `buildPlannerSystem` composes it.

```ts
// Appended at the bottom of api/lib/design-system.ts

const TEMPLATE_PRIORS: Record<string, string> = {
  'fitness': `
The user wants a FITNESS app. Typical screens:
- Home: today's stats (calories/steps/heart rate), workout streak, quick-start CTA, recent workouts list
- Workouts: category cards (Strength / Cardio / Yoga / HIIT) with hero images, popular workouts list with ratings
- Workout Detail: header image, stats row (sets/reps/duration), exercise list, start-workout CTA
- Progress: weekly activity chart area, body measurement stats (weight / body fat), recent achievements
- Profile: avatar, fitness goals with progress bars, achievement badges, settings links
Use health-forward content (12-day streak, 420 cal, 8240 steps) and a green accent.`,
  'food-delivery': `
The user wants a FOOD DELIVERY app. Typical screens:
- Home: location header, search bar, featured promo card ("30% off first order") with real food image, cuisine category chips, nearby restaurants with photos/ratings
- Restaurant Detail: hero image, menu sections, item cards with prices, add-to-cart buttons
- Cart: line items with qty controls, price breakdown (subtotal/delivery/total), checkout CTA
- Order Tracking: status timeline (Confirmed → Preparing → On the way → Delivered) with icons and timestamps, map placeholder, order details card
- Profile: avatar, stats row (orders / rating / spent), saved addresses, payment methods
Use orange accent, rich food photography, empty states with clear CTAs.`,
  'social-media': `
The user wants a SOCIAL MEDIA app. Typical screens:
- Feed: stories row (circular avatars), post cards with avatar/image/caption/like-comment-share
- Profile: cover photo, avatar, stats (posts/followers/following), bio, photo grid
- Messages: search bar, conversation list with avatars/preview/timestamp
- Notifications: grouped list (likes/comments/follows) with icons and timestamps
- Search/Explore: trending topics, grid of popular posts
Use purple accent, avatar-heavy content, realistic usernames.`,
  'ecommerce': `
The user wants an E-COMMERCE app. Typical screens:
- Home: hero banner, category tiles, product grid with images/prices/ratings
- Product Detail: image carousel, title/price/rating, description, add-to-cart CTA
- Cart: line items with qty, price breakdown, checkout CTA
- Checkout: address, payment method, order summary
- Orders/Profile: order history list, account links
Use pink/magenta accent, product photography, star ratings.`,
  'banking': `
The user wants a BANKING/FINANCE app. Typical screens:
- Home: account balance card (large), quick actions (transfer/pay/deposit), recent transactions list
- Transactions: filter chips, grouped list by date with merchant icons and amounts
- Transfer: recipient selection, amount input, review screen
- Cards: card carousel, card details, transaction filter
- Profile: account info, security settings
Use blue/navy accent, clear numeric hierarchy, positive/negative amount coloring.`,
  'music': `
The user wants a MUSIC STREAMING app. Typical screens:
- Home: featured playlists, recently played, recommended albums
- Player: album art (large), track title/artist, progress bar, playback controls
- Library: tabs (Playlists / Artists / Albums / Songs), list views
- Search: search bar, genre grid, results list
- Profile: listening stats, followed artists
Use dark background with vibrant accent, album art everywhere, waveform/progress bars.`,
}

export function buildPlannerSystem(matchedTemplateId?: string | null): string {
  if (!matchedTemplateId) return APP_PLANNER_SYSTEM_PROMPT
  const prior = TEMPLATE_PRIORS[matchedTemplateId]
  if (!prior) return APP_PLANNER_SYSTEM_PROMPT
  return `${APP_PLANNER_SYSTEM_PROMPT}

# TEMPLATE HINT (user prompt matched an archetype)
${prior}

Use this as structural guidance only. The user's own requirements take precedence.`
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add api/lib/design-system.ts
git commit -m "feat: add buildPlannerSystem for template-aware priors"
```

---

## Task 4: Wire matcher into generate-flow.ts

**Files:**
- Modify: `api/generate-flow.ts` (line ~4 import; line ~275 system-prompt usage)

- [ ] **Step 1: Update the import on line ~4**

Change:

```ts
import { DESIGN_TOKENS, CONTENT_LIBRARY, COMPONENT_TYPES, VIEWPORT_BUDGET, CONTENT_DENSITY, PLATFORM_RULES, QUALITY_CHECKLIST, FUNCTIONAL_APP_RULES, APP_PLANNER_SYSTEM_PROMPT } from './lib/design-system.js'
```

To:

```ts
import { DESIGN_TOKENS, CONTENT_LIBRARY, COMPONENT_TYPES, VIEWPORT_BUDGET, CONTENT_DENSITY, PLATFORM_RULES, QUALITY_CHECKLIST, FUNCTIONAL_APP_RULES, APP_PLANNER_SYSTEM_PROMPT, buildPlannerSystem } from './lib/design-system.js'
import { matchTemplate } from './lib/template-matcher.js'
```

- [ ] **Step 2: Use the matcher at the planner call site (line ~275)**

Find the block:

```ts
    const planResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        system: [{ type: 'text', text: APP_PLANNER_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: prompt }],
      }),
    })
```

Insert the matcher call BEFORE the fetch and replace the `system` line:

```ts
    const templateMatch = matchTemplate(prompt)
    if (templateMatch) {
      console.log(`[planner] template match: ${templateMatch.templateId} (score=${templateMatch.score.toFixed(2)})`)
    }
    const plannerSystem = buildPlannerSystem(templateMatch?.templateId)

    const planResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        system: [{ type: 'text', text: plannerSystem, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: prompt }],
      }),
    })
```

- [ ] **Step 3: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: zero errors; build completes.

- [ ] **Step 4: Commit**

```bash
git add api/generate-flow.ts
git commit -m "feat: wire template matcher into planner system prompt"
```

---

## Task 5: Dashboard hero — remove template grid

**Files:**
- Modify: `src/pages/Dashboard.tsx` lines ~836–870

- [ ] **Step 1: Delete the template-grid block**

Remove the entire JSX block that begins with `{/* App templates */}` (~line 836) through its closing `)}` (~line 870). This includes the `<div id="mokkoi-templates">` container and the `APP_TEMPLATES.map(...)` grid.

- [ ] **Step 2: Remove the `APP_TEMPLATES` import on line 11**

Change:
```ts
import { APP_TEMPLATES } from '../data/appTemplates'
```
to a removal (delete the line entirely). Leave `src/data/appTemplates.ts` itself alone — backend will read it if ever needed; frontend no longer imports it.

- [ ] **Step 3: Remove `handleTemplateClick` function**

Find the function (~line 220, defined `const handleTemplateClick = (templateId: string) => { ... }`) and delete it. It's no longer referenced.

- [ ] **Step 4: Remove the scroll-to-templates action in the "or start from" row**

In the `{ label: 'Template', icon: '📱', action: () => document.getElementById('mokkoi-templates')?.scrollIntoView(...) }` entry (~line 801), change the action to `() => setToastMessage('Template picker coming soon')` so the button remains but does nothing visible.

- [ ] **Step 5: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: zero errors. If `isSubmitting` or other removed references break elsewhere, fix them.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "refactor: remove visible template grid from dashboard hero"
```

---

## Task 6: Dashboard hero — Bolt-style redesign

**Files:**
- Modify: `src/pages/Dashboard.tsx` lines ~700–820 (welcome block + pills + input + "or start from" row)

- [ ] **Step 1: Replace the `<h1>` and subhead**

Find (~line 705):

```tsx
<h1 style={{
  fontSize: hasProjects ? 28 : 32, fontWeight: 700, color: '#f1f5f9',
  margin: '0 0 8px', letterSpacing: '-0.02em',
  fontFamily: "'Outfit', 'DM Sans', sans-serif",
}}>
  {hasProjects ? `Welcome back, ${firstName}` : 'What app do you want to build?'}
</h1>
{!hasProjects && (
  <p style={{ fontSize: 15, color: '#64748b', margin: '0 0 24px', lineHeight: 1.5 }}>
    Describe your app — Mokkoi builds it with real React Native code
  </p>
)}
```

Replace with:

```tsx
<h1 style={{
  fontSize: hasProjects ? 32 : 48, fontWeight: 700, color: '#f1f5f9',
  margin: '0 0 12px', letterSpacing: '-0.02em', textAlign: 'center',
  fontFamily: "'Outfit', 'DM Sans', sans-serif", lineHeight: 1.1,
}}>
  {hasProjects ? (
    `Welcome back, ${firstName}`
  ) : (
    <>What will you <span style={{
      background: 'linear-gradient(135deg, #6366f1, #818cf8)',
      WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
      fontStyle: 'italic',
    }}>build</span> today?</>
  )}
</h1>
{!hasProjects && (
  <p style={{ fontSize: 16, color: '#94a3b8', margin: '0 0 32px', lineHeight: 1.5, textAlign: 'center' }}>
    Create stunning mobile apps by chatting with AI.
  </p>
)}
```

- [ ] **Step 2: Reorder — move pills BELOW the input (Bolt order)**

Cut the `{/* Suggestion chips */}` block (~line 718) and paste it AFTER the `{/* Chat input area */}` closing `</div>` (~line 778), with a `marginTop: 20` on its container.

- [ ] **Step 3: Hide pills for returning users**

Wrap the pills container with `{!hasProjects && ( ... )}` — they only show for first-time users.

- [ ] **Step 4: Update input placeholder**

Change `placeholder="Describe the app you want to build..."` (~line 752) to `placeholder="Let's build"`.

- [ ] **Step 5: Replace the "or start from" 3-button row with a compact text link**

Find the `{/* Or start from — quick actions */}` block (~line 791–820) and replace with:

```tsx
{!buildingTemplate && !hasProjects && (
  <div style={{ marginTop: 20, textAlign: 'center' }}>
    <span style={{ fontSize: 12, color: '#475569' }}>or start from </span>
    <button
      onClick={() => setToastMessage('Screenshot import coming soon')}
      style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 12, cursor: 'pointer', padding: '0 4px' }}
    >Screenshot</button>
    <span style={{ fontSize: 12, color: '#475569' }}> · </span>
    <button
      onClick={() => setToastMessage('HTML import coming soon')}
      style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 12, cursor: 'pointer', padding: '0 4px' }}
    >Import HTML</button>
  </div>
)}
```

(Note: we drop "Template" from this row — no visible template picker anywhere per the spec.)

- [ ] **Step 6: Remove credits line from below input**

Find the `{/* Credits indicator below input */}` block (~line 780–789) and delete it entirely. Credits will live in the top nav (Task 7).

- [ ] **Step 7: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: zero errors.

- [ ] **Step 8: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "feat: bolt-style hero copy and layout"
```

---

## Task 7: Move credits indicator to top-right nav

**Files:**
- Modify: `src/pages/Dashboard.tsx` top-nav region

- [ ] **Step 1: Find the top nav**

Run: `grep -n "10000 remaining\|credits.remaining\|credits.plan" src/pages/Dashboard.tsx`
Expected: several hits. Identify the top-navbar region (usually has the user avatar + menu button).

- [ ] **Step 2: Add the credits pill to the top nav**

Near the user avatar in the top-right nav, insert:

```tsx
{credits && (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '6px 12px', borderRadius: 20,
    background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
    fontSize: 12, color: '#818cf8', fontWeight: 500,
  }}>
    <Zap size={12} />
    {credits.remaining} remaining
  </div>
)}
```

(Exact JSX parent depends on current nav structure — place it immediately before the avatar button.)

- [ ] **Step 3: Visual verify in dev server**

Run: `npm run dev`
Open the Dashboard as a first-time user (or mock `hasProjects: false`). Verify:
- Hero shows "What will you **build** today?" centered, large
- Subhead "Create stunning mobile apps by chatting with AI."
- Input with placeholder "Let's build"
- 6 pills below the input
- Tiny "or start from Screenshot · Import HTML" text link
- No template grid anywhere
- Credits pill in top-right nav
- No console errors

- [ ] **Step 4: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "feat: move credits indicator to top nav"
```

---

## Task 8: End-to-end quality parity check

**Goal:** Confirm that typing "A fitness tracking app" into the new hero produces output of equivalent quality to today's Fitness template click.

- [ ] **Step 1: Deploy to Vercel preview (or run locally with real API keys)**

Run: `vercel --prod=false` (or use a preview branch). Ensure `ANTHROPIC_API_KEY` is set.

- [ ] **Step 2: Generate app A — via pill**

- Land on Dashboard as a first-time user
- Click the "A fitness tracking app" pill
- Submit
- Wait for generation
- Screenshot the 5 generated screens

- [ ] **Step 3: Check server logs**

In Vercel logs (or local console), find the line:
```
[planner] template match: fitness (score=0.XX)
```
Expected: score ≥ 0.5. If missing, the matcher didn't fire — debug before continuing.

- [ ] **Step 4: Compare against baseline (pre-change) fitness-template output**

Open a previous project generated via the old fitness template click. Side-by-side with the new output:
- Screen count should be equivalent (5)
- Screen roles should cover Home / Workouts / Workout Detail / Progress / Profile
- Content density should match (stat tiles, streak counter, workout cards with images)
- If the new output is visibly thinner, the template prior in `design-system.ts` needs more detail — iterate.

- [ ] **Step 5: Log the result**

Append to `docs/yc-roadmap-2026-04-22.md` under a new "## Landing refactor verification" section, 3–5 bullets summarizing:
- Match scores for all 6 pills
- Side-by-side parity verdict
- Any follow-ups surfaced

- [ ] **Step 6: Commit verification notes**

```bash
git add docs/yc-roadmap-2026-04-22.md
git commit -m "docs: landing refactor verification log"
```

---

## Task 9: Final QA checklist

- [ ] All unit tests pass: `npm test` → 12/12
- [ ] TypeScript clean: `npx tsc --noEmit` → 0 errors
- [ ] Build clean: `npm run build` → success
- [ ] Lint clean: `npm run lint` → 0 errors (or same as baseline)
- [ ] Manual dev server smoke test: hero renders, pills pre-fill, submission works
- [ ] Returning user (hasProjects=true) still sees "Welcome back" hero with projects list below
- [ ] No references to `APP_TEMPLATES` remain in `src/pages/Dashboard.tsx`
- [ ] `src/data/appTemplates.ts` unchanged (backend can still read it if we ever need it)

---

## Done

After Task 9 passes, the landing looks like Bolt's, templates are invisible but still boost quality via the matcher, and the YC roadmap's landing chunk is checked off. Next roadmap chunk: Prompt Pipeline v2 (Wirer + Validator).
