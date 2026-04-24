> **BACKLOG:** Deferred from YC sprint. Post-YC, post-ThriveForge work. Revisit approx May 15, 2026.

# Mokkoi Quality Validator — Design Spec

**Date:** 2026-04-22
**Status:** Draft → pending review
**Owner:** Mokkoi core team
**Target ship:** Pre-YC S26 (deadline 2026-05-04)

---

## Goal

Catch and fix quality issues in AI-generated app screens *before* the user sees them, and surface only the issues that require user judgment. Turn the rule-triggers into a log so we can later build an "insights" dashboard showing users what Mokkoi checks and improves on their behalf.

## Why

The app-generation pipeline produces high-quality JSON trees most of the time, but drifts on a long tail of details (spacing not on scale, fabricated component names, buttons too small, labels that overflow). Today those drifts reach the preview and erode trust. A validator run between generation and persistence turns mechanical fixes into silent polish and turns judgment-call issues into one clear, actionable alert.

This is also a strategic differentiator: Bolt/Lovable/v0 output code, which is expensive to lint. Mokkoi outputs structured JSON, which is trivial to validate. We have an architectural advantage — use it.

## Non-Goals

- **Not a full a11y suite.** We validate the subset of rules that matter for mobile app skeletons. Full WCAG audit is out of scope.
- **Not a style-guide enforcer for user-authored changes.** The validator runs on AI output only. When the canvas feature ships later, user edits are trusted.
- **Not a generation retry loop.** If validation fails catastrophically (>30% of nodes invalid), we flag the generation as low-quality and let the user regenerate. We do not automatically re-prompt the model.

## Visibility Model

Hybrid — two tiers:

**Tier 1: Silent auto-fix.** The validator rewrites the JSON tree in place. User sees the clean result. Rule triggers are logged to `issue_events` but never surfaced in the UI.

**Tier 2: Surfaced alerts.** Shown as a single amber card above the phone preview. Each alert includes: the rule label, a specific explanation tied to the node, and two actions — *Ask AI to fix* (fires an edit-mode regeneration scoped to that node) or *Ignore* (dismisses; logged as ignored).

**The principle:** silent tier = mechanical fix with one right answer. Surfaced tier = judgment call AI cannot make confidently.

## Rule Catalog

### Silent auto-fix (11 rules)

| Rule | Condition | Fix |
|---|---|---|
| `spacing.scale` | Numeric margin/padding/gap not in `[4,8,12,16,20,24,32,40,48,64]` | Snap to nearest scale value |
| `color.palette` | Hex color not in theme's resolved palette | Snap to nearest palette token by Lab distance (uses `culori` — add as dep) |
| `component.fabricated` | Component type not in `COMPONENT_TYPES` registry | Substitute with nearest match (e.g. `GradientText` → `Text` with gradient style prop) |
| `tab.label.length` | BottomNav tab label >1 word | Truncate to first word |
| `props.required.missing` | Known component missing a required prop | Fill with default from component schema |
| `icon.registry` | Icon name not in Material Symbols set | Swap to closest match by Levenshtein |
| `tap.target.size` | Button/touchable with **explicitly declared** width<44 OR height<44 | Enforce min 44×44. Skip content-sized touchables (no declared dims) — they rely on padding and are handled by `spacing.scale` |
| `tap.target.spacing` | Adjacent interactive elements with gap<8 | Enforce min 8px gap |
| `text.minsize` | Body text fontSize<14 | Raise to 14 |
| `input.keyboardType` | TextInput with label hinting type but no `keyboardType` | Infer: "email" → email, "phone" → phone-pad, "age" / "amount" → numeric |
| `nav.backbutton` | Stack screen missing back button in header | Inject back button in header left slot |

### Surfaced (10 rules)

