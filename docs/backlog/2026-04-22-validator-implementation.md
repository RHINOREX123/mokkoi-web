> **BACKLOG:** Deferred from YC sprint. Post-YC, post-ThriveForge work. Revisit approx May 15, 2026.

# Mokkoi Quality Validator — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the post-generation validator from [spec](../specs/2026-04-22-validator-design.md): silent auto-fixes on mechanical issues, surfaced alerts on judgment calls, every rule trigger logged to `issue_events` for a future insights dashboard.

**Architecture:** Pure-function rules in `api/_lib/validator/rules/*.ts`, single orchestrator in `api/_lib/validator/index.ts`. Runs after `normalizeComponentTree` inside `api/generate.ts`. Writes to a new `issue_events` Supabase table. Surfaced issues returned in the generate response and rendered as amber alert cards above the phone preview.

**Tech Stack:** TypeScript, Vitest, Supabase (Postgres + RLS), Vercel serverless, React 19. New dep: `culori` (Lab-distance color snap).

---

## Critical context the engineer needs

### Existing overlap with `normalizer.ts`

`api/_lib/normalizer.ts` already implements three rules from the spec's silent-fix tier:

- `spacing.scale` — `snapToScale` already snaps padding/margin/gap to `[0,4,8,12,16,20,24,32,40,48,64]`
- `text.minsize` — already snaps fontSize to `[11,12,13,14,16,17,20,24,28,34,40,48]`
- `tap.target.size` — already enforces `MIN_TOUCH_TARGET = 44`

**Do NOT reimplement these.** The validator runs *after* normalizer. For these three rules, the validator compares `before/after` trees and emits `silent_fix` log events for anything the normalizer changed. This keeps the insights dashboard honest without duplicating logic.

### Source of truth for component types

