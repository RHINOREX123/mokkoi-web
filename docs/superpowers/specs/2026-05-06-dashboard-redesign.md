# Mokkoi Dashboard V2 — Design Spec

**Status:** Approved · ready for implementation plan
**Date:** 2026-05-06
**Owner:** Sahil
**Mockup (visual source of truth):** `mockups/dashboard-concepts.html`
**Replaces:** `src/pages/Dashboard.tsx` (current 850-line monolithic file)

---

## 1. Problem

The current Mokkoi dashboard has three concrete failures:

1. **Empty for returning users.** A user with 54 projects sees a centered prompt + "View your 54 projects →" pill — all their work is hidden behind a hamburger drawer. Wastes the dashboard's real estate.
2. **No differentiation from competitors.** Compared to Rocket, Bolt, Lovable, Fastshot, v0 — Mokkoi looks like another centered-prompt clone.
3. **No prompt-quality signal.** User submits whatever, hope-it-works. No coaching, no clarity feedback. Rocket has post-submit scoring; nobody has live pre-submit scoring.

This redesign solves all three, plus introduces a tech-futuristic aesthetic that becomes Mokkoi's signature.

## 2. Goals

- Dashboard becomes a **build console** that pulls the eye to the prompt input
- Returning users see their work front-and-center via phone-frame project previews
- A **live AI clarity HUD** on the dashboard differentiates Mokkoi from every competitor
- A **Plan / Build toggle** (Lovable-pattern, but smarter — auto-suggested by clarity score) handles fuzzy ideas
- Visual identity: **teal + aqua + aurora atmosphere + mono HUD micro-labels** — distinct from grey-SaaS Rocket, gradient-soft Lovable, glowing-arc Bolt

## 3. Non-goals

- **Real prompt-clarity scoring backend** — scores are mocked initially (deterministic stub); real LLM/heuristic scoring is a separate task
- **Real screen-thumbnail generation pipeline** — phone-frame previews use static/seeded thumbnails for v1; live screenshot generation is a separate task
- **Post-submit page redesign** — the project page (`/app/:id`) keeps its current layout; killing generic template chips and adding template-matching is a separate spec
- **Background ornament** (kumiko / ensō / starfield) — parked for a later polish pass; v1 ships with aurora bloom + dot grid only
- **Model picker** — Sonnet 4.6 hardcoded; status shown read-only in HUD footer
- **Sidebar redesign** — existing drawer sidebar stays as-is for v1 (touched only enough to not break)

## 4. Locked design decisions

| Element | Decision |
|---|---|
| **Layout** | Refined Hero — centered prompt, mode cards below, recents strip below that |
| **Background** | Warm graphite `#04060a` + aurora bloom (radial-gradient) + faint dot grid texture |
| **Palette** | Primary teal `#2dd4bf`, secondary aqua `#06b6d4`, accent amber `#fbbf24` for "premium" only, never use aqua alone — only as gradient end or blurred glow |
| **Typography** | Body: DM Sans · Display: Outfit · HUD micro-labels: JetBrains Mono |
| **Mono micro-labels** | Uppercase, 10.5px, letter-spacing 0.18em, color `var(--text-3)` — used for session label and HUD footer |
| **Welcome headline** | "Welcome back, **{firstName}**" with teal→aqua gradient on the name + blinking-cursor accent (`▎`) after it |
| **Session label (above headline)** | `● BUILD SESSION · {DATE} · {TIME} · {USER}@MOKKOI` — pulsing teal dot |
| **Prompt card** | Glassmorphism, holographic conic-gradient border that slowly rotates (8s loop), screenshot/attach/figma icon buttons bottom-left, send button bottom-right |
| **SignalsHUD (3-state)** | Below prompt; idle / typing / submitted; non-blocking — user can submit anytime |
| **Mode cards** | 3 cards: Build / Screenshot / Import — replaces the tiny "or start from" text links |
| **Suggestion chips** | Same set as today, shown for users with no projects |
| **Plan / Build toggle** | Small segmented control next to send button. Default Build. Plan mode = discuss-first chat. Auto-suggest Plan when clarity < 50% |
| **HUD footer** | Mono status: `◆ MOKKOI v2.4 · SONNET 4.6 · READY · 12/50 BUILDS · 54 PROJECTS` |
| **Recent projects strip** | Phone-frame previews showing real screen glimpses; 4 cards desktop / horizontal scroll mobile; "View all 54 →" link |
| **Project card hover** | Lift + soft teal-glow shadow + live-dot indicator appears top-right (placeholder for future hover-to-live-iframe) |

