# Package A — List-row navigation (Profile / Settings / menu rows)

**Status:** `in-progress` — scoped, starting implementation in session `jolly-cori-a95069`
**Owner:** Sahil (working with Claude Code)
**Created:** 2026-05-11
**Estimated effort:** 2-4 hours (single session, not parallelizable — see "Why not parallel" below)

---

## TL;DR for a future Claude session

If this session ran out of time and you're picking up Package A, read this whole doc first. The work is:

1. Patch the **planner prompt** ([api/_lib/planner-prompt.ts](../../api/_lib/planner-prompt.ts)) to require sub-screens for every menu row on a Profile/Settings/Account screen.
2. Patch the **screen-generation prompt** ([api/generate-flow.ts:770-786](../../api/generate-flow.ts)) to clarify that "list/grid items that navigate" includes static menu rows in Profile/Settings.
3. Add a **planner test** that a profile-style request produces the expected sub-screens in `routeGraph`.
4. **Verify end-to-end** by generating a fresh FoodHub or similar app and tapping Profile → Addresses → confirm push navigation works.

The runtime, normalizer, and click classifier already support list-row navigation. **No runtime changes needed.**

---

## The problem (what users see)

In a generated app (e.g. FoodHub, FitForge), the Profile screen renders a list of menu rows: Addresses, Notifications, Payment Methods, Help & Support, Sign Out. Tapping any of them does nothing — until very recently, when a debug toast appeared. As of [src/runtime/main.tsx:371](../../src/runtime/main.tsx), the toast now says "Coming soon", which is a cosmetic patch, not a fix. Sahil's point (correct): "Coming soon" can't be the permanent answer — the rows must actually navigate.

Same issue applies to:
- Settings screens (rows like Notifications, Privacy, About → no nav)
- History / Activity rows in some apps
- Any "list of meta-actions" pattern

Cards in content lists (Restaurants → Restaurant Detail, Workouts → Workout Detail) work fine. The break is specifically for **non-data-bound menu rows.**

---

## Root cause (what's actually broken)

I verified the runtime pipeline by reading:
- [src/runtime/main.tsx:411-442](../../src/runtime/main.tsx) — the runtime click handler **already** prefers `data-mokkoi-nav` over the CSS classifier. Any TouchableOpacity carrying `navIntent: {kind:'push', target}` routes correctly before the list-row classifier defer (line 172) ever runs.
- [api/_lib/normalizer.ts:525-547](../../api/_lib/normalizer.ts) — the navIntent validator walks every TouchableOpacity. It validates `push` targets exist in `routeGraph.screens`. No special-casing of list-row shapes; rows are accepted just like buttons.
- [api/generate-flow.ts:770-786](../../api/generate-flow.ts) — the screen-gen prompt already instructs:
  > *"Every list/grid item that opens a detail screen MUST set navIntent on the outer TouchableOpacity (NOT on inner text/icons)."*

So **the plumbing works.** Why doesn't it route in practice?

**Two missing pieces in the prompts:**

### Cause 1 — Planner doesn't emit sub-screens for menu rows

When the planner generates FoodHub, the `routeGraph.screens` includes Home, Restaurants, Restaurant Detail, Cart, Checkout, Order Tracking, Orders, Profile — but **not** AddressesScreen, NotificationsScreen, PaymentMethodsScreen, HelpScreen. So even if the model wanted to put `navIntent: {kind:'push', target:'addresses'}` on the Addresses row, the normalizer would strip it (target not in routeGraph) and replace with the "Coming soon" noop.

The planner-prompt has no rule covering this. It instructs:
- Bottom tabs must reflect domain ([planner-prompt.ts:38](../../api/_lib/planner-prompt.ts))
- Every Add/Filter/Share CTA needs a modal screen ([planner-prompt.ts:73](../../api/_lib/planner-prompt.ts))

But says nothing about: *"Every menu row on a Profile/Settings screen needs a destination screen in routeGraph.screens."*

### Cause 2 — Screen-gen prompt's "list/grid item" rule is too narrow

The screen-gen prompt at [generate-flow.ts:783-784](../../api/generate-flow.ts) reads:
> *"Every list/grid item that opens a detail screen MUST set navIntent on the outer TouchableOpacity."*