The `COMPONENT_TYPES` export in `api/_lib/design-system.ts` is a **prompt string**, not a type list. The real registry is `SUPPORTED_TYPES` in `api/_lib/normalizer.ts:41-57`. For rule `component.fabricated`, import and use that Set (export it first if it's not exported).

### Existing patterns to follow

- **Tests** live next to source (`foo.ts` + `foo.test.ts`), use Vitest. See `api/_lib/template-matcher.test.ts` for style.
- **Supabase migrations** live flat in `supabase/` (not a `migrations/` subdir). Pattern: `supabase/issue-events.sql`. Applied manually via the dashboard — no auto-migration tooling.
- **Auth helpers** at `api/_lib/auth-helper.ts` — reuse `authenticateRequest`, `getSupabaseConfig`.
- **Env vars** — admin bypass uses `ADMIN_EMAILS` (comma-separated) read inside the edge function. See commit `0602893`. Mirror this pattern; do NOT use the `app.admin_emails` postgres setting approach.

### Scope discipline

Ship date: 2026-05-04. 12 days. Build order:

1. Core infra (types, orchestrator, DB, logger) — ships silently
2. Four high-value surfaced rules (text overflow, CTA dead, contrast, empty state)
3. UI (alert cards + badge)
4. Remaining silent rules in priority order
5. Catastrophic banner + remaining surfaced rules if time

If a task blocks, skip to the next — the orchestrator should degrade gracefully when a rule module is missing.

---

## File structure

```
api/_lib/validator/
  types.ts              # Issue, Rule, Severity, ValidatorResult, Ctx
  walk.ts               # walk() + countNodes() — shared by orchestrator AND rules (avoids circular import)
  index.ts              # orchestrator: validate()
  logger.ts             # write to issue_events (awaited — Vercel serverless can freeze before fire-and-forget resolves)
  rules/
    fabricated.ts       # component.fabricated
    iconRegistry.ts     # icon.registry (Levenshtein swap)
    tabLabel.ts         # tab.label.length
    navBack.ts          # nav.backbutton
    propsRequired.ts    # props.required.missing
    keyboardType.ts     # input.keyboardType
    tapSpacing.ts       # tap.target.spacing
    colorPalette.ts     # color.palette (culori Lab snap)
    textOverflow.ts     # text.overflow (surfaced)
    ctaDead.ts          # cta.dead (surfaced)
    contrastAA.ts       # contrast.aa.fail (surfaced)
    emptyState.ts       # empty.state.missing (surfaced)
    formErrorState.ts   # form.error.state.missing (surfaced)
    listOverflow.ts     # list.overflow.noscroll (surfaced)
    ctaFold.ts          # cta.below.fold (surfaced)
    thumbzone.ts        # thumbzone.violation (surfaced)
    screenRequired.ts   # screen.required.missing (surfaced, needs template ctx)
  normalizerDiff.ts     # compares before/after from normalizer → silent_fix log events
  index.test.ts         # orchestrator integration + no-op test
  rules/*.test.ts       # one per rule

api/generate.ts         # MODIFY: hook validator between normalizer and supabase write

supabase/issue-events.sql  # migration

src/components/ValidatorAlerts.tsx   # UI: alert cards
src/components/QualityBadge.tsx      # UI: "✓ N checks passed"
src/pages/PreviewPage.tsx            # MODIFY: render ValidatorAlerts + QualityBadge

src/lib/askAiFix.ts                  # client: POSTs to /api/edit-screen with nodePath
```

---

## Task 0: Set up worktree and dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Create worktree and branch**

```bash
git worktree add ../mokkoi-validator -b validator
cd ../mokkoi-validator
```

All subsequent tasks run inside this worktree.

- [ ] **Step 2: Install `culori`**

```bash
npm install culori
npm install --save-dev @types/culori
```

Expected: `package.json` dependencies updated, `node_modules/culori/` exists.

- [ ] **Step 3: Export `SUPPORTED_TYPES` from normalizer**

Locate the `const SUPPORTED_TYPES = new Set([...])` declaration in `api/_lib/normalizer.ts` via Grep (line number may drift), prepend `export`.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json api/_lib/normalizer.ts
git commit -m "chore: add culori dep and export SUPPORTED_TYPES for validator"
```

---

## Task 1: Types + orchestrator skeleton

**Files:**
- Create: `api/_lib/validator/types.ts`
- Create: `api/_lib/validator/index.ts`
- Create: `api/_lib/validator/index.test.ts`

- [ ] **Step 1: Write failing orchestrator test**

`api/_lib/validator/index.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { validate } from './index'

describe('validator orchestrator', () => {
  it('returns unchanged tree and empty issues for a valid tree', () => {
    const tree = { type: 'View', children: [] }
    const result = validate(tree, { templateId: null })
    expect(result.tree).toEqual(tree)
    expect(result.issues).toEqual([])
    expect(result.quality).toBe('ok')
  })

  it('does not mutate the input tree (no-op test)', () => {
    const tree = { type: 'View', style: { padding: 16 }, children: [{ type: 'Text', children: ['hi'] }] }
    const before = JSON.stringify(tree)
    validate(tree, { templateId: null })
    expect(JSON.stringify(tree)).toBe(before)
  })
})
```

- [ ] **Step 2: Run test**

```bash
npm test -- api/_lib/validator/index.test.ts
```

Expected: FAIL — `validate is not a function`.

- [ ] **Step 3a: Create `walk.ts` FIRST (avoids circular imports — rules need `walk`, orchestrator registers rules)**

`api/_lib/validator/walk.ts`:

```ts
export function walk(tree: any, cb: (node: any, path: string) => void, path = 'root') {
  if (!tree || typeof tree !== 'object') return
  cb(tree, path)
  if (Array.isArray(tree.children)) {
    tree.children.forEach((c, i) => walk(c, cb, `${path}.children[${i}]`))
  }
}

export function countNodes(tree: any): number {
  if (!tree || typeof tree !== 'object') return 0
  let n = 1
  if (Array.isArray(tree.children)) for (const c of tree.children) n += countNodes(c)
  return n
}
```

- [ ] **Step 3b: Write types**

`api/_lib/validator/types.ts`:

```ts
export type Severity = 'silent_fix' | 'warning' | 'error'

export interface Issue {
  rule: string
  severity: Severity
  nodePath: string        // e.g. "root.children[2].children[0]"
  message: string         // user-facing for surfaced; debug for silent
  fixed: boolean
  metadata?: Record<string, unknown>
}

export interface Ctx {
  templateId: string | null
  theme?: { palette: string[] }  // resolved hex colors
}

export interface ValidatorResult {
  tree: any
  issues: Issue[]          // surfaced only (severity !== 'silent_fix')
  silentFixes: Issue[]     // logged, not returned to UI
  quality: 'ok' | 'low'    // 'low' if catastrophic threshold tripped
  checksRun: number        // # of silent rules that actually ran (for badge)
}

export interface Rule {
  id: string
  severity: Severity
  apply: (tree: any, ctx: Ctx) => { tree: any; issues: Issue[]; ran: boolean }
}
```

- [ ] **Step 4: Write orchestrator skeleton**

`api/_lib/validator/index.ts`:

```ts
import type { Ctx, Issue, Rule, ValidatorResult } from './types'
import { countNodes } from './walk'

const SILENT_RULES: Rule[] = []    // filled in later tasks
const SURFACED_RULES: Rule[] = []  // filled in later tasks

export function validate(tree: any, ctx: Ctx): ValidatorResult {
  // Deep clone so input is never mutated.
  const current = JSON.parse(JSON.stringify(tree))
  const totalNodes = countNodes(current) // count on clone, before any rule mutates
  const silentFixes: Issue[] = []
  const issues: Issue[] = []
  let checksRun = 0

  for (const rule of SILENT_RULES) {
    const result = rule.apply(current, ctx)
    silentFixes.push(...result.issues)
    if (result.ran) checksRun++
  }

  for (const rule of SURFACED_RULES) {
    const result = rule.apply(current, ctx)
    issues.push(...result.issues)
  }

  const touchedNodes = new Set(silentFixes.map(i => i.nodePath)).size
  const quality: 'ok' | 'low' = totalNodes > 0 && touchedNodes / totalNodes > 0.3 ? 'low' : 'ok'

  return { tree: current, issues, silentFixes, quality, checksRun }
}
```

Note: rules mutate `current` in place and also return `result.tree` (which is the same reference). We don't reassign `current`.

- [ ] **Step 5: Run tests**

```bash
npm test -- api/_lib/validator/index.test.ts
```

Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add api/_lib/validator/types.ts api/_lib/validator/index.ts api/_lib/validator/index.test.ts
git commit -m "feat(validator): types + orchestrator skeleton with no-op test"
```

---

## Task 2: Supabase migration — `issue_events` table

**Files:**
- Create: `supabase/issue-events.sql`

- [ ] **Step 1: Write migration**

`supabase/issue-events.sql`:

```sql
create table issue_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  screen_id uuid references screens(id) on delete cascade,
  rule text not null,
  severity text not null check (severity in ('silent_fix', 'warning', 'error')),
  fixed boolean not null default false,
  ignored boolean default false,
  metadata jsonb,
  created_at timestamptz default now()
);

create index issue_events_user_created_idx on issue_events (user_id, created_at desc);
create index issue_events_rule_created_idx on issue_events (rule, created_at desc);

alter table issue_events enable row level security;

create policy "users read own events"
  on issue_events for select
  using (auth.uid() = user_id);

create policy "users insert own events"
  on issue_events for insert
  with check (auth.uid() = user_id);

create policy "users update own events"
  on issue_events for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "service role bypass"
  on issue_events for all
  to service_role
  using (true) with check (true);
```

Admin bypass for reads is handled in application code (same pattern as `ADMIN_EMAILS` in commit `0602893`) — not in RLS. Service role is used by the edge function to insert events on behalf of the user.

**NOTE for subagent:** The spec document shows a different RLS policy using `current_setting('app.admin_emails')`. That is wrong for our deployment — use the SQL above, which matches the repo's existing `ADMIN_EMAILS` env-var pattern. Do not copy the spec's SQL verbatim. After this task ships, update the spec.

- [ ] **Step 2: Apply migration manually**

Open Supabase dashboard → SQL Editor → paste contents → Run. Verify in Table Editor that `issue_events` exists with RLS enabled.

- [ ] **Step 3: Commit**

```bash
git add supabase/issue-events.sql
git commit -m "feat(db): issue_events table for validator logging"
```

---

## Task 3: Logger

**Files:**
- Create: `api/_lib/validator/logger.ts`
- Create: `api/_lib/validator/logger.test.ts`

- [ ] **Step 1: Write failing test**

`api/_lib/validator/logger.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { buildLogRows } from './logger'

describe('buildLogRows', () => {
  it('maps issues to rows with correct user/project/screen IDs', () => {
    const issues = [
      { rule: 'icon.registry', severity: 'silent_fix', nodePath: 'root.children[0]', message: '', fixed: true, metadata: { from: 'rocket', to: 'flight' } },
      { rule: 'cta.dead', severity: 'warning', nodePath: 'root.children[1]', message: 'Button has no action', fixed: false },
    ] as const

    const rows = buildLogRows(issues as any, { userId: 'u1', projectId: 'p1', screenId: 's1' })
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ user_id: 'u1', project_id: 'p1', screen_id: 's1', rule: 'icon.registry', severity: 'silent_fix', fixed: true })
    expect(rows[0].metadata).toMatchObject({ nodePath: 'root.children[0]', from: 'rocket', to: 'flight' })
  })

  it('returns empty array for empty issue list', () => {
    expect(buildLogRows([], { userId: 'u1', projectId: 'p1', screenId: 's1' })).toEqual([])
  })
})
```

- [ ] **Step 2: Run test** — expect FAIL (`buildLogRows is not a function`).

- [ ] **Step 3: Implement**

`api/_lib/validator/logger.ts`:

```ts
import { createClient } from '@supabase/supabase-js'
import type { Issue } from './types'

export interface LogContext {
  userId: string
  projectId: string
  screenId: string
}

export function buildLogRows(issues: Issue[], ctx: LogContext) {
  return issues.map(i => ({
    user_id: ctx.userId,
    project_id: ctx.projectId,
    screen_id: ctx.screenId,
    rule: i.rule,
    severity: i.severity,
    fixed: i.fixed,
    metadata: { nodePath: i.nodePath, message: i.message, ...(i.metadata ?? {}) },
  }))
}

/**
 * Awaited insert. Do NOT switch to fire-and-forget: Vercel serverless can freeze
 * the runtime the moment `res.json()` returns, dropping in-flight promises.
 * Insert cost is <50ms on Supabase — well within our 200ms validator budget.
 */
export async function logIssues(
  issues: Issue[],
  ctx: LogContext,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<void> {
  if (issues.length === 0) return
  const client = createClient(supabaseUrl, serviceRoleKey)
  const rows = buildLogRows(issues, ctx)
  const { error } = await client.from('issue_events').insert(rows)
  if (error) console.error('[validator] log failure:', error.message)
}
```

- [ ] **Step 4: Run test** — expect PASS.

- [ ] **Step 5: Commit**

```bash
git add api/_lib/validator/logger.ts api/_lib/validator/logger.test.ts
git commit -m "feat(validator): async logger to issue_events"
```

---

## Task 4: `component.fabricated` rule (silent)

**Files:**
- Create: `api/_lib/validator/rules/fabricated.ts`
- Create: `api/_lib/validator/rules/fabricated.test.ts`
- Modify: `api/_lib/validator/index.ts` (register rule)

- [ ] **Step 1: Write failing tests**

`api/_lib/validator/rules/fabricated.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { fabricatedRule } from './fabricated'

describe('component.fabricated', () => {
  it('substitutes GradientText with Text', () => {
    const tree = { type: 'GradientText', children: ['Hello'] }
    const { tree: out, issues, ran } = fabricatedRule.apply(tree, { templateId: null })
    expect(out.type).toBe('Text')
    expect(issues).toHaveLength(1)
    expect(issues[0].rule).toBe('component.fabricated')
    expect(issues[0].metadata).toMatchObject({ from: 'GradientText', to: 'Text' })
    expect(ran).toBe(true)
  })

  it('leaves supported types untouched', () => {
    const tree = { type: 'View', children: [{ type: 'Text', children: ['ok'] }] }
    const { issues } = fabricatedRule.apply(tree, { templateId: null })
    expect(issues).toEqual([])
  })
})
```

- [ ] **Step 2: Run** — expect FAIL.

- [ ] **Step 3: Implement**

`api/_lib/validator/rules/fabricated.ts`:

```ts
import { SUPPORTED_TYPES } from '../../normalizer'
import { walk } from '../walk'
import type { Rule, Issue } from '../types'

const SUBSTITUTIONS: Record<string, string> = {
  GradientText: 'Text',
  AnimatedView: 'View',
  PressableOpacity: 'TouchableOpacity',
  SafeArea: 'SafeAreaView',
}

export const fabricatedRule: Rule = {
  id: 'component.fabricated',
  severity: 'silent_fix',
  apply(tree, _ctx) {
    const issues: Issue[] = []
    walk(tree, (node, path) => {
      if (!node?.type || SUPPORTED_TYPES.has(node.type)) return
      const replacement = SUBSTITUTIONS[node.type] ?? 'View'
      issues.push({
        rule: 'component.fabricated',
        severity: 'silent_fix',
        nodePath: path,
        message: `Substituted fabricated type ${node.type} with ${replacement}`,
        fixed: true,
        metadata: { from: node.type, to: replacement },
      })
      node.type = replacement
    })
    return { tree, issues, ran: true }
  },
}
```

- [ ] **Step 4: Register in orchestrator**

In `api/_lib/validator/index.ts`:

```ts
import { fabricatedRule } from './rules/fabricated'
const SILENT_RULES: Rule[] = [fabricatedRule]
```

- [ ] **Step 5: Run all tests** — expect PASS.

- [ ] **Step 6: Commit**

```bash
git add api/_lib/validator/rules/fabricated.ts api/_lib/validator/rules/fabricated.test.ts api/_lib/validator/index.ts
git commit -m "feat(validator): rule component.fabricated"
```

---

## Task 5: `icon.registry` rule (silent)

**Files:**
- Create: `api/_lib/validator/rules/iconRegistry.ts`
- Create: `api/_lib/validator/rules/iconRegistry.test.ts`
- Modify: `api/_lib/validator/index.ts`

Most-used Material Symbols that Mokkoi actually ships with. Build a curated allowlist (~200 icons) based on what the existing prompt encourages. If icon isn't in the allowlist, pick closest by Levenshtein.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { iconRegistryRule } from './iconRegistry'

describe('icon.registry', () => {
  it('swaps unknown icon to nearest Material Symbol', () => {
    const tree = { type: 'View', children: [{ type: 'Icon', props: { name: 'hom', size: 20 } }] }
    const { issues } = iconRegistryRule.apply(tree, { templateId: null })
    expect(issues).toHaveLength(1)
    expect(tree.children[0].props.name).toBe('home')
  })

  it('leaves valid icon names untouched', () => {
    const tree = { type: 'Icon', props: { name: 'favorite' } }
    const { issues } = iconRegistryRule.apply(tree, { templateId: null })
    expect(issues).toEqual([])
  })
})
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement**

```ts
import { walk } from '../walk'
import type { Rule, Issue } from '../types'

// Curated subset of Material Symbols used across Mokkoi prompts.
// Extend as new icons appear in generations.
const ICON_REGISTRY = new Set([
  'home', 'search', 'favorite', 'person', 'settings', 'notifications', 'menu',
  'arrow_back', 'arrow_forward', 'close', 'add', 'remove', 'check', 'more_vert', 'more_horiz',
  'shopping_cart', 'shopping_bag', 'star', 'location_on', 'call', 'mail', 'lock', 'visibility',
  'visibility_off', 'send', 'share', 'filter_list', 'sort', 'bookmark', 'chat',
  'camera_alt', 'photo', 'image', 'video_library', 'mic', 'play_arrow', 'pause',
  'skip_next', 'skip_previous', 'volume_up', 'monitoring', 'bolt', 'local_shipping',
  'info', 'warning', 'error', 'help', 'language', 'grid_view', 'list', 'person_add',
  'person_pin', 'logout', 'login', 'edit', 'delete', 'download', 'upload', 'refresh',
  'calendar_today', 'schedule', 'access_time', 'today', 'event', 'timer',
  'directions_walk', 'directions_run', 'directions_bike', 'fitness_center',
  'restaurant', 'local_cafe', 'local_pizza', 'local_dining', 'wine_bar',
  'credit_card', 'account_balance', 'account_balance_wallet', 'payments', 'receipt_long',
  'trending_up', 'trending_down', 'show_chart', 'pie_chart', 'bar_chart',
  'thumb_up', 'thumb_down', 'reply', 'forward', 'flag', 'attach_file',
])

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  if (!m) return n
  if (!n) return m
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

function closest(name: string): string {
  let best = 'help'
  let bestD = Infinity
  for (const candidate of ICON_REGISTRY) {
    const d = levenshtein(name, candidate)
    if (d < bestD) { bestD = d; best = candidate }
  }
  return best
}

export const iconRegistryRule: Rule = {
  id: 'icon.registry',
  severity: 'silent_fix',
  apply(tree, _ctx) {
    const issues: Issue[] = []
    walk(tree, (node, path) => {
      if (node?.type !== 'Icon') return
      const name = node.props?.name
      if (typeof name !== 'string' || ICON_REGISTRY.has(name)) return
      const replacement = closest(name)
      issues.push({
        rule: 'icon.registry',
        severity: 'silent_fix',
        nodePath: path,
        message: `Unknown icon '${name}' → '${replacement}'`,
        fixed: true,
        metadata: { from: name, to: replacement },
      })
      node.props.name = replacement
    })
    return { tree, issues, ran: true }
  },
}
```

- [ ] **Step 4: Register and run tests.**
- [ ] **Step 5: Commit** — `feat(validator): rule icon.registry`.

---

## Task 6: `tab.label.length` + `nav.backbutton` (silent, small pair)

**Files:**
- Create: `api/_lib/validator/rules/tabLabel.ts` + test
- Create: `api/_lib/validator/rules/navBack.ts` + test
- Modify: `api/_lib/validator/index.ts`

- [ ] **Step 1: Write failing tests for both** — one word per tab label; stack screens have an `arrow_back` icon in header left slot.

Test shape:

```ts
// tabLabel.test.ts
it('truncates multi-word BottomNav labels to first word', () => {
  const tree = { type: 'BottomNav', props: { items: [{ label: 'My Profile' }] } }
  const { issues } = tabLabelRule.apply(tree, { templateId: null })
  expect(tree.props.items[0].label).toBe('My')
  expect(issues).toHaveLength(1)
})

// navBack.test.ts
it('injects back button when header lacks one', () => {
  const tree = { type: 'View', props: { isScreen: true, screenKind: 'stack' }, children: [
    { type: 'View', props: { isHeader: true }, children: [{ type: 'Text', children: ['Title'] }] }
  ]}
  const { issues } = navBackRule.apply(tree, { templateId: null })
  expect(issues).toHaveLength(1)
  // header should now have an arrow_back Icon as first child
})
```

- [ ] **Step 2: Implement both rules.**

**Target registration order per the spec:** `component.fabricated` → `props.required.missing` → `icon.registry` → `spacing.scale` → `color.palette` → `tap.target.size` → `tap.target.spacing` → `text.minsize` → `input.keyboardType` → `nav.backbutton` → `tab.label.length`. Tasks 4–8 build this order up incrementally. After each task, register the new rule in its spec-defined slot. The final orchestrator array (after Task 8) should match the spec exactly.

(Tasks 6–8 register rules out of implementation order but correct into the spec order in the `SILENT_RULES` array.)

**`navBack` heuristic (concrete):** Walk every node; a node qualifies as a "stack header" if it's a `View` or `HeaderBar` whose parent is a top-level screen `View` AND whose style has `flexDirection: 'row'` AND whose first text descendant has `fontWeight` >= `'600'` OR `fontSize` >= 17 (title-shaped). If the header has no descendant `Icon` with `name` in `['arrow_back', 'chevron_left', 'close']`, inject an `arrow_back` Icon as the first child of the header. Skip if the root node has `BottomNav` as a descendant (tab-style screens don't need back buttons). If generate.ts emits `props.isScreen`/`props.screenKind` markers in the future, switch to those.

