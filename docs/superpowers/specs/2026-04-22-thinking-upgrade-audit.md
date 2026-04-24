# Thinking-Upgrade Audit — Mokkoi Generation Prompts

> **Scope:** `api/generate-flow.ts` (planner + generator) and the shared
> building blocks in `api/_lib/design-system.ts`. This audit is
> recommendation-only — nothing is implemented yet. Pick which items to ship
> in task C tomorrow; each one lands as a separate A/B with baseline + fresh
> side-by-side comparison.
>
> **Reference for "good":** the TSX files in `screens/` (FitTrack Dashboard,
> Aura Studio Product, Kinetic Fitness, Velox Audio/Product). These are what
> Mokkoi-generated apps should feel like — realistic names, specific
> numbers, icons paired with text, clear hierarchy, no wireframe emptiness.

---

## Quick wins vs Deep work

| # | Improvement | Effort | Risk | Expected lift |
|---|-------------|--------|------|---------------|
| **Quick wins (30 min)** |||||
| 1 | Strengthen `CONTENT_LIBRARY` with concrete examples | 30 min | Low | Medium |
| 2 | Add negative examples to `FUNCTIONAL_APP_RULES` | 30 min | Low | Medium |
| 3 | Tighten `RULES: ALWAYS use macros` into imperative with consequences | 30 min | Low | Low-Medium |
| 4 | Add "bad vs good" icon-name pair to Icon rule | 30 min | Low | Low |
| 5 | Move "Return ONLY a JSON array" to the bottom of both system prompts (last-sentence effect) | 30 min | Low | Low |
| **Mid (2 hr)** |||||
| 6 | Add 1 few-shot example to planner prompt (full JSON) | 2 hr | Low | Medium-High |
| 7 | Add "content recipes" per template prior (realistic names, numbers, brands) | 2 hr | Low | High |
| 8 | Split generator prompt per screen-type hint (dashboard vs auth vs detail) | 2 hr | Med | Medium |
| 9 | Add 1 few-shot *component tree* example in `COMPONENT_TYPES` (a full ListRow with real content) | 2 hr | Low | Medium |
| 10 | Promote `VIEWPORT_BUDGET` rules into numbered checklist the model can self-verify | 2 hr | Low | Medium |
| **Deep work (half day)** |||||
| 11 | Rewrite template priors to show screen-level structure (macro list per screen) | half day | Med | High |
| 12 | Add 2 complete few-shot screens (dashboard + detail) matching `screens/` quality | half day | Med | High |
| 13 | Chain-of-thought scratch-pad: ask Haiku planner to reason briefly before emitting JSON | half day | High | Unknown |
| 14 | Self-critique pass: after Sonnet emits screens, ask same model to grade its own density/realism and regenerate low-scoring screens | half day | High | High if it works |
| 15 | Add screen-quality rubric as explicit grading criteria in system prompt | half day | Med | Medium |

Pick 3–5 from this list for tomorrow. Recommended starter set: **1, 2, 6, 7, 11**. That's one quick win per leverage axis plus the two deep-work items with the clearest upside.

---

## Current prompt architecture

**Planner (Haiku 4.5):**
- System prompt: `APP_PLANNER_SYSTEM_PROMPT` + optional `TEMPLATE_PRIORS[id]` spliced in
- User message: the raw user prompt
- Expected output: `{appName, screens[], navigation, designDirection}` JSON

**Generator (Sonnet 4.6 for paid, Haiku for free):**
- System prompt: `APP_GENERATION_SYSTEM_PROMPT` (a stack of shared modules: `DESIGN_TOKENS`, `COMPONENT_TYPES`, `CONTENT_LIBRARY`, `VIEWPORT_BUDGET`, `CONTENT_DENSITY`, `PLATFORM_RULES`, `FUNCTIONAL_APP_RULES`, `QUALITY_CHECKLIST`)
- User message: synthesized plan summary + original user prompt + "Return ONLY a JSON array"
- Expected output: JSON array of `{id, name, tree}` per screen

Both are prompt-cached with `cache_control: { type: 'ephemeral' }`.

---

## Findings, grouped by the four axes you called out

### (a) Content richness rules

**Current state.** `CONTENT_LIBRARY` is a single sentence:
> "Use realistic, category-appropriate content. NEVER use Lorem ipsum. Match names, stats, prices, and labels to the app domain."