## 5. SignalsHUD — the three states

Below the prompt input, a single horizontal HUD row that swaps content based on prompt state:

### State A — IDLE (no prompt typed)
```
● MOKKOI READY    ↳ TIP: BE SPECIFIC ABOUT THE USER'S MAIN GOAL    EXAMPLES ↗
```
- Tip rotates every ~6s through a small set: "MENTION THE PRIMARY USER ACTION", "NAME 2-3 KEY SCREENS", "DESCRIBE THE VISUAL VIBE"
- "EXAMPLES ↗" opens a small popover with 3-4 well-formed example prompts

### State B — TYPING (live, debounced)
Triggered ~600ms after user stops typing. Shows real signals (mocked v1):
```
● CLARITY ▮▮▮▮▯▯▯▯▯▯ 62    SPECIFICITY 71    SCOPE CLEAR    ↳ +15 IF YOU NAME THE USER
```
- 10-segment micro-bar visualizes clarity 0–100
- Hint on right (`↳ +15…`) is the single most-actionable improvement Mokkoi detected
- A scanline pulse animates left-to-right across the row (3.2s loop)
- **Non-blocking** — submit button is always active

### State C — SUBMITTED (transition beat before generation)
~1 second hold after Send is clicked, before navigation:
```
✓ CLARITY 62    ✓ SPECIFICITY 71    ✓ SCOPE CLEAR    ↳ BUILDING TASTEPLAN · 4 SCREENS…
```
- Prompt card dims (opacity 0.65), send button disabled
- Score values frozen with `✓` checkmarks
- Then navigates to `/app/${projectId}` with prompt in URL params (existing path)

### Score data shape (mocked in v1)
```ts
type PromptScore = {
  clarity: number    // 0–100
  specificity: number // 0–100
  scope: 'clear' | 'broad' | 'narrow'
  topImprovement: string // single most-impactful suggestion
}
// v1 stub: deterministic function of prompt length + heuristic word presence
// (e.g., contains "user" → +10 specificity, contains screen names → +15 scope)
// Real LLM-backed scoring is a separate task
```

## 6. Mode cards (3 cards under the prompt)

| Card | Badge | Title | Description | Action |
|---|---|---|---|---|
| **Build** | `⚡ Build` (teal) | Generate full app | Multi-screen Flutter app from your prompt. | Submit prompt → `/app/:id` |
| **Screenshot** | `📷 Screenshot` (amber) | Clone what you see | Drop a screenshot, get a working clone. | Open file picker; on upload → `/app/:id?source=screenshot` |
| **Import** | `◇ Import` (lavender) | From Figma / HTML | Pixel-true import via MCP server. | Open import modal (existing flow) |

Replaces the current tiny `or start from Screenshot · Import HTML` text links.

## 7. Phone-frame project previews

Each `proj-card` renders a phone frame containing a glimpse of the project's first/primary screen.

### Anatomy
```
┌────────────── proj-card ──────────────┐
│ ┌────── proj-thumb (4:3) ──────────┐ │
│ │       ┌── phone (9:19.5) ──┐     │ │
│ │       │ ▌── island ──▐      │     │ │
│ │       │ │ status     │      │     │ │
│ │       │ ├────────────┤      │     │ │
│ │       │ │   screen   │      │     │ │
│ │       │ │   preview  │      │     │ │
│ │       │ ├────────────┤      │     │ │
│ │       │ │  tab bar   │      │     │ │
│ │       └────────────────────┘      │ │
│ └─────────────────────────────────┘ │
│ TastePlan                          │ │
│ 4 screens · 2h ago      [Public]   │ │
└──────────────────────────────────────┘
```

### Empty / generating state
- Phone frame with dashed-outline content area
- Subtle teal shimmer animation (`shimmer` 2.4s linear infinite)
- Caption: "Generating preview…" in teal