| Rule | Condition | User-facing message |
|---|---|---|
| `text.overflow` | Text in fixed-width container, estimated rendered width > container width | "*\"{label}\"* is {N} chars · may overflow on small screens" |
| `empty.state.missing` | List/grid with no fallback for zero-data case | "This list has no empty state. What should show if there are zero items?" |
| `loading.state.missing` | Screen has async data markers but no skeleton/spinner | "Screen looks like it loads data but has no loading state" |
| `contrast.aa.fail` | Text/background combination fails WCAG AA (4.5:1 normal, 3:1 large) | "Text color fails AA contrast against background" |
| `cta.dead` | Interactive element (Button/Pressable) without an onPress-equivalent action binding | "Button *\"{label}\"* has no action defined" |
| `list.overflow.noscroll` | List with >8 items in fixed-height container without scroll hint | "List is taller than the screen but not scrollable" |
| `screen.required.missing` | Template prior expects a screen type that isn't present (e.g. fitness app has no Progress screen) | "Expected a *{ScreenType}* screen for this kind of app" |
| `cta.below.fold` | Primary CTA below 660px viewport budget | "Main action is below the fold" |
| `form.error.state.missing` | Form with >1 input has no visible error state | "Form has no way to show validation errors" |
| `thumbzone.violation` | Destructive or primary action in top-right corner (far from thumb) | "Important action is outside the thumb zone" |

Each surfaced rule has a severity (`warning` for all v1). Silent auto-fixes log with `severity='silent_fix'`. The `error` tier is reserved for future escalation and is not emitted in v1 (but the column allows it to avoid a future migration).

## Architecture

```
generate.ts
    ↓  (JSON tree)
validator.ts ───── logger → Supabase.issue_events
    ↓  (fixed tree + issues[])
Supabase.screens
    ↓
Preview page ─────── alerts UI
```

**File layout:**
```
api/_lib/validator/
  index.ts              # orchestrator, runs all rules, returns { tree, issues }
  rules/
    spacing.ts
    color.ts
    component.ts
    tapTarget.ts
    text.ts
    nav.ts
    form.ts
    contrast.ts
  types.ts              # Issue, Rule, Severity, Fix
  logger.ts             # persist to issue_events
api/_lib/validator.test.ts  # one test per rule
```

Each rule is a pure function: `(tree, ctx) => { patchedTree, issues[] }`. Pure, independently testable, no shared state.