- [ ] **Step 3: Commit** — `feat(validator): rules tab.label.length + nav.backbutton`.

---

## Task 7: `props.required.missing` + `input.keyboardType` (silent)

**Files:**
- Create: `api/_lib/validator/rules/propsRequired.ts` + test
- Create: `api/_lib/validator/rules/keyboardType.ts` + test
- Modify: `api/_lib/validator/index.ts`

- [ ] **Step 1: Tests**

```ts
// propsRequired.test.ts
it('fills missing Switch value prop with false', () => {
  const tree = { type: 'Switch', props: {} }
  propsRequiredRule.apply(tree, { templateId: null })
  expect(tree.props.value).toBe(false)
})

// keyboardType.test.ts
it('infers email keyboardType from placeholder', () => {
  const tree = { type: 'TextInput', props: { placeholder: 'Enter your email' } }
  keyboardTypeRule.apply(tree, { templateId: null })
  expect(tree.props.keyboardType).toBe('email-address')
})

it('leaves TextInput alone when keyboardType already set', () => {
  const tree = { type: 'TextInput', props: { placeholder: 'email', keyboardType: 'default' } }
  const { issues } = keyboardTypeRule.apply(tree, { templateId: null })
  expect(issues).toEqual([])
})
```

- [ ] **Step 2: Implement.**

