# Mokkoi Dashboard V2 — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-05-06-dashboard-redesign.md`
**Mockup (visual source of truth):** `mockups/dashboard-concepts.html`
**Target file (current monolith):** `src/pages/Dashboard.tsx`
**New component dir:** `src/components/dashboard/`

---

## How to use this plan

- 10 numbered steps, grouped into 4 phases by dependency
- **Phase 1 must finish before any Phase 2/3/4 work starts** (it sets up tokens + the foundational `PhoneThumbnail`)
- **Within Phase 2 & 3**, most steps are independent — you can run them in parallel Claude Code sessions if you want
- Each step is a self-contained PR-able unit: one or two files, one feature, testable in isolation
- After each step, refresh `localhost` and visually compare to `mockups/dashboard-concepts.html`
- **Stop after each step for human review** before continuing

## Dependency graph

```
                    [1. Tokens & fonts]
                           │
                ┌──────────┼──────────┐
                ▼          ▼          ▼
          [2. PhoneThumb] [3. Hero atmos]   ──── Phase 1
                │          │
   ┌────────────┼──────────┴──┬─────────┬──────────┐
   ▼            ▼             ▼         ▼          ▼
[4. Hero]  [5. PromptCard]  [6. HUD]  [7. Modes] [9. Footer]  ── Phase 2
                                                  │
                                                  ▼
                                          [8. Recents strip]   ── Phase 3
                                                  │
                                                  ▼
                                       [10. Wire-up + responsive] ── Phase 4
```

## Conventions for every step

- Match the mockup visually (semantic match — minor anim/glow tuning is fine)
- Use the design tokens from step 1 (no hex literals in components)
- One component per file, named-export the component
- Use CSS modules or styled-jsx — match whatever pattern the existing `src/pages/Dashboard.tsx` uses
- Add a Storybook-like demo route only if one already exists; do **not** add a new dependency
- After implementation, manually verify in browser; no need to write unit tests for visual components in this redesign
- Commit after each step with message: `feat(dashboard): step N — <component>`

---

# Phase 1 — Foundations

## Step 1 · Design tokens & fonts

**Files:**
- `src/styles/tokens.css` (new) — all CSS variables from spec §10
- `index.html` or root layout — add Google Fonts links for Outfit + JetBrains Mono (DM Sans should already be there; verify)
- Import `tokens.css` once at app root

**Acceptance:**
- Open any page → `getComputedStyle(document.body).getPropertyValue('--teal')` returns `#2dd4bf`
- Outfit and JetBrains Mono load (verify in Network tab)
- Existing pages render unchanged

**Definition of done:** tokens available app-wide, fonts loaded, no visual regression.

---

## Step 2 · `PhoneThumbnail` component

**Files:**
- `src/components/dashboard/PhoneThumbnail.tsx` (new)
- `src/components/dashboard/PhoneThumbnail.module.css` (or styled-jsx) (new)

**Props:**
```ts
type PhoneThumbnailProps = {
  screenContent?: ReactNode  // optional rendered preview (v1: gradient + initial fallback)
  projectName: string         // for the gradient seed + initial
  state?: 'ready' | 'generating' | 'empty'
  size?: 'sm' | 'md'          // sm for sidebar list (24px); md for cards (default)
}
```

**Behavior:**
- Renders phone bezel + dynamic island + status bar + content area + tab bar
- `state='generating'` → dashed-border + teal shimmer animation (per spec §11)
- `state='empty'` → blank phone, dashed outline only
- Default fallback content: deterministic gradient (hash project name → 1 of 8 gradient pairs) + uppercase project initial
- 9:19.5 aspect ratio (iPhone 16 ratio)

**Acceptance:**
- Drop `<PhoneThumbnail projectName="TastePlan" />` somewhere → renders the gradient+initial fallback
- Pass `state='generating'` → shimmer animates
- Visual match to mockup phone-frame

**Definition of done:** standalone component renders correctly in 3 states.

---

## Step 3 · Hero atmosphere (background layer)

