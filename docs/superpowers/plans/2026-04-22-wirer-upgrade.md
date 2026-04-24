# Wirer Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Fix navigation wiring end-to-end so generated-app buttons actually navigate on tap.

**Architecture:** Preserve planner's `trigger` text through the pipeline (currently dropped), store connections as a multimap per from-screen (currently overwritten), and swap the current substring match for token-overlap fuzzy matching with a deterministic fallback.

**Tech Stack:** TypeScript, Vitest. No new deps.

**Scope:** 2 days honest.

---

## Audit Findings (what's broken today)

Three bugs stack on top of each other; fixing one without the others is pointless.

**Bug 1 — `api/generate-flow.ts:396-398` drops `trigger`.** The planner emits `{from, to, trigger}` (line 164). The `.map(c => ({fromScreenId, toScreenId}))` strips `trigger` before the data leaves the API. Downstream code literally cannot wire correctly because the signal is gone.

**Bug 2 — `src/utils/snackUrl.ts:234-241` overwrites.** `connectionMap.set(names[fromIdx], names[toIdx])` keys by from-screen, so a screen with N outgoing connections keeps only the last one. Home → Cart, Home → Profile, Home → Search collapses to one.

**Bug 3 — `src/utils/exportTsx.ts:132` matches nonsense.** The map passed in is `{fromName → toName}`, but the code does `btnText.includes(trigger)` where "trigger" is actually the from-screen name. Any button whose text happens to contain the current screen's name gets wired. When text doesn't overlap (most cases), nothing binds.

Net effect: even when the planner produces good connections, almost none survive to the exported TSX.

## Fuzzy Match Algorithm

**Choice: token-overlap (Jaccard on lowercased word sets) with a length-normalized substring tiebreaker.**

Why not Levenshtein: button text vs trigger text differ by *words*, not characters. "Add to Cart" vs "Cart" has edit distance 11 — Levenshtein rejects a valid match. Jaccard sees `{cart} ⊆ {add, to, cart}` → score 1/3, clearly above noise.

Why not raw substring (current): "home" button matches everything containing "home". Jaccard requires shared *whole tokens*, killing that class of false positives.

Tokenize on whitespace + non-alphanumeric, drop stopwords (`a/an/the/to/and/or/of/for`), lowercase. Accept match if `jaccard >= 0.34` OR if every trigger token appears as a button token. Pick highest score per button; ties broken by shortest button text (more specific).

## Fallback Logic

Per screen, after scoring all `(button, connection)` pairs:

1. Greedily assign best score ≥ threshold, each connection used at most once.
2. For unassigned connections whose trigger contains a directional verb (`go/open/view/see/continue/next/start`) or matches the destination screen name, bind to the first unbound `TouchableOpacity` in document order that has any text child.
3. Remaining unbound connections: log `wirer.unmatched` with `{screenName, trigger, target}` and skip. Never guess blindly — a wrong wire is worse than a dead button.

## Test Fixtures

`src/utils/wirer/__fixtures__/` — five real planner outputs captured from the last week of generations (food delivery, fitness tracker, banking, chat app, ecommerce checkout). Each fixture is a JSON file: `{screens, connections, expectedBindings}` where `expectedBindings` is `Array<{screenName, buttonText, target}>`. Golden-file tests in `wirer.test.ts` assert wire() output matches.

Capture script: `scripts/capture-wirer-fixture.ts` — pipes a project ID's last generation into fixture format. Run once per fixture, commit the JSON.

## Integration Points

- **`api/generate-flow.ts:396-398`** — extend connection map output to `{fromScreenId, toScreenId, trigger}`. Preserve verbatim from planner.
- **`src/components/FlowConnectors.tsx:10`** — add `trigger?: string` to `FlowConnection` interface. Optional so canvas-drawn connections (no planner trigger) still compile.
- **`src/utils/wirer.ts`** — new module. Exports `wireScreen(tree, screenName, allConnections, allScreens): {tree, usesNavigation}`. Owns tokenization, scoring, assignment, fallback.
- **`src/utils/snackUrl.ts:234-257`** — replace `connectionMap` and per-screen `navTargets` with a single call to `wireScreen` per screen. Remove the overwriting Map.
- **`src/utils/exportTsx.ts:132-142`** — receive already-resolved `buttonId → target` map from wirer instead of matching inline. Delete substring-match code.

## Tasks

### Task 1: Type + data-flow plumbing

**Files:**
- Modify: `src/components/FlowConnectors.tsx:10-13` (add `trigger?: string`)
- Modify: `api/generate-flow.ts:396-398` (preserve trigger in map output)
- Modify: `src/utils/snackUrl.ts` signature for connections param

- [ ] Test: feed a synthetic plan with one connection; assert `trigger` survives from planner JSON to `connections` array emitted on `complete` event.
- [ ] Implement: extend map in generate-flow; thread `trigger?: string` through types.
- [ ] Commit.

### Task 2: Wirer module (TDD)

**Files:**
- Create: `src/utils/wirer.ts`
- Create: `src/utils/wirer.test.ts`

- [ ] Test: `tokenize("Add to Cart") === ["add", "cart"]` (stopwords dropped).
- [ ] Test: `jaccard(["add","cart"], ["cart"]) ≈ 0.5`.
- [ ] Test: `wireScreen` with trigger="Add to Cart" and button "Add to Cart" binds exactly one pair.
- [ ] Test: two buttons "Cart" and "Profile", two connections trigger="Cart" and trigger="Profile" → greedy assignment binds both correctly (not both to "Cart").
- [ ] Test: unmatched trigger with directional verb falls back to first unbound TouchableOpacity.
- [ ] Test: no match and no fallback candidate → logs `wirer.unmatched`, returns unmodified tree.
- [ ] Implement incrementally; commit per green.

### Task 3: Integration — replace substring matcher

**Files:**
- Modify: `src/utils/exportTsx.ts:132-142` (delete inline match, accept resolved bindings)
- Modify: `src/utils/snackUrl.ts:234-257` (call wireScreen, drop old Map)

- [ ] Test (integration): run `buildSnackUrl` on a fixture with 3 screens + 4 triggers; assert generated TSX contains 4 `navigation.navigate()` calls at the expected buttons.
- [ ] Implement. Delete dead code paths.
- [ ] Commit.

### Task 4: Fixture capture + golden tests

**Files:**
- Create: `scripts/capture-wirer-fixture.ts`
- Create: `src/utils/wirer/__fixtures__/{food,fitness,banking,chat,checkout}.json`
- Extend: `src/utils/wirer.test.ts` with fixture loop

- [ ] Generate 5 apps via real pipeline (one per category), capture planner output + expected bindings into fixtures.
- [ ] Golden test iterates fixtures, asserts `wireScreen` output matches `expectedBindings`.
- [ ] Commit fixtures + test.

### Task 5: End-to-end verification

- [ ] Regenerate the same 5 prompts on `main` (pre-change) and on this branch (post-change). Record in a markdown table: total connections emitted, connections wired pre, connections wired post, per-prompt.
- [ ] Manually tap through each generated app in Snack preview; note any dead buttons.
- [ ] Commit verification report to `docs/superpowers/plans/2026-04-22-wirer-upgrade-results.md`.

---

## Out of scope

- Tab-bar wiring (already works via a separate code path).
- Back-button inference (covered by planner-emitted back connections already).
- Modal/overlay triggers — deferred; log `wirer.modal_unhandled` instead.
- Any UI change to the canvas editor.
- Any validator-style alerting.