Models interpret "detail screen" narrowly — a record-detail view of an appData item. A "menu row that opens Settings → Privacy" doesn't fit that frame, so the model skips the navIntent.

---

## Scope

### IN scope
- Planner-prompt addition: declare sub-screens for menu rows when emitting Profile/Settings/Account/About-style screens
- Screen-gen prompt clarification: list/grid items INCLUDES static menu rows in Profile/Settings, navIntent points at the planner-declared sub-screen ids
- One planner test confirming sub-screens appear in routeGraph
- End-to-end smoke verification on a fresh generation

### OUT of scope
- Filter pill data filtering (Package B — separate ticket)
- Widget mode routing (Package C)
- Back button verification (Package D)
- Modal sheet audit (Package E)
- Sub-screen *content* quality — we only ensure they exist + are reachable. The screen-gen prompt already produces reasonable empty/placeholder content for screens without dataSource. Improving that is its own ticket.

---

## Implementation plan

### Step 1 — Planner prompt (`api/_lib/planner-prompt.ts`)

Add a new rule block, anywhere in the system-prompt body. Suggested location: right after the existing "Every 'Add X', 'Filter X', 'Share X' CTA MUST have a modal screen entry" rule.

```
MENU-ROW SUB-SCREENS (CRITICAL):

If your routeGraph includes a Profile, Settings, Account, or About screen
(any screen whose primary content is a vertical list of meta-action menu
rows), you MUST also declare each row's destination screen in
routeGraph.screens. Examples by row label:

  - "Addresses" / "Saved Addresses"   → screen kind: "screen", id: "addresses"
  - "Payment Methods" / "Cards"       → screen kind: "screen", id: "payment-methods"
  - "Notifications" (settings row)    → screen kind: "screen", id: "notification-settings"
  - "Privacy" / "Privacy & Security"  → screen kind: "screen", id: "privacy"
  - "Help" / "Help & Support" / "FAQ" → screen kind: "screen", id: "help"
  - "About" / "About <App>"           → screen kind: "screen", id: "about"
  - "Edit Profile"                    → screen kind: "screen", id: "edit-profile"
  - "Order History" (from Profile)    → screen kind: "screen", id: "order-history"

Rows that are LOGOUT-style (Sign Out, Log Out, Delete Account) do NOT need
a destination screen — they are confirmation actions (modal) or noops.
Declare those as modal screens (id: "sign-out-confirm") IF they need
confirmation, otherwise let them noop.

NEVER emit a Profile or Settings screen without declaring destinations for
its menu rows. A dead row is worse than a missing row — if a sub-screen
isn't worth declaring, OMIT the row entirely.
```

### Step 2 — Screen-generation prompt (`api/generate-flow.ts`)

Edit the navIntent rules section (around line 783). Change:

```
- Every list/grid item that opens a detail screen MUST set navIntent on the
  outer TouchableOpacity (NOT on inner text/icons).
```

to:

```
- Every list/grid item, list row, or menu row that opens any other screen
  (detail screen, sub-screen, settings page, etc.) MUST set navIntent on
  the outer TouchableOpacity (NOT on inner text/icons).
- Profile / Settings / Account screens render a vertical list of menu rows.
  Each row's outer TouchableOpacity MUST carry
  navIntent: { kind: "push", target: "<sub-screen-id-from-routeGraph>" }
  matching the destination the planner declared. If no destination exists
  in routeGraph.screens for a row, OMIT the row — never emit a row whose
  navIntent target is missing.
```

### Step 3 — Planner test (`api/_lib/__tests__/planner.test.ts`)

Add a test that asserts: given a prompt requesting a Profile screen, the planner output includes screen entries for at least 2-3 of the canonical menu-row destinations (addresses, payment-methods, notification-settings, privacy, help, about). The exact set varies by app vertical, so the test should be lenient (e.g. "at least 2 of the canonical 6 are present").

This test will be **flaky by nature** (LLM output) — mark it `it.skipIf(noApiKey)` or similar pattern matching the existing planner tests in that file.

### Step 4 — End-to-end smoke

Generate a fresh app (FoodHub-style food delivery, OR FitForge-style fitness — anything with a Profile tab) in the running dev server. Open Profile. Tap each row. Confirm:
- Rows whose targets exist in routeGraph push to a new screen
- Rows whose targets were intentionally omitted are gone (not "Coming soon")
- Sign Out either opens a confirm modal or noops cleanly