**Files:**
- `src/components/dashboard/HeroBackground.tsx` (new) — purely presentational, absolute-positioned background

**Layers (back-to-front):**
1. Solid background `var(--bg)` (`#04060a`)
2. Radial-gradient aurora bloom — bottom-center, teal+aqua, blurred
3. Faint dot grid texture (background-image: radial-gradient circles, 32px tile)
4. Vignette mask — dark edges so content reads center-bright

**Acceptance:**
- Renders absolutely-positioned layer; `pointer-events: none`; covers entire hero area
- Visual match to `.c1 .hero` background in mockup

**Definition of done:** atmosphere layer ready to drop into hero section.

---

# Phase 2 — Core dashboard refactor

> **Prerequisites:** Phase 1 done. Steps 4–7 and 9 can run in parallel after that.

## Step 4 · `DashboardHero` shell + welcome headline + session label

**Files:**
- `src/components/dashboard/DashboardHero.tsx` (new)
- `src/components/dashboard/DashboardHero.module.css` (new)

**What it renders (initially):**
- `<HeroBackground />` (from step 3)
- Mono session label: `● BUILD SESSION · {date} · {time} · {user}@MOKKOI`
- `<h1>` with welcome text:
  - If user has projects: `Welcome back, <span class="grad cursor-blink">{firstName}</span>`
  - If no projects: `What will you <em class="grad">build</em> today?`
- Below: an empty `<div class="hero-content" />` placeholder where steps 5/6/7/9 will mount

**Replaces:** the `<h1>` + welcome block in current `Dashboard.tsx` lines 663–685

**Acceptance:**
- Mounted in `Dashboard.tsx`, visible on `/` after login
- Pulsing teal dot animates on session label
- Cursor blinks after first name
- Layout matches mockup `c1 .hero`

**Definition of done:** hero shell rendered correctly without prompt/HUD/modes yet (those land in subsequent steps).

---

## Step 5 · `PromptCard` with holographic border + Plan/Build toggle

**Files:**
- `src/components/dashboard/PromptCard.tsx` (new)
- `src/components/dashboard/PromptCard.module.css` (new)

**Props:**
```ts
type PromptCardProps = {
  value: string
  onChange: (v: string) => void
  onSubmit: (mode: 'build' | 'plan') => void
  disabled?: boolean   // true during 'submitted' state
}
```

**Renders:**
- Glassmorphism card (background: `rgba(15,22,24,0.55)`, backdrop-blur)
- Animated holographic conic-gradient border (rotating 8s, mask-composited so only border shows)
- Multi-line `<textarea>` with placeholder `"Let's build — describe your app, paste a screenshot, or import a Figma file…"`
- Bottom-left: 3 icon buttons: `📷 Screenshot` `+ Attach` `◇ Figma` (mock handlers — no functional uploads in this step; toast "coming soon" for now)
- Bottom-right: Plan/Build segmented toggle + Send button (`↑`)
- Send button shows linear-gradient teal→aqua when prompt non-empty; disabled state when `disabled=true`
- Enter submits (Shift+Enter for newline)

**Plan/Build toggle:**
- 2-segment control, default `Build`
- Calls `onSubmit('build' | 'plan')` accordingly
- Auto-suggest behavior is part of step 10 (wire-up); for now the toggle just routes the mode

**Acceptance:**
- Mount in DashboardHero (step 4 shell)
- Holo border slowly rotates
- Typing updates value through `onChange`
- Send button hot-keys: Enter submits, Shift+Enter newline

**Definition of done:** prompt input fully functional except for clarity scoring + auto-suggest (step 10).

---

## Step 6 · `SignalsHUD` 3-state component + `usePromptScore` hook

**Files:**
- `src/components/dashboard/SignalsHUD.tsx` (new)
- `src/components/dashboard/SignalsHUD.module.css` (new)
- `src/components/dashboard/usePromptScore.ts` (new) — debounced mock scoring hook

