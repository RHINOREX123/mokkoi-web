# Bolt-Style Landing + Template Refactor

**Author:** Sahil, 2026-04-22
**Status:** Design — awaiting review
**Related:** [docs/yc-roadmap-2026-04-22.md](../../yc-roadmap-2026-04-22.md) §landing

---

## 1. Problem

Mokkoi's current landing (`src/pages/Dashboard.tsx` lines 836–870) renders a visible grid of 6 template cards ("Fitness Tracker", "Food Delivery", "Social Media", "E-Commerce", "Banking", "Music") under the prompt input.

**Why this hurts:**

- Visually signals *"preset picker"* rather than *"AI app builder"*. A YC judge scrolling through the surface expects Bolt/v0-style confidence: one input, no scaffolding.
- The "💪 🍔 📱" emoji tiles look like a toy or a template marketplace, not a serious tool.
- Side-by-side comparison with `bolt.new` (one centered input, no template grid) makes Mokkoi look junior.

**What we keep:** the template *prompts* still live in `src/data/appTemplates.ts` and seed the generator with strong structural priors — they are the reason the Food Delivery output looks polished. Removing them from the backend would hurt quality.

## 2. Scope

**In scope:**

1. Landing page (logged-in Dashboard empty state) visual redesign to Bolt-style minimalism
2. Remove visible template card grid
3. Replace with text suggestion pills that pre-fill the input
4. Keep `APP_TEMPLATES` data file intact; add a **fuzzy-match path** so when a user types "A fitness tracking app" the backend still applies the fitness template's structural prior
5. Remove the "or start from" row (Template / Screenshot / Import HTML buttons) from the empty state — move to a subtle "More ways to start" affordance

**Out of scope:**

- Prompt Pipeline v2 (Wirer, Validator) — separate spec
- Inline preview pane — separate spec
- Template quality upgrades (Fitness, Social Media content richness) — separate spec, scheduled after this
- Marketing landing page (`src/pages/LandingPage.tsx`) — not touched
- Auth / pricing / settings pages — not touched

## 3. Design

### 3.1 Visual target

Reference: [bolt.new](https://bolt.new) logged-out hero.

- Full-height centered column, max-width 720px
- Top: small Mokkoi wordmark + badge (credits indicator moves into top-right nav, not below input)
- Center headline: **"What will you build today?"** — 48px, Outfit, weight 700, with one word in accent color (e.g., *"build"* rendered in `#6366f1`)
- Subhead: **"Create stunning mobile apps by chatting with AI."** — 16px, `#94a3b8`
- Prompt input: 720px wide, 4 rows, rounded 16px, subtle border, placeholder `"Let's build"`
- Below input: 6 suggestion pills (keep existing `SUGGESTION_CHIPS` array)
- Below pills: tiny text link `or start from Screenshot · Import HTML · Template` (single line, muted, ~12px)
- No template grid. No cards. No emoji tiles.

### 3.2 Behavior — suggestion pills

| Pill | Action on click |
|---|---|
| "A fitness tracking app" | Pre-fill input with pill text + focus textarea. User edits or sends. |
| "A food delivery app" | Same pattern. |
| (all 6) | Same pattern. |

**Key change vs today:** clicking a pill today already pre-fills the input (see `Dashboard.tsx:723`). We keep that. What changes is:

- Pills become the *only* starting affordance (templates grid is gone)
- Pills move **above** the input (Bolt-style order: headline → pills → input) — no, actually Bolt puts pills below. We follow Bolt: headline → subhead → input → pills. Revisit in visual review.

### 3.3 Behavior — backend template fuzzy-match

When the user submits a prompt, before calling the generator:

1. Lowercase + tokenize user prompt
2. For each `APP_TEMPLATES[i]`, compute a match score against template `name` + `category` + key tokens from `description`
3. If max score > threshold (e.g., 0.7), splice the template's structural prior into the system prompt as hidden context ("The user wants something in the shape of a fitness app. Screens typically include: …")
4. Otherwise, fall back to generic system prompt

**Where this plugs in:** `api/generate-flow.ts` planner stage. Net change is ~30 lines.

**Why this preserves quality:** the Food Delivery screenshots you showed look good because the template gave the generator a scaffold. Fuzzy-matching on the user's prompt means we get that scaffold even without the user clicking a card.

### 3.4 "More ways to start" (secondary entry points)

Screenshot upload, HTML import, explicit template pick are still valid entry points but should not dominate the landing. Options:

- **A)** One small text row under the pills: `or start from Screenshot · HTML · Template` — click opens a dropdown or modal
- **B)** Small icon row in the top-right nav — cleaner, uses top-bar real estate
- **C)** Keep the 3 buttons as today but make them smaller and push below the pills

**Recommendation: A.** It matches Bolt's "or start from Figma / GitHub / Team template" pattern exactly.

### 3.5 States

| State | Layout |
|---|---|
| First-time user, 0 projects | Hero landing as described above |
| Returning user with ≥1 project | Smaller hero ("Welcome back, Sahil"), input stays, pills hide, recent projects list appears below |
| Mid-submission (building) | Replace hero with the existing `buildingTemplate` loading state (Dashboard.tsx:823) |

### 3.6 Files touched

| File | Change |
|---|---|
| `src/pages/Dashboard.tsx` | Remove template grid block (lines ~836–870); restyle hero (lines ~700–789); replace "or start from" row (lines ~791–820) with compact text link |
| `src/data/appTemplates.ts` | **Unchanged.** Data stays. |
| `api/generate-flow.ts` (or wherever planner system prompt assembles) | Add fuzzy template-match function; splice matched template into planner context |
| `api/lib/template-matcher.ts` | **New.** Pure function, ~40 lines, unit-testable |

No new packages. No schema changes. No DB migrations.

## 4. Risks

| Risk | Mitigation |
|---|---|
| Removing visible templates tanks conversion from first-time users who don't know what to type | The 6 suggestion pills remain and demonstrably work (current code already pre-fills from them) |
| Fuzzy match misfires — user types "fitness diary" and gets the fitness template they didn't want | Threshold tuning + log matches for a week post-launch; worst case, wrong prior ≈ mildly worse output, not broken |
| Hiding templates breaks the analytics funnel if we're tracking template clicks separately | Audit `analytics.ts` for template-click events before removing; add a `template_matched_via_fuzzy` event to preserve the signal |
| "Screenshot" and "Import HTML" already show "coming soon" toasts (Dashboard.tsx:802–803) — making them more prominent surfaces unfinished features | Only expose the "Template" option in the text link for now; defer Screenshot/HTML until they actually work |

## 5. Success criteria

- Landing page screenshot side-by-side with bolt.new looks like a peer product, not a preset tool
- Generating "a fitness tracking app" via the pill produces output of equivalent quality to today's Fitness template click (verified by visual comparison of the generated screens)
- Zero regression in generation success rate over a 24-hour post-deploy window

## 6. Open questions for Sahil

1. Should the hero copy be "What will you build today?" (Bolt's) or something Mokkoi-specific like "What app do you want to build?" (current copy)?
2. Accent word in the headline — which word gets the gradient color: *build*, *app*, or neither?
3. Do we keep the "10000 credits remaining · max plan" line below the input, or move it to the top-right nav?

---

## 7. Implementation note

This spec covers *visual + routing behavior only*. The template-matcher fuzzy function is a prerequisite for the planner-side change and should be written TDD (unit tests for 6 known templates + 10 negative cases).

Next step after approval: invoke `writing-plans` skill to produce the step-by-step plan.