### v1 implementation note
- For projects with no screen-thumbnail asset yet: render a deterministic gradient + project initial inside the phone frame (graceful fallback)
- Real screen-screenshot generation pipeline (`screens/<id>/thumb.webp` cached in Supabase Storage) is **not** part of this redesign — it's the next task after this ships

## 8. Plan / Build toggle

Small segmented toggle adjacent to the send button:
```
┌────────────────┐  ┌──┐
│ [Build] Plan   │  │ ↑│   ← send
└────────────────┘  └──┘
```

- **Build** (default): submit → `/app/${id}` with prompt → AI generates app immediately (existing flow)
- **Plan**: submit → `/app/${id}?mode=plan` → AI asks 2-3 clarifying questions in chat before generating

### Auto-suggest behavior
When user clicks Send with `mode=build` AND clarity < 50:
- Show a soft inline prompt above the send: *"Your prompt is broad — want to plan it together first?"*
- Two buttons: `[Plan together]` (switches to Plan mode and submits) / `[Build anyway]` (submits as-is)
- Dismissible; remembers per-session

## 9. Layout structure (file/component breakdown)

New components in `src/components/dashboard/`:

```
src/components/dashboard/
├── DashboardHero.tsx       — session label + welcome + prompt + signals + modes + footer
├── PromptCard.tsx          — input + holo border + actions + send + plan/build toggle
├── SignalsHUD.tsx          — 3-state HUD with idle/typing/submitted variants
├── ModeCards.tsx           — Build / Screenshot / Import cards
├── HudFooter.tsx           — mono status line
├── RecentProjectsStrip.tsx — horizontal phone-frame card grid
├── PhoneThumbnail.tsx      — phone frame + screen renderer + empty state
└── usePromptScore.ts       — debounced hook returning mocked PromptScore
```

`src/pages/Dashboard.tsx` shrinks to a thin shell:
- Top nav (existing — minimal touches)
- Sidebar drawer (existing — untouched)
- `<DashboardHero />` (new)
- `<RecentProjectsStrip />` (new)
- Toast / paywall modal (existing)

## 10. Design tokens

Add to `src/styles/tokens.css` (or equivalent — discover existing pattern in plan):

```css
:root {
  /* Surfaces */
  --bg: #04060a;
  --surface: #0d1112;
  --surface-2: #131819;
  --border: rgba(255,255,255,0.06);
  --border-strong: rgba(255,255,255,0.10);

  /* Text */
  --text: #f1f5f9;
  --text-2: #94a3b8;
  --text-3: #64748b;

  /* Brand */
  --teal: #2dd4bf;
  --teal-2: #06b6d4;
  --teal-glow: rgba(45,212,191,0.18);

  /* Accents */
  --accent-amber: #fbbf24;     /* premium / upgrade only */
  --accent-lavender: #a78bfa;  /* "intelligence / AI thinking" only */

  /* Typography */
  --font-body: 'DM Sans', system-ui, sans-serif;
  --font-display: 'Outfit', 'DM Sans', sans-serif;
  --font-mono: 'JetBrains Mono', 'Geist Mono', ui-monospace, monospace;
}
```

Fonts loaded once in `index.html` or root layout via Google Fonts:
- `DM Sans` (existing — confirm)
- `Outfit:wght@500;600;700;800`
- `JetBrains Mono:wght@400;500;700`

## 11. Animations

| Animation | Where | Duration | Easing |
|---|---|---|---|
| `holospin` | Prompt card border (conic gradient rotation) | 8s | linear, infinite |
| `scanline` | SignalsHUD top edge (left→right pulse) | 3.2s | linear, infinite |
| `livepulse` | Mono session-label dot opacity | 1.6s | ease-in-out, infinite |
| `blink` | Headline cursor `▎` | 1s | steps(1), infinite |
| `shimmer` | Empty/generating phone-frame | 2.4s | linear, infinite |
| `proj-card hover` | Lift translateY(-3px) + teal-glow box-shadow | 0.2s | ease |
| `signals state swap` | Cross-fade between idle/typing/submitted views | 0.25s | ease |

All animations respect `prefers-reduced-motion: reduce` — replace with static states.