---

## Verification checklist

Before declaring Package A done:

- [ ] Planner prompt patch lands; `git diff api/_lib/planner-prompt.ts` shows the new rule block
- [ ] Screen-gen prompt patch lands; `git diff api/generate-flow.ts` shows the expanded rule
- [ ] Existing tests still pass: `npx vitest run api/_lib` returns green
- [ ] One new planner test asserting sub-screen emission
- [ ] One fresh generation in the running dev server (`preview_start` if not running) demonstrates Profile rows navigating
- [ ] Toast does NOT fire for previously-dead rows
- [ ] No regression: cards in content lists still navigate (Restaurants list still works)

---

## Risks + edge cases

1. **Model compliance variance.** LLMs comply ~95% with new prompt rules. Some generations will emit a Profile screen but skip one menu row's sub-screen. Mitigation: the normalizer already strips orphaned push intents and replaces with noop+"Coming soon", so the failure mode is graceful (single dead row), not catastrophic.

2. **Sub-screen *content* will be thin.** Without dataSource binding, an Addresses screen will show empty-state or placeholder content. That's acceptable for now — the demo win is that navigation works. Improving sub-screen content quality is a separate ticket.

3. **Token budget.** Adding screens to routeGraph and emitting them in the screen-gen phase costs tokens. Each menu-row sub-screen is ~200-400 tokens to generate. A Profile with 6 menu rows = ~6 extra screens = ~2k tokens. Within current budgets (max_tokens: 48000) but worth monitoring on long generations.

4. **Vertical-specific menu rows.** E-commerce Profile has Orders + Wishlist + Addresses; fitness Profile has Stats + Goals. The prompt list above is canonical — the model should adapt to vertical. Verify on 2-3 different verticals before declaring done.

5. **"Sign Out" handling.** Existing apps may emit Sign Out as a plain row that defers. Recommended: declare as a modal confirm or let it noop with the standard "Coming soon" toast. Don't try to wire a real sign-out flow here; that's a different ticket.

---

## Why not parallel agents

Sahil asked whether to parallelize across Claude Code sessions. For Package A, the answer is no:

- The work is **two coordinated prompt edits + a test**, all touching the same conceptual contract (which screens exist in routeGraph). Splitting it across agents adds coordination overhead larger than the work itself.
- Compare to REVIEWE 6 where 4 parallel agents made sense: those were independent workstreams (streaming, dead-button, pills, long-tail).
- Parallel pays off when: scope > 1 day AND the work decomposes into ≥3 independent files/concerns with clear contracts. Package A is ~2-4 hours, two files, one contract.

Packages B (data filtering), E (modal audit), and G (validation harness) WILL benefit from parallelization. Keep that pattern for them.

---

## Files touched by this work

| File | Change |
|---|---|
| `api/_lib/planner-prompt.ts` | Add MENU-ROW SUB-SCREENS rule block |
| `api/generate-flow.ts` | Expand the "list/grid item" navIntent rule to cover menu rows |
| `api/_lib/__tests__/planner.test.ts` | Add sub-screen emission test |
| `docs/roadmap/package-a-list-row-navigation.md` | This doc |

## Files INTENTIONALLY NOT touched

| File | Why not |
|---|---|
| `src/runtime/main.tsx` | Runtime already routes navIntent before classifier defer fires |
| `api/_lib/normalizer.ts` | Validator already accepts push intents on any TouchableOpacity |
| `src/components/ScreenRenderer.tsx` | No render-time changes needed; rows already render with TouchableOpacity wrappers |

---

## After Package A

Recommended next packages in priority order (see master triage in the session transcript):

- **Package C — Widget mode routing** (~1 day) — fixes meditation/calculator/timer apps that currently hang on "Waiting for tree…"
- **Package D — Back button verification** (~½ day) — the `back` navIntent kind was previously being stripped by the normalizer; that was fixed in this session, but multi-level nav stack behavior is unverified
- **Package B — Real filter-pill data filtering** (~3-5 days) — pills now toggle visually (this session) but don't filter records. Bigger ticket, needs careful design

Package A unlocks Profile/Settings navigation across every app. Combined with the other fixes already in this session (toast literal + filter pill toggleState wiring), it represents a significant nav quality leap.