`propsRequired` schema (exhaustive for v1):

```ts
const SCHEMA: Record<string, Array<{ path: string; default: any }>> = {
  Switch:     [{ path: 'props.value', default: false }, { path: 'props.trackColor', default: { true: '#00B894', false: '#222236' } }],
  Icon:       [{ path: 'props.name', default: 'help' }, { path: 'props.size', default: 20 }, { path: 'props.color', default: '#FFFFFF' }],
  TextInput:  [{ path: 'props.placeholder', default: '' }],
  ActivityIndicator: [{ path: 'props.color', default: '#FFFFFF' }],
  LinearGradient:    [{ path: 'props.colors', default: ['#6C5CE7', '#5A4BD1'] }],
}
```

Use a dot-path set helper. Only fill truly missing props (don't overwrite).

`keyboardType` uses placeholder keyword regex on `props.placeholder`:
- `/\bemail\b/i` → `email-address`
- `/\b(phone|tel|mobile)\b/i` → `phone-pad`
- `/\b(amount|price|age|qty|quantity|\$|cost|total)\b/i` → `numeric`

Only applies when `keyboardType` is not already set.

- [ ] **Step 3: Commit** — `feat(validator): rules props.required.missing + input.keyboardType`.

---

## Task 8: `tap.target.spacing` + `color.palette` (silent, final pair)

**Files:**
- Create: `api/_lib/validator/rules/tapSpacing.ts` + test
- Create: `api/_lib/validator/rules/colorPalette.ts` + test

- [ ] **Step 1: Tests**

```ts
// tapSpacing.test.ts
it('enforces 8px gap between adjacent interactive siblings', () => {
  const tree = { type: 'View', style: { flexDirection: 'row', gap: 4 }, children: [
    { type: 'TouchableOpacity', children: [] },
    { type: 'TouchableOpacity', children: [] },
  ]}
  tapSpacingRule.apply(tree, { templateId: null })
  expect(tree.style.gap).toBe(8)
})

// colorPalette.test.ts
it('snaps out-of-palette hex to nearest by Lab distance', () => {
  const ctx = { templateId: null, theme: { palette: ['#6C5CE7', '#FF6B6B', '#FFFFFF'] } }
  const tree = { type: 'Text', style: { color: '#6d5ce8' } } // ~ identical to 6C5CE7
  colorPaletteRule.apply(tree, ctx)
  expect(tree.style.color).toBe('#6C5CE7')
})

it('skips when theme palette is missing', () => {
  const tree = { type: 'Text', style: { color: '#123456' } }
  const { issues, ran } = colorPaletteRule.apply(tree, { templateId: null })
  expect(issues).toEqual([])
  expect(ran).toBe(false)
})
```

- [ ] **Step 2: Implement.** `colorPalette` uses `culori` `differenceCiede2000` and `formatHex`. Be defensive: return `ran: false` if `ctx.theme?.palette` is missing.

- [ ] **Step 3: Commit** — `feat(validator): rules tap.target.spacing + color.palette`.

---

## Task 9: normalizer diff → silent_fix log events

**Files:**
- Create: `api/_lib/validator/normalizerDiff.ts` + test

- [ ] **Step 1: Test**

```ts
it('emits silent_fix events for spacing snaps done by normalizer', () => {
  const before = { type: 'View', style: { padding: 17 }, children: [] }
  const after  = { type: 'View', style: { padding: 16 }, children: [] }
  const events = diffToSilentFixes(before, after)
  expect(events).toHaveLength(1)
  expect(events[0].rule).toBe('spacing.scale')
  expect(events[0].metadata).toMatchObject({ prop: 'padding', from: 17, to: 16 })
})

it('emits text.minsize when fontSize raised', () => {
  const before = { type: 'Text', style: { fontSize: 10 }, children: ['x'] }
  const after  = { type: 'Text', style: { fontSize: 11 }, children: ['x'] }
  const events = diffToSilentFixes(before, after)
  expect(events.some(e => e.rule === 'text.minsize')).toBe(true)
})

it('emits tap.target.size when width/height raised to 44', () => {
  const before = { type: 'TouchableOpacity', style: { width: 30, height: 30 }, children: [] }
  const after  = { type: 'TouchableOpacity', style: { width: 44, height: 44 }, children: [] }
  const events = diffToSilentFixes(before, after)
  expect(events.some(e => e.rule === 'tap.target.size')).toBe(true)
})
```

- [ ] **Step 2: Implement** walks both trees in lockstep, compares style props by known list (padding/margin/gap variants → `spacing.scale`; fontSize → `text.minsize`; width/height on touchables → `tap.target.size`). Returns `Issue[]` with `severity: 'silent_fix'`, `fixed: true`.

- [ ] **Step 3: Commit** — `feat(validator): normalizer diff for silent_fix event log`.

---

## Task 10: Surfaced rule — `text.overflow`

**Files:**
- Create: `api/_lib/validator/rules/textOverflow.ts` + test

- [ ] **Step 1: Test**

```ts
it('flags long text in fixed-width button', () => {
  const tree = { type: 'TouchableOpacity', style: { width: 120 }, children: [
    { type: 'Text', style: { fontSize: 14 }, children: ['Subscribe to premium plan'] }
  ]}
  const { issues } = textOverflowRule.apply(tree, { templateId: null })
  expect(issues).toHaveLength(1)
  expect(issues[0].rule).toBe('text.overflow')
  expect(issues[0].severity).toBe('warning')
})

it('does not flag short text', () => {
  const tree = { type: 'TouchableOpacity', style: { width: 120 }, children: [
    { type: 'Text', style: { fontSize: 14 }, children: ['Buy'] }
  ]}
  const { issues } = textOverflowRule.apply(tree, { templateId: null })
  expect(issues).toEqual([])
})
```

- [ ] **Step 2: Implement.** Heuristic: proportional text ≈ `fontSize * 0.55` px per char. If `chars * charWidth > width - 24` (24 = min horizontal padding), flag.

- [ ] **Step 3: Register** in `SURFACED_RULES`, commit — `feat(validator): rule text.overflow surfaced`.

---

## Task 11: Surfaced rules — `cta.dead`, `contrast.aa.fail`, `empty.state.missing`

Three rules together — each small.

**Files:**
- Create: three rule files + tests
- Modify: `api/_lib/validator/index.ts`

- [ ] **Step 1: Tests per rule**

```ts
// ctaDead.test.ts
it('flags Button/TouchableOpacity with children Text but no onPress-shaped prop', () => {
  const tree = { type: 'TouchableOpacity', children: [{ type: 'Text', children: ['Submit'] }] }
  const { issues } = ctaDeadRule.apply(tree, { templateId: null })
  expect(issues[0].rule).toBe('cta.dead')
})

// contrastAA.test.ts
it('flags text on background failing 4.5:1', () => {
  const tree = { type: 'View', style: { backgroundColor: '#FFFFFF' }, children: [
    { type: 'Text', style: { color: '#CCCCCC', fontSize: 14 }, children: ['hi'] }
  ]}
  const { issues } = contrastAARule.apply(tree, { templateId: null })
  expect(issues[0].rule).toBe('contrast.aa.fail')
})

it('skips gradient backgrounds', () => {
  const tree = { type: 'LinearGradient', props: { colors: ['#000', '#fff'] }, children: [
    { type: 'Text', style: { color: '#888' }, children: ['hi'] }
  ]}
  const { issues } = contrastAARule.apply(tree, { templateId: null })
  expect(issues).toEqual([])
})

// emptyState.test.ts
it('flags FlatList with no empty state marker', () => {
  const tree = { type: 'FlatList', props: {} }
  const { issues } = emptyStateRule.apply(tree, { templateId: null })
  expect(issues[0].rule).toBe('empty.state.missing')
})
```

- [ ] **Step 2: Implement.**
  - `ctaDead`: touchable with no `onPress` prop AND no `actionText` / `href` / `action` metadata. Mokkoi's JSON doesn't bind handlers — use a convention: the generator should emit `props.action: string` for real CTAs. Absence = dead.
  - `contrastAA`: walk, track nearest ancestor `backgroundColor` (solid only — bail if `LinearGradient` in ancestry). Use the existing `relativeLuminance` helper from `normalizer.ts` (export it) — don't re-derive.
  - `emptyState`: flag `FlatList` / lists (arrays-of-item-shaped-nodes over 3) without `props.emptyState` or a sibling Text containing "no items"/"empty".

- [ ] **Step 3: Register surfaced rules, commit** — `feat(validator): rules cta.dead + contrast.aa.fail + empty.state.missing`.

**Preparation:** `relativeLuminance` is defined at `api/_lib/normalizer.ts:13-18` but not exported. First commit of Task 11: `export function relativeLuminance(...)` (also export `parseHexColor` from line 6). Commit message: `chore: export color helpers for validator reuse`.

---

## Task 12: Hook validator into `generate.ts`

**Files:**
- Modify: `api/generate.ts`

- [ ] **Step 0: Read `api/generate.ts` end-to-end FIRST.** Variable names below (`userId`, `projectId`, `screenId`, `theme`, `templateMatch`, `normalizerOptions`) are illustrative — map them to the actual names in the file before making edits. Also confirm whether `normalizeComponentTree` mutates the input (it does — it calls `normalizeStyle` which mutates). That is why we clone.

- [ ] **Step 1: Locate the point just after `normalizeComponentTree` call** and the point just before the Supabase `insert` into `screens`.

- [ ] **Step 2: Insert validator**

```ts
import { validate } from './_lib/validator'
import { logIssues } from './_lib/validator/logger'
import { diffToSilentFixes } from './_lib/validator/normalizerDiff'

// ... existing code ...

// IMPORTANT: normalizeComponentTree may mutate in place. Clone rawTree first
// so diffToSilentFixes can compare the original model output against the normalized result.
const rawTree = /* ... model output ... */
const preNormalize = JSON.parse(JSON.stringify(rawTree))
const normalized = normalizeComponentTree(rawTree, normalizerOptions)
const normalizerFixes = diffToSilentFixes(preNormalize, normalized)

const validated = validate(normalized, {
  templateId: templateMatch?.templateId ?? null,
  theme: { palette: theme.palette },
})

// Await the log — fire-and-forget drops events when Vercel freezes the runtime.
const { supabaseUrl, serviceRoleKey } = getSupabaseConfig()
await logIssues(
  [...normalizerFixes, ...validated.silentFixes, ...validated.issues],
  { userId, projectId, screenId },
  supabaseUrl,
  serviceRoleKey,
)

const finalTree = validated.tree

// Return to client
res.json({
  tree: finalTree,
  validator: {
    issues: validated.issues,        // surfaced — rendered as alert cards
    quality: validated.quality,      // 'ok' | 'low'
    checksRun: validated.checksRun,  // badge count
  },
  // ... existing response fields
})
```

- [ ] **Step 3: Manual smoke test** — generate one screen via the app, confirm response has `validator` key, confirm a row lands in `issue_events`.

- [ ] **Step 4: Commit** — `feat(validator): wire into generate.ts + log events`.

---

## Task 13: UI — Alert card component

**Files:**
- Create: `src/components/ValidatorAlerts.tsx`
- Create: `src/components/QualityBadge.tsx`
- Create: `src/lib/askAiFix.ts`

- [ ] **Step 1: `ValidatorAlerts.tsx`** — renders amber cards stacked, each with rule label, message, `[Ask AI to fix]` and `[Ignore]` buttons. Uses `useState` for dismissed-ids.

**Ignore persistence (matches spec):** Ignore clicks update the most-recent `issue_events` row for `(user_id, screen_id, rule)` by setting `ignored=true`. Call the Supabase client directly from the browser using the user's anon key + JWT (the RLS policy on `issue_events` allows the user to `update` their own rows — add `create policy "users update own events" on issue_events for update using (auth.uid() = user_id) with check (auth.uid() = user_id);` to `supabase/issue-events.sql` in Task 2 if missing). No new API endpoint needed.

Props:
```ts
interface Props {
  issues: Issue[]
  screenId: string
  projectId: string
  onNodeReplaced: (nodePath: string, newNode: any) => void
}
```

- [ ] **Step 2: `QualityBadge.tsx`** — small rounded pill, `✓ {N} checks passed`, position absolute bottom-right of phone frame container. Clickable → popover listing the silent rule ids that ran.

- [ ] **Step 3: `askAiFix.ts`** — POSTs `{ screenId, nodePath, ruleId, ruleMessage, originalNode }` to `/api/edit-screen`, returns the patched node. Handles loading/error state via Promise.

- [ ] **Step 4: Commit** — `feat(validator): alert cards + quality badge UI`.

---

## Task 14: Wire UI into `PreviewPage.tsx`

**Files:**
- Modify: `src/pages/PreviewPage.tsx`

- [ ] **Step 1: Read `PreviewPage.tsx`, identify the spot above the phone frame and the bottom-right of the frame.**

- [ ] **Step 2: Render**

```tsx
{validator?.issues?.length ? (
  <ValidatorAlerts
    issues={validator.issues}
    screenId={screenId}
    projectId={projectId}
    onNodeReplaced={handleNodeReplaced}
  />
) : null}

{/* inside phone-frame container */}
<QualityBadge checksRun={validator?.checksRun ?? 0} />
```

- [ ] **Step 3: Implement `handleNodeReplaced(nodePath, newNode)`** — mutates the in-memory tree and re-persists via `mcp__mokkoi__edit_screen` (or whatever existing endpoint `PreviewPage` already uses for saves).

- [ ] **Step 4: Manual verification**
  - Start dev: `npm run dev`
  - Generate a screen that will trip `text.overflow` (long button label) and `contrast.aa.fail` (light-gray text).
  - Confirm cards appear, `Ignore` dismisses, `Ask AI to fix` replaces the node.

- [ ] **Step 5: Commit** — `feat(validator): render alerts + badge on preview page`.

---

## Task 15: Catastrophic-failure banner + end-to-end integration test

**Files:**
- Modify: `src/pages/PreviewPage.tsx`
- Create: `api/_lib/validator/index.integration.test.ts`

- [ ] **Step 1: Integration test** — a "kitchen sink" tree with 6 planted issues across different rules. Assert all caught, fixes applied in registration order, surfaced list ordered by severity.

- [ ] **Step 2: Banner** — when `validator.quality === 'low'`, render a full-width banner above the phone frame: *"This generation had several issues — regenerate?"* with a regenerate button. Hide the per-issue alert cards while the banner is shown (mutually exclusive).

- [ ] **Step 3: Commit** — `feat(validator): low-quality banner + orchestrator integration test`.

---

## Task 16: Final pass — remaining surfaced rules

Ship-or-cut decision. If <3 days left, skip this task entirely and file as post-ship work.

Rules to add if time permits:
- `form.error.state.missing`
- `list.overflow.noscroll`
- `cta.below.fold` (viewport budget 660px, track cumulative Y as we walk)
- `thumbzone.violation` (portrait assumption; destructive/primary button in top 1/3 + right 1/3 = flag)
- `screen.required.missing` (only fires when `ctx.templateId` is set)
- `loading.state.missing`

Each follows the same shape as Task 11 rules. One commit per rule.

---

## Success verification (before merging to main)

- [ ] All tests pass: `npm test`
- [ ] `npm run build` succeeds
- [ ] Generate 5 screens across 3 different prompts, verify:
  - No console errors
  - `issue_events` has rows for each generation
  - At least one surfaced alert card appears on a generation that deserves one
  - Badge shows a sensible count
  - `Ask AI to fix` successfully replaces a node
  - `Ignore` dismisses the card
- [ ] Validator runtime <200ms per screen (log `performance.now()` around `validate()` call in generate.ts temporarily)