## 12. Responsive behavior

- **≥1024px** (desktop): full layout as designed; recents strip = 4-column grid
- **768–1023px** (tablet): mode cards stack to 2-up + 1, recents = 2-column grid
- **<768px** (mobile):
  - Mono session label hidden (replaced by simple greeting in nav)
  - Prompt card full-width with reduced padding
  - Mode cards stack vertically
  - SignalsHUD wraps to multi-row, smaller font
  - Recents strip → horizontal scroll
  - HUD footer hidden (info migrates to settings)
  - Sidebar drawer pattern unchanged from current

## 13. Accessibility

- All interactive elements reachable by keyboard (Tab order: prompt → actions → plan/build → send → mode cards → suggestion chips → recents)
- Focus rings: 2px teal outline + 4px transparent halo
- `aria-label`s on icon-only buttons (screenshot, attach, figma, send)
- SignalsHUD scores read by screen readers as `"Prompt clarity 62 of 100"` (live region)
- Reduced motion: kill scanline, holospin, shimmer; keep state changes instant
- Color contrast: text-on-graphite passes WCAG AA at all sizes
- Plan/Build toggle: `role="radiogroup"` with proper labels

## 14. Edge cases & states

| Case | Behavior |
|---|---|
| 0 projects | Hide recents strip, show suggestion chips, headline = "What will you build today?" |
| 1–3 projects | Show all in recents (left-aligned), no "View all →" link |
| 4+ projects | Show 4 most-recent, "View all N →" opens sidebar drawer |
| Project with 0 screens | Phone-frame in empty/generating state |
| Plan limit reached (12/12) | HUD footer turns amber, Send button shows "Upgrade to continue" tooltip on hover |
| Loading projects | Skeleton phone-frames (4 dim placeholders) instead of empty state |
| User offline | HUD footer shows `● OFFLINE` (amber) instead of `● READY` |
| Prompt > 500 chars | SignalsHUD adds hint "↳ TRY TIGHTENING TO ONE PARAGRAPH" |
| Auto-suggest Plan dismissed for session | Don't show again until next session (sessionStorage) |

## 15. Out-of-scope but related (future specs)

These were discussed but not built in this redesign:

1. **Real prompt-clarity scoring backend** — replace `usePromptScore` mock with LLM/heuristic API call
2. **Real screen-thumbnail generation pipeline** — render component-tree to image on screen-save, cache in Supabase Storage
3. **Post-submit page redesign** — kill the generic Login/Fitness/Chat template chips that appear after submit; add prompt-score banner + matched-template selector (Rocket-style but contextual)
4. **Background ornament** — kumiko / ensō / project-constellation. Pick one for v1.5 polish pass
5. **Hover-to-live-iframe** on project cards — lazy-load actual project preview on card hover
6. **Templates page** — full templates browser as its own route
7. **Intelligence (Rocket parity)** — competitor monitoring feature, separate epic

## 16. Success criteria

The redesign succeeds if:

1. A returning user with 10+ projects sees their recent work above the fold without opening any drawer
2. A new user understands within 3 seconds: "I type a prompt, an app gets built"
3. The dashboard *visibly differs* from Rocket/Lovable/Bolt/Fastshot in screenshots side-by-side
4. The SignalsHUD never blocks a user — they can submit any prompt at any time
5. The Plan/Build toggle's auto-suggest fires only when clarity < 50% and is dismissible
6. Mobile (375px) renders without horizontal scroll, with all key actions reachable
7. Lighthouse accessibility score ≥ 95
8. No regressions in existing dashboard flows (project create, rename, delete, duplicate, sign-out)

## 17. Open questions

None — all decisions locked from brainstorming session 2026-05-06.

## 18. References

- Visual mockup: `mockups/dashboard-concepts.html`
- Current dashboard: `src/pages/Dashboard.tsx`
- Brand inspiration trace:
  - Rocket — sidebar pattern, mode cards, post-submit clarity score
  - Lovable — Plan/Build toggle, gradient hero
  - Bolt — clean prompt-first hero, glowing arc
  - Fastshot — minimalist landing
  - Linear/Vercel/Arc — restraint + polish reference