**`usePromptScore` (mock for v1):**
```ts
export type PromptScore = {
  clarity: number      // 0-100
  specificity: number  // 0-100
  scope: 'clear' | 'broad' | 'narrow'
  topImprovement: string
}
export function usePromptScore(prompt: string, debounceMs = 600): PromptScore | null
```

**Mock implementation (deterministic, no network):**
- Returns `null` for empty prompt (idle state)
- 600ms debounce after last keystroke
- Heuristics:
  - clarity = clamp(prompt.length / 1.5, 0, 95) - bonus if contains "user"/"goal"
  - specificity = +10 per detected screen name keyword (home, login, dashboard, settings, etc.)
  - scope = 'broad' if < 30 chars, 'clear' if 30-200, 'narrow' if > 300
  - topImprovement: pick the lowest-scoring axis and return matching string from a small lookup
- Document clearly that this is a stub: real LLM/heuristic scoring lands in a separate task

**`SignalsHUD` component:**
- Props: `score: PromptScore | null`, `state: 'idle' | 'submitted'` (typing inferred from score !== null)
- Renders the 3 state views per spec §5; only one visible at a time
- Idle state: rotating tip text every 6s
- Typing: 10-segment micro-bar visualizing clarity, specificity number, scope text, topImprovement hint
- Submitted: green checkmarks + "BUILDING ... · X SCREENS"
- Scanline pulse animation on top edge
- ARIA-live region announces clarity changes for screen readers

**Acceptance:**
- Mount in DashboardHero below PromptCard
- Empty prompt → idle state visible with rotating tips
- Typed prompt → after 600ms shows live scores
- Pass `state='submitted'` → checkmarks variant

**Definition of done:** HUD renders all 3 states; scoring is mock-deterministic but feels live.

---

## Step 7 · `ModeCards` (Build / Screenshot / Import)

**Files:**
- `src/components/dashboard/ModeCards.tsx` (new)
- `src/components/dashboard/ModeCards.module.css` (new)

**Renders:** 3 cards in horizontal grid (per spec §6)

**Props:**
```ts
type ModeCardsProps = {
  onMode: (mode: 'build' | 'screenshot' | 'import') => void
}
```

**Behavior:**
- Click `Build` → focuses the prompt input (no submit; user types prompt and submits via PromptCard)
- Click `Screenshot` → opens file picker (existing screenshot import flow if any; otherwise toast "coming soon")
- Click `Import` → opens import modal (existing flow if any; otherwise toast)

**Acceptance:**
- Mount under PromptCard in DashboardHero
- Hover lift + teal-glow border
- Visual match to mockup `.modes`

**Definition of done:** 3 mode cards render and route correctly to existing handlers (or toast).

---

## Step 9 · `HudFooter`

**Files:**
- `src/components/dashboard/HudFooter.tsx` (new)
- `src/components/dashboard/HudFooter.module.css` (new)

**Renders mono status line:**
```
◆ MOKKOI v2.4 · SONNET 4.6 · READY · {plan.appCount}/{plan.appLimit} BUILDS · {projects.length} PROJECTS
```

- App version reads from `package.json` (or hardcoded for now; document)
- READY/OFFLINE based on `navigator.onLine`
- Plan numbers from `useUserPlan()` hook (existing)
- Color shifts to amber when at 100% of plan limit

**Acceptance:**
- Mount at bottom of DashboardHero, below suggestion chips
- Reflects actual user plan + project count
- Goes amber when limit hit

**Definition of done:** HUD footer mounted with real data.

---

# Phase 3 — Project showcase

## Step 8 · `RecentProjectsStrip` with phone-frame previews

**Depends on:** step 2 (`PhoneThumbnail`)

**Files:**
- `src/components/dashboard/RecentProjectsStrip.tsx` (new)
- `src/components/dashboard/RecentProjectsStrip.module.css` (new)

**Props:**
```ts
type RecentProjectsStripProps = {
  projects: Project[]
  loading: boolean
  onOpenAll: () => void   // opens existing sidebar drawer
}
```