It says *what* but not *what good looks like*. The AI has to guess.

**What reference screens actually contain.** From `FitTrack Dashboard.tsx`:
- Real names: "Alex Rivera", "AR" initials avatar
- Specific numerics: "480 kcal", "7,214 steps", "42 min"
- Rich subtitles: "6:00 PM · 45 min · Intermediate"
- Contextual CTAs: "1 more to hit your goal this week!"

The current library prompt doesn't model any of this. The model has to infer the pattern from nothing.

**Issues (ordered by severity):**

1. **No concrete good/bad pairs.** "Realistic content" is abstract. "Alex Rivera" vs "John Doe" is concrete. *(Quick win #1)*
2. **No numeric specificity rule.** "8,240 steps" reads real; "many steps" reads wireframe. *(Quick win #1)*
3. **No subtitle density rule.** Reference screens use middle-dot-separated subtitles ("6:00 PM · 45 min · Intermediate") constantly. Current prompt never teaches this shape. *(Mid #8)*
4. **No brand-name guidance.** Checkout screens need "Visa ending 4242" or "Chase Sapphire" — not "Card 1". *(Mid #7)*
5. **No pricing conventions.** `$18.90` ≠ `$18` ≠ `18.90 USD`. Pick one and enforce. *(Quick win #1)*
6. **CONTENT_LIBRARY is ambient, not imperative.** It's a paragraph. Rules the model will actually follow are numbered directives with negative examples. *(Quick win #2)*

**Recommended rewrite (Quick win #1):**

```
CONTENT RULES — follow all 5:
1. Names are always real first+last (Sarah Chen, Marcus Johnson, Priya Patel).
   NEVER: John Doe, User 1, Test User, Name Here.
2. Numbers are specific. Use 8,240 steps, not "many steps". Use $18.90,
   not "$$". Use "42 min ago", not "recently".
3. Subtitles combine 2-3 facts with middle-dot separator:
   "6:00 PM · 45 min · Intermediate"
   "Visa · ending 4242 · default"
   "Delivered today · 4.8★ · $24.99"
4. Prices: always USD with 2-decimal precision ($24.99, $4.50, not $25).
   Ratings: 1 decimal with star ("4.8★"). Counts: thousands-separator ("12.5K followers").
5. Brand names where realistic: "Chase Sapphire", "Amazon Prime", "Apple Pay",
   "Spotify", "Visa". NEVER "Bank 1", "Card Provider", "Streaming App".
```

### (b) Template prior quality

**Current state.** `TEMPLATE_PRIORS` (`design-system.ts:239-288`) has six priors — fitness, food-delivery, social-media, ecommerce, banking, music. Each is a 5-line bullet list of screens with 1-sentence descriptions.

Example:
```
- Home: today's stats (calories/steps/heart rate), workout streak, quick-start CTA, recent workouts list
```

**Issues:**

7. **Priors only tell planner, not generator.** `buildPlannerSystem` splices the prior into Haiku's prompt. Sonnet never sees it. The generator has to re-derive the archetype's screen structure from the plan summary alone. *(Deep work #11 — thread the matched template ID into generator prompt too.)*
8. **Priors describe screens, not content.** "today's stats (calories/steps/heart rate)" tells the model *what fields* but not *what values*. Compare to the `CONTENT RULES` rewrite above — priors need the same imperative numeric content. *(Mid #7)*
9. **Priors don't reference macros.** Each screen-type maps to a handful of macro components (StatCard, ListRow, ProductCard). Priors don't say "use StatCard for daily stats". The model guesses. *(Deep work #11)*
10. **No screen layout order.** "Typical screens: Home, Workouts, Progress, Profile" doesn't specify tab vs stack. That decision gets made elsewhere (`navigation.type`) but the prior should reinforce it. *(Deep work #11)*
11. **Six priors is thin.** Common missing archetypes: messaging/chat, calendar/booking, travel/hotel, ride-share, real-estate, learning/course. When a prompt doesn't match, the planner gets zero structural guidance. *(Deep work — add 4-6 more archetypes. Out of scope for tomorrow.)*
12. **Template priors are planner-only; viewport+density rules are generator-only.** These should cross-pollinate. *(Deep work #11.)*

**Recommended rewrite of one prior (Mid #7 template):**

```
# TEMPLATE: fitness

## Home screen content recipe
- Greeting: "Good morning, {FirstName}" (e.g., "Good morning, Alex Rivera")
- Weekly progress card: "5 of 6 workouts" + progress bar + motivating microcopy
  ("1 more to hit your goal this week!")
- Today's stats row — 3 StatCards: kcal/steps/minutes with specific values
  (480 kcal, 7,214 steps, 42 min)
- Upcoming workout row: ListRow with play icon trailing
  (title: "Upper Body Strength", subtitle: "6:00 PM · 45 min · Intermediate")
- Recent workouts list — 3 items, each with icon + title + "distance · time · cal"

## Structural rules
- Home is a tab screen (with profile/workouts/progress)
- BottomNav active=Home, 4 tabs total
- Accent color: #22C55E (green) or #8B5CF6 (purple)
- Dark theme always
```

### (c) Few-shot examples

**Current state.** Zero few-shot examples anywhere. There's one minimal JSON in `APP_PLANNER_SYSTEM_PROMPT:230` but it's only the plan structure (names + nav), not a component tree.

**Evidence this matters.** The reference TSX screens show the model is *capable* of real quality — but only reliably when templates match. When the template matcher returns null, generated apps visibly flatten. Few-shots close that gap.

**Issues:**

13. **No generator-side few-shot.** `APP_GENERATION_SYSTEM_PROMPT` tells the model to "generate ALL screens for a mobile app" but never shows one. *(Mid #9 shows one component tree; Deep work #12 shows a full screen.)*
14. **No cross-screen consistency example.** "Use the SAME accent color for ALL primary actions" — a ~300-line example with one accent threaded through would anchor this. *(Deep work #12.)*
15. **No macro usage example.** `COMPONENT_TYPES` lists macros inline but never demonstrates composing them into a screen. The AI has to guess whether `ProductCard` goes inside a `ScrollView` or a row, whether it needs a wrapping `View` with padding, etc. *(Mid #9.)*

**Recommended: add one component-tree few-shot to `COMPONENT_TYPES` (Mid #9).**

```
EXAMPLE — fitness home screen Today's Stats row (shows macro composition):
{
  "type":"View",
  "style":{"marginTop":20,"gap":12},
  "children":[
    {"type":"Text","style":{"fontSize":13,"color":"#A0A0B8","fontWeight":"600","letterSpacing":0.5},"children":["TODAY'S STATS"]},
    {"type":"View","style":{"flexDirection":"row","gap":12},"children":[
      {"type":"StatCard","props":{"icon":"flame","iconColor":"#fb923c","value":"480","label":"kcal"}},
      {"type":"StatCard","props":{"icon":"footprints","iconColor":"#38bdf8","value":"7,214","label":"steps"}},
      {"type":"StatCard","props":{"icon":"timer","iconColor":"#34d399","value":"42","label":"min"}}
    ]}
  ]
}
```

### (d) Imperative rules + negative examples

**Current state.** Rules live in 7 stacked paragraphs (`DESIGN_TOKENS`, `COMPONENT_TYPES`, `VIEWPORT_BUDGET`, `CONTENT_DENSITY`, `PLATFORM_RULES`, `FUNCTIONAL_APP_RULES`, `QUALITY_CHECKLIST`). Style ranges from imperative ("ALL screens MUST use") to descriptive ("Cards: borderRadius 12-16"). `FUNCTIONAL_APP_RULES` is the strongest section; `CONTENT_LIBRARY` is the weakest.

**Issues:**

16. **Mixed imperative + hedged language.** "Should feel FULL and COMPLETE" is a vibe. "Every screen has exactly 4 content sections" is a rule. Hedges train the model to hedge. *(Quick win #2.)*
17. **No bad-then-good pairs.** The one strong negative rule — "NEVER use emoji for icons" — works because it's explicit. Most other rules only state the positive. The model doesn't know what it's *not* supposed to do. *(Quick win #2.)*
18. **`QUALITY_CHECKLIST` is 7 vague items on one line.** Checklists work when they're numbered with verifiable predicates. Current: "Clear type hierarchy" (not verifiable). Better: "Home screen has exactly one Text with fontSize ≥ 28". *(Mid #10.)*
19. **`RULES: ALWAYS use macros when available` is at the end of `COMPONENT_TYPES`.** By then the model has 80 lines of context. "ALWAYS use macros" should lead, not trail. *(Quick win #3.)*
20. **`FUNCTIONAL_APP_RULES` mixes design directives with state-management directives.** These are different leverage axes. State management is about code correctness; density is about visual quality. Keep them apart so each reads cleanly. *(Mid — not in the quick-pick list, low priority.)*
21. **No consequences attached to rules.** "Use BottomNav for ALL bottom navigation" — but if the model emits raw Views for a bottom nav, what breaks? Telling the model the consequence ("emoji icons will render as text") recruits reasoning. *(Quick win #2.)*

**Recommended rewrite (Quick win #2, applied to a specific bad rule):**

*Before (current `FUNCTIONAL_APP_RULES:160` — hedged):*
> "Use realistic mock data."

*After (imperative with negative + consequence):*
```
RULE: Mock data is always specific objects with real names and numbers.
- DO: [{name:'Sarah Chen', text:'Loved the new update!', likes:42, time:'2h ago'}, ...]
- DON'T: [{name:'User 1', text:'Some text here', likes:10, time:'now'}, ...]
- Why: Generic placeholders make shipped apps feel like wireframes. The user
  is building a pitch demo for YC — every string the user reads is a
  credibility signal.
```

---

## Cross-cutting observations (not in the 15)

- **Planner output isn't used as explicit planning evidence.** The generator gets the plan summary stringified into its user message, but the system prompt doesn't reference it as "the architect has already decided X — your job is execution, not re-planning". Framing could sharpen execution. *(Not listed — subtle, experimental.)*
- **No self-consistency check.** For a paid user, you could spend 2× the tokens and generate twice, then pick the higher-density version. Out of scope for zero-cost; listed for completeness.
- **`VIEWPORT_BUDGET` includes hardcoded pixel budgets per screen type.** These are great — but they're buried inside a wall of text. Promoting them to a compact per-screen table would be a 1-hour polish. Bundled into Mid #10.

---

## Proposed tomorrow plan

From the 15, your starter set of 5:

1. **Quick win #1** — Rewrite `CONTENT_LIBRARY` with 5 numbered content rules + bad/good pairs. *(30 min, low risk.)*
2. **Quick win #2** — Add bad-then-good pairs to the worst-hedged rules in `FUNCTIONAL_APP_RULES`. *(30 min, low risk.)*
3. **Mid #6** — Add 1 full few-shot plan example (with actual screen descriptions, not the skeleton that's there now) to `APP_PLANNER_SYSTEM_PROMPT`. *(2 hr.)*
4. **Mid #7** — Rewrite all 6 template priors with content recipes (specific names, numbers, brands per screen). *(2 hr.)*
5. **Deep work #11** — Thread the matched template ID into the generator prompt so Sonnet also sees the archetype hint — not just Haiku. *(half day.)*

Total: ~5.5 hours of prompt changes.

**Validation plan:** For each change, run `generate-flow` on the same 3 user prompts (one fitness, one social, one banking) on baseline + fresh prompt. Render both in the canvas, side-by-side. Eyeball density, realism, macro usage, and hierarchy. Pick a winner per prompt. If fresh wins ≥ 2/3, ship.

**Don't change two variables at once.** Run #1, compare. Then #2 on top of #1, compare. Etc. If #3 regresses, revert #3 only.

**Baseline screens to generate before any changes:** "fitness tracker", "social feed for photographers", "neobank dashboard". Save the outputs as `baseline-{prompt}-2026-04-24.json` before changing any prompt. These are your control group for the whole day.

---

## What this audit is NOT

- Not a prompt rewrite — no actual new prompts are in this doc, only recommended rewrites at the rule level.
- Not a model swap — stays on Haiku planner + Sonnet generator.
- Not a temperature/max_tokens tune — those are separate knobs.
- Not an icon change — that shipped tonight (task A).
- Not a validator — validator is deferred (`docs/backlog/2026-04-22-validator-*.md`).

---

*Audit written 2026-04-24 as task B of the 3-task "no-API-cost" night: D (cache audit, done), A (Lucide fix, shipped), B (this doc).*