**Orchestrator behavior:**
1. Walks tree once, collects all issues.
2. Applies all silent fixes in a single deterministic pass in the order rules are registered (see below). Fixes run on the original tree; we do NOT re-validate after substitution. Rationale: cascading re-validation risks unbounded loops, and the registered order is chosen so downstream rules see upstream fixes.
3. Rule application order (silent tier): `component.fabricated` → `props.required.missing` → `icon.registry` → `spacing.scale` → `color.palette` → `tap.target.size` → `tap.target.spacing` → `text.minsize` → `input.keyboardType` → `nav.backbutton` → `tab.label.length`. Structural/substitution rules run first so dimension/spacing rules see the final node types.
4. Filters surfaced issues for `severity >= warning` to send to the UI.
5. Fires logger writes async (don't block the response).

**Catastrophic failure:** if >30% of visited nodes emit at least one silent rule trigger, mark the whole generation as `quality: 'low'` in the response and show a "This generation had several issues — regenerate?" banner above the preview instead of the per-issue alert card. The 30% threshold is a starting guess; tune from shadow-mode data before flipping the UI on.

## Data Model

New table `issue_events`:

```sql
create table issue_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  project_id uuid references projects(id),
  screen_id uuid references screens(id),
  rule text not null,
  severity text not null,  -- 'silent_fix' | 'warning' | 'error'
  fixed boolean not null,  -- true if silent auto-fix applied
  ignored boolean default false,  -- true if user clicked Ignore
  metadata jsonb,  -- rule-specific context (node path, old/new value)
  created_at timestamptz default now()
);

create index on issue_events (user_id, created_at desc);
create index on issue_events (rule, created_at desc);

alter table issue_events enable row level security;

create policy "users read own events"
  on issue_events for select
  using (
    auth.uid() = user_id
    or (auth.jwt() ->> 'email') = any (string_to_array(current_setting('app.admin_emails', true), ','))
  );

create policy "users insert own events"
  on issue_events for insert
  with check (auth.uid() = user_id);
```

RLS: users read/write only their own events. Admin bypass uses the same `ADMIN_EMAILS` pattern already wired into the codebase (see commit `0602893`). If the repo reads `ADMIN_EMAILS` from a different source (env var checked in the edge function rather than a postgres setting), mirror that pattern instead — the implementer should match existing admin-bypass code, not invent a new mechanism.

## UI

**Preview page — alert card** (lives above the phone frame):

```
┌──────────────────────────────────────────────┐
│ ⚠  Button label will overflow on small       │
│    screens                                   │
│    "Subscribe to premium plan" is 26 chars   │
│    · max for this button width is 18         │
│                                              │
│    [Ask AI to shorten]  [Ignore]             │
└──────────────────────────────────────────────┘
```

Behavior:
- One card per surfaced issue. Stack vertically if multiple.
- *Ask AI to shorten* → calls the existing edit-mode generate endpoint (`mcp__mokkoi__edit_screen` / `api/edit-screen`) with payload `{ screenId, nodePath, ruleId, ruleMessage, originalNode }`. The backend prompt template prepends: *"Fix this specific issue: {ruleMessage}. Change only the node at {nodePath}. Return the patched node."* Shows inline spinner. Replaces the node on success.
- *Ignore* → dismisses the card, records `ignored=true` in `issue_events`. Does not re-appear for this screen unless user regenerates.
- Issues persist across sessions until the underlying tree is regenerated or the user clicks Ignore.

**Preview page — quality badge** (small, bottom-right of phone frame):

```
✓ {N} checks passed
```

Count is dynamic: number of silent rules that actually ran (i.e., applicable to this tree), not the total 11.

Clickable → small popover listing the 11 silent checks that ran with a green check next to each. Gives users visibility into what we do for them without being in-your-face.

## Insights Dashboard (v1.5, not in v1 scope)

Separate route `/insights`. Shows:
- "We checked 47 things for you this week" — total rule runs
- Top 3 rules triggered, with trend sparkline
- Personal quality score (0–100, weighted by issue severity)
- "Fabricated components blocked" count — trust signal
- Link to each flagged screen for context

The table is populated from day 1; the dashboard page is built once real data exists (~1 week after validator ships).

## Testing Strategy

- **Unit test per rule:** fixture tree with known issue → assert issue emitted, assert fix applied. Each rule file ships with 2–4 test cases.
- **Integration test on the orchestrator:** a "kitchen sink" tree with 6+ planted issues → assert all caught, fixes applied in right order, surfaced list correct.
- **No-op test:** an already-valid tree must pass through the orchestrator byte-identical (`JSON.stringify(before) === JSON.stringify(after)`) with zero issues emitted. Catches accidental mutation.
- **Regression:** add real tree samples from past user generations as fixtures whenever a new rule is added or an old rule is tweaked.

No E2E test for the UI in v1 — manual QA with preview tool is sufficient given ship pressure.

## Metrics to Track (from day 1)

- `issue_events` count by rule, by day (for dashboard)
- % of generations with at least one surfaced issue
- % of surfaced issues where user clicks *Ask AI to fix* vs *Ignore*
- Low-quality rate (% of generations tripping the >30% threshold)
- Time from generation to first Supabase write (validator overhead budget: <200ms per screen)

## Risks & Open Questions

1. **Contrast checking is non-trivial on gradient backgrounds.** For v1, only validate solid-color text-on-solid-background. Skip if either is a gradient. Document as known limitation.
2. **Thumb-zone rule depends on orientation assumption.** Assume portrait. Revisit if landscape-first apps become a thing.
3. **"Screen required missing" rule depends on template prior match.** Only fires when the template matcher returned a match. Out-of-template apps skip this rule entirely.
4. **Text overflow estimation is approximate.** Character-count heuristic at first; swap for actual text-measure library (e.g. a monospace-to-proportional mapping) if v1 produces too many false positives.
5. **Performance budget.** Validator runs per screen. Target <200ms. If any rule runs long, move it off the critical path.

## Rollout

1. Ship validator with logging but *no UI* — shadow mode, 1–2 days of real user traffic to tune false-positive rates
2. Turn on silent auto-fixes
3. Turn on surfaced alerts
4. Build insights dashboard (v1.5) once we have a week of data

## Success Criteria

- Post-ship: ≥40% reduction in user-visible quality issues (measured by regeneration rate within 5 minutes of initial gen)
- No user-reported false positives on silent fixes in first week
- <5% of surfaced alerts result in user confusion (measured by Ignore-without-action rate; should be moderate — Ignore is valid — but not universal)
- Validator runtime <200ms per screen at p95