**Renders:**
- Section header `RECENT PROJECTS` (mono, uppercase) + `View all N →` link aligned right
- Grid: 4 cards on desktop, 2 on tablet, horizontal scroll on mobile
- Each card uses `<PhoneThumbnail>` from step 2 + name + meta row
- Loading: 4 skeleton phone-frames
- Empty (0 projects): hide the entire strip

**Behavior:**
- Click card → navigate to `/app/${project.id}` (existing route)
- Hover: card lifts, teal glow, live-dot indicator becomes visible

**Mounted below DashboardHero in Dashboard.tsx**

**Acceptance:**
- Renders the user's 4 most-recent projects (sorted by `updated_at` desc)
- "View all N →" opens sidebar drawer
- Loading skeletons appear while projects fetch
- Mobile: horizontally scrollable

**Definition of done:** recent projects visible above-the-fold for users with projects.

---

# Phase 4 — Wire-up & polish

## Step 10 · State management, auto-suggest Plan, responsive, accessibility

**Files:**
- `src/pages/Dashboard.tsx` (touch existing — wire all components together)
- Possibly: `src/components/dashboard/PlanSuggestToast.tsx` (new) for the auto-suggest

**Wires together:**
- PromptCard's `value` ↔ `usePromptScore` ↔ SignalsHUD `score`
- PromptCard's `onSubmit(mode)`:
  - If `mode='build'` AND `score?.clarity < 50` AND not dismissed-this-session:
    - Show inline `PlanSuggestToast` ("Your prompt is broad — want to plan it together first?")
    - User picks: `[Plan together]` → submit with mode='plan'; `[Build anyway]` → submit with mode='build'
  - Otherwise submit immediately
- On submit:
  - Set HUD to `submitted` state
  - 1s delay (per spec §5 state C)
  - Existing `handleSubmitPrompt` flow: create project, navigate to `/app/${id}?prompt=...&mode=build|plan`

**Plan suggestion dismissal:**
- `sessionStorage.setItem('mokkoi.dismissed-plan-suggest', '1')`
- Cleared on next session

**Responsive pass:**
- Verify all breakpoints per spec §12
- Mobile: hide session label, hide HUD footer, stack mode cards, scroll recents

**Accessibility pass:**
- All keyboard-reachable
- Focus rings visible
- aria-labels on icon buttons
- aria-live region in SignalsHUD
- Reduced-motion: kill scanline, holo, shimmer

**Acceptance:**
- Type a vague 20-char prompt → submit → "Plan together" suggestion appears
- Type a specific 100-char prompt → submit → goes straight to /app/:id
- Mobile (375px): no horizontal scroll, all actions reachable
- Lighthouse a11y ≥ 95

**Definition of done:** dashboard ships end-to-end. Existing flows (project create / rename / delete / duplicate) regression-tested manually.

---

# Out-of-scope reminders (do NOT do in this redesign)

These were explicitly punted in the spec — flag them as TODOs in code comments but do **not** implement:

1. Real LLM-backed prompt scoring (replace `usePromptScore` mock)
2. Real screen-thumbnail generation (replace gradient+initial fallback in `PhoneThumbnail`)
3. Post-submit page redesign (`/app/:id` chat panel + canvas — separate spec)
4. Background ornament (kumiko / ensō / star constellation)
5. Hover-to-live-iframe project preview
6. Templates page
7. Model picker beyond status display in HUD footer

---

# Final commit

After step 10 passes manual review:

```
feat(dashboard): redesign with prompt clarity HUD and phone-frame previews

- New components in src/components/dashboard/
- Locked palette + tokens in src/styles/tokens.css
- 3-state SignalsHUD (idle/typing/submitted) with mock scoring
- Plan/Build toggle with auto-suggest when clarity < 50
- Phone-frame project previews (placeholder rendering for v1)
- Mockup source: mockups/dashboard-concepts.html
- Spec: docs/superpowers/specs/2026-05-06-dashboard-redesign.md
```
