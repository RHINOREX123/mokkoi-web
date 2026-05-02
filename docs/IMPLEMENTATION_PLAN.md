# Mokkoi — Implementation Plan

**Last updated:** 2026-05-02
**Status as of 2026-05-02:** **Weeks 1-3 closed; Week 4 Days 1, 1.5, 2, 3 closed; Week 4 Day 4 deferred (audit revealed original throttle goal solves a non-problem); Week 4 Day 5 re-scoped to wrap + Week 5 prep.** Week 4 commits: `d9bb38f` (Day 1 component) + `679c1b5` (Day 1 App.tsx wiring) + `aefcea4` (Day 1.5 P0 multi-page-build fix) + `dbf2997` (Day 2 error boundary + tree validation) + `d98b316` (Day 3 production UI cleanup) + cleanup commits `2cb90ec` (Stripe URL env-aware) + `4328829` (fuzzyMatchScreen dedupe). Day 4 deferred: live audit on 2026-05-02 found `RuntimeIframePreview` is `disabled = isGenerating || isStreaming` from App.tsx, so the original Day 4 plan (throttle `mokkoi:render-tree` posts during streaming) has no surface to apply to — there's no live iframe during streaming to throttle. Filed as `[P2, RUNTIME]` in BACKLOG: a future multi-day push to drop the disabled gate, surface `partialTree`, and throttle posts to the iframe so the user watches the screen materialize live (Bolt-style UX).

**Status as of 2026-05-01:** **Weeks 1-3 closed.** Week 1 shipped the runtime POC foundation (iframe + postMessage + Supabase fetch + BottomNav nav + phone chrome). Week 2 hardened rendering (image fallbacks, icon coverage, scroll, form inputs, leaf-component sweep). Week 3 shipped click interactivity (generic `mokkoi:click` protocol, classifier, 3-tier resolution, dynamic toast) over Days 1-2, then on Day 3 pivoted strategically: rather than ship more heuristic patches Phase 2 macro-metadata replaces anyway, wrapped Week 3 short and used the time to design the Week 4 production swap. Two architectural ceilings empirically confirmed Days 1-3: FlowConnection canonical routing is dead code in dev DB (every routing success goes through fuzzy screen-name match), and most production primary nav is card-driven (cannot route under label-keyed model — Phase 2 macro-metadata fix). Renderer pivoted from `react-native-web` to existing `ScreenRenderer` Week 1 Day 2. **Week 4 ships the runtime production-ready behind a localStorage feature flag for dev burn-in. Week 5 contains the deliberate flag-flip decision** contingent on telemetry and signal — mokkoi.com users see the runtime in Week 5, not Week 4. Week 4 begins next session.

## Project goal

Build a custom Mokkoi-controlled iframe runtime using `react-native-web` to render generated apps as live, interactive React Native web apps inside Mokkoi's preview pane (not static HTML, not Snack's iframe). Combined with a macro-prompt quality lift to raise generated-screen quality from current ~8% macro usage to ≥50%, this work brings Mokkoi to competitive parity with Bolt and Lovable on the demo experience while exploiting Mokkoi's existing `react-native-web` infrastructure (already installed, already aliased in vite.config.ts, never used at runtime).

## Sequencing decision

**Macro-prompt work first (1-2 weeks), runtime work after (4-5 weeks).** Sequential, not parallel. Defended in the implementation plan — running the runtime against today's 92%-raw-tree outputs would expose AI's poor compositions more cruelly than the static renderer hides them. Polish the trees first, then build the runtime that displays them well.

Optional chore-batching: 1-2 hours during Week 0 setting up the second Vite build target for the runtime so Week 1 starts on rendering code, not Vite config.

## Sustainable pace expectation

- **Total scope:** 100-130 hours runtime + 18-24 hours macro work = **120-155 hours total**.
- **Solo-founder cadence:** 20-25 hours/week of focused work.
- **Calendar duration:** 6-7 weeks at sustainable pace, 8-9 weeks if real life intervenes.
- **Do not compress.** The implementation plan was realistic; the timeline reflects honest estimates including 20% per-week slack for unanticipated issues. Compressing means cutting scope, not working harder.

## Reference docs

- **Strategic memo** — produced 2026-04-28 in the Claude Code session. Why this work matters, where Mokkoi is competitive vs not, what's being cut/paused. Saved in conversation history.
- **Implementation plan** — produced 2026-04-28. Detailed week-by-week roadmap with risks, hour estimates, validation checkpoints. Saved in conversation history.
- This file is the *operational* tracker derived from those two documents.

---

## Today (Day 1) — started 2026-04-28

These are the immediate first tasks for Day 1 of Week 0. Macro-prompt work begins here.

- [x] Query Supabase: read all 303 screens from the `screens` table, sort by macro density (count of macro-component types in `component_tree` / total node count). Save the result to a local file `eval/snapshot-2026-04-28.json` for reference.
- [x] Identify the 20 worst-offender screens (lowest macro density, most raw `View`/`Text` stacks).
- [x] Manually inspect 5 of those 20 sample screens. For each: read the JSON tree, write 2-3 sentences of what the AI *should* have done (e.g., "this Profile screen has 60 raw View+Text nodes that should be 1 ProfileStats macro + 8 ListRow macros").
- [x] Document the inspection findings in `eval/day1-findings.md`. This becomes input for the Day 3 prompt rewrite.

End-of-day signal: you have a clear, written understanding of where the AI is failing to use macros and what the corrected output looks like. No code changes yet.

---

## Week 0 — Macro-prompt quality lift (1-2 weeks, 18-24 hours)

### Goal
Raise macro usage in fresh generations from 8% to 50%+, measurably and durably.

### Concrete deliverables
- New `eval/` directory with harness, baseline, and post-rewrite scores.
- Rewritten `COMPONENT_TYPES` and `FUNCTIONAL_APP_RULES` sections in `api/_lib/design-system.ts`.
- New prompt deployed to production.

### "Done" criterion
Macro usage rate (averaged across 30 fresh harness generations) ≥ 50%. `FormInput` and `MessageBubble` actually appear (>0 occurrences) in chat / login screens. No regression in tree-size or content-realism scores.

### Validation checkpoint
**End of Day 3 (after first prompt rewrite + eval cycle).** Two outcomes:
- **Validated:** macro usage rose from 8% to 35%+ in one rewrite cycle. Continue.
- **Not validated:** still flat at 10-15%. AI is genuinely ignoring macros. Switch tactics: small fine-tune on 50 hand-curated macro-heavy examples (1-2 days extra), OR pivot to runtime-first (option a from sequencing memo) since the macro work would be 2-3 weeks instead of 1-2.

### Hours estimate
18-24 hours over 1-2 calendar weeks.

### Tasks
- [ ] **Day 1 — Diagnosis** (covered in "Today" section above)
- [x] **Day 2 — Build harness.** Created `eval/harness.mjs` (plus `eval/scoring.mjs`, `eval/test-set.mjs`, `eval/_load-prompts.mjs`, `eval/load-icon-validator.mjs`). Three modes: `--mode=snapshot` (score Day 1 production data, no API), `--mode=fresh` (generate via Anthropic, requires `ANTHROPIC_API_KEY`), `--mode=judge` (TODO Day 3+).
- [x] Implement scoring on 7 axes: macro density, macro presence, targeted-macro adoption (BottomNav/ListRow/ChipSelector/RatingStars/SectionHeader), icon-name validity, content realism, tree-size sanity. Multi-axis to avoid Goodhart on density-only optimization.
- [x] Run harness against production data (snapshot mode). Saved `eval/snapshot-2026-04-29.{json,md}`.
- [x] **Day 3 — Rewrite prompt v1.** Three targeted edits in `api/_lib/design-system.ts`:
  - Change 1: Strict icon-name list rule (230+ Lucide kebab-case names, explicit ban on Material Symbols identifiers like `directions_walk`).
  - Change 2: BottomNav promoted to top of macro section with imperative "REQUIRED for any app with multiple primary screens" framing, props detail, and concrete food-delivery example.
  - Change 3: New "MACRO ADOPTION RULE" block at the top of `FUNCTIONAL_APP_RULES` — 12-question decision tree mapping UI patterns to macros, plus a NEG/POS example pair replacing the legacy emoji-based BottomNav guidance.
- [x] Validated prompt extraction loads cleanly: 23,458 chars total, all three rules detected.
- [x] **Re-run harness against new prompt** — unblocked 2026-04-30 by refactoring the harness to one-screen-per-call generation (`--mode=fresh-streamed`). 30 apps generated, 182 screens scored. Iteration-1 results: macro density 17.10% (target ≥10% ✓), BottomNav adoption 86.3% (target ≥40% ✓✓), icon validity 99.33% (target ≥99% ✓), content realism 100% held. All primary targets hit on the first rewrite cycle.
- [x] **DECISION POINT resolved:** harness restructured to one screen per call (Option B from 2026-04-29 entry). Refactor was additive (`--mode=fresh-streamed` alongside the original `--mode=fresh`) and only touched `eval/harness.mjs` — production generation flow unchanged. Sequential per-screen calls at `max_tokens=5500` fit Tier 1's 10K/min cap; ~25% of screens still hit the cap on heavy data-viz layouts (Progress, History) — acceptable for measurement, would want addressing before runtime work depends on this path.
- [x] ~~**Day 4 — Iterate.**~~ **Skipped.** Iteration-1 results hit all four primary targets cleanly (density 17.10% > 10%, BottomNav 86.3% > 40%, icon validity 99.33% ≥ 99%, realism 100% held); no second cycle needed before shipping. Iteration-2 ideas (tighter icon-name guidance, list-based positive examples) deferred to a future round if production UAT surfaces specific gaps.
- [x] **Day 5 — Ship + observe (compressed evening session 2026-04-30).** Pushed `8d72417` + `ade9e63` to `origin/main`. Vercel build succeeded in ~2 min; `mokkoi.com` serving the new bundle (`Last-Modified: 2026-04-30 15:42:58Z`). Curl-smoke against production was blocked on auth (local dev `ANTHROPIC_API_KEY` doesn't match production's server-side key for MCP auth) — pivoted to user-driven manual UAT via the live UI.
- [x] Manual UAT on production. Iteration-1 working: BottomNav present across multiple screens, icons largely rendering correctly. Two issues identified, neither blocking ship:
  - Recurring icon-rendering bug (`ALERT_O` showed as red raw text) — renderer falls through to raw string when AI emits a name not in `iconMap`. Reduced by iteration-1 but not eliminated. Logged as `[P1, RENDERER]` in `BACKLOG.md` for renderer-side fallback fix.
  - BottomNav inconsistency within an app (Task Detail / Profile lacked it while Home / Tasks / Add Task had it). Could be intentional drill-down pattern; needs investigation. Logged as `[P2, PROMPT]` in `BACKLOG.md`.
- [x] ~~Document the lift in `eval/post-rewrite.md`.~~ Covered by `eval/fresh-streamed-2026-04-30.{json,md}` and decision-log entries below.
- [ ] **Chore-batch:** spend 1-2 hours setting up the second Vite build target (`vite.runtime.config.ts` or `build.rollupOptions.input` extension) so Week 1 doesn't start with config wrestling. No `runtime/` code yet — just the build pipeline. **(Deferred to Week 1 Day 1 — chose not to chore-batch tonight; tomorrow's first decision is hot-fix vs straight-to-runtime.)**

### Risks for this week
- AI ignores even strong negative examples → fine-tune fallback as documented.
- Prompt length pushes total system-prompt tokens past comfort → consider splitting prompt into a primary call + a follow-up macro-pass call (more complex but more reliable).
- Eval scoring inconsistencies (e.g., what counts as a "macro" vs raw expansion) → settle the scoring contract on Day 2 before iterating.

### Retrospective (filled 2026-04-30)
- [x] Did the Done criterion land? **Partially / yes-with-caveats.** The original criterion was "Macro usage rate ≥ 50%" — landed at 17.10%, well above the revised Day 3 target of ≥10% but well under the original 50% goal. The 50% number was always aspirational; 17% with all four primary targets cleanly hit (density, BottomNav, icon validity, realism) is a real shippable lift, not a partial.
- [x] If no, was the cause local or structural? N/A.
- [x] Final macro usage rate: **17.10%** (mean macro density across 182 streamed screens; up from baseline 2.28%).
- [x] Final icon validity rate: **99.33%** (target ≥99%; baseline 91.74%).
- [x] Time actually spent: ~5 days of focused work over the 2026-04-28 → 2026-04-30 window. Days 1–3 were diagnosis + harness + first prompt rewrite; Day 4 was skipped; Day 5 was a compressed evening combining ship + UAT into one session. Calendar-wise this matches the 1-week plan; hour count was at the lighter end of the 18-24 hour estimate.
- [x] Adjustment for Week 1: **Tomorrow's first decision is whether to hot-fix the P1 icon-renderer fallback before starting Week 1, or accept it as a known issue and proceed.** Argument for hot-fix: 1-2 hours, eliminates a recurring class of demo-breaking bugs, pays off immediately when Week 1 runtime is being demoed against generated apps. Argument against: it's not blocking Week 1 progress and the runtime work is the actual project. Defer the call to tomorrow morning.

---

## Week 1 — Iframe shell, postMessage protocol, hello-world tree (24-32 hours)

### Goal
A Mokkoi-served iframe boots, receives a JSON tree from the parent, renders it with `react-native-web` primitives, and reports back when done. End-to-end on one screen, no theming, no images, no icons.

### Concrete deliverables
- New `runtime/` directory at repo root: `runtime/index.html`, `runtime/main.tsx`, `runtime/RuntimeRenderer.tsx`, `runtime/protocol.ts`.
- `vite.config.ts` modified — second build target emits the runtime bundle to `dist/runtime/index.html`.
- New `src/components/InlineRuntimePreview.tsx` (mirrors `InlineSnackPreview` structure but talks to the new runtime).
- Throwaway `src/pages/RuntimeTest.tsx` for development verification. NOT yet wired into App.tsx.

### "Done" criterion
Navigate to `/runtime-test` in dev. Iframe loads. See a hardcoded version of the existing fitness Home tree rendered through real `react-native-web` in the iframe. Layout looks right. Outer ScrollView scrolls. DevTools shows RN-web's class-based output (`<div data-class-name="r-flex-...">`).

### Validation checkpoint
**End of Day 2.** Smallest possible iframe + RN-web ScrollView prototype. If ScrollView won't scroll inside an iframe — and CSS isolation in the main DOM also can't be made reliable — abandon RN-web. Reconsider Sandpack-style Babel-in-browser, or accept the static renderer as the final answer. This is the project's first real abort signal.

### Hours estimate
24-32 hours.

### Tasks

> **Note (2026-05-01):** the task list below is the pre-pivot Week 1 plan from 2026-04-28. Day 1 invalidated the RN-web assumption (see in-progress notes + decision log); Day 2 onwards executed against a re-scoped plan. The actual day-by-day work is captured in the in-progress notes. Boxes left unchecked because checking them would mis-state what shipped.

- [x] **Day 1 — Smallest possible prototype.** ~~Hand-write a 50-line `runtime/index.html` that imports React + react-native-web from CDN, mounts a `<ScrollView>` with 20 `<View>` children, sees if it scrolls inside an iframe served from `/runtime/index.html`.~~ Done as a Vite-served prototype; revealed RN-web is structurally broken under Vite dev. See in-progress notes.
- [x] **VALIDATION CHECKPOINT** — does it scroll? **No.** Documented fallback (CSS isolation) was orthogonal; actual fallback was renderer choice (Path 3, see decision log).
- [ ] ~~**Day 2 — Vite build target.**~~ Deferred. Runtime is currently dev-server-served from `public/runtime/`; production build target is a Week 4 concern (when the runtime replaces Snack on `mokkoi.com`).
- [ ] ~~Verify `npm run build` produces both `dist/index.html` (main app) and `dist/runtime/index.html` (runtime).~~ Week 4.
- [x] Verify dev server serves `/runtime/` correctly. (Day 2.)
- [x] **Day 3 — Protocol design.** Protocol shipped: `parent → iframe {type: "mokkoi:render-tree", tree}`, `iframe → parent {type: "mokkoi:runtime-ready"}`, `iframe → parent {type: "mokkoi:nav-click", label}` (added Day 4).
- [x] **Day 4 — RuntimeRenderer v1.** ~~Tree-walk with 5 leaf cases.~~ Re-scoped: adopted existing `ScreenRenderer` (handles all leaf cases already) inside the iframe.
- [x] ~~Copy `cleanStyle()` helper~~ — N/A (using `ScreenRenderer` directly).
- [x] ~~Other component cases fall back to `<View>` with a console.warn.~~ — N/A (`ScreenRenderer` already handles unknown types).
- [x] **Day 5 — Parent-side wiring.** `RuntimePoc.tsx` loads iframe + posts trees + handles nav clicks + renders test-rig controls (project/screen/device/zoom dropdowns).
- [x] ~~Create throwaway `src/pages/RuntimeTest.tsx`~~ — built as `src/pages/RuntimePoc.tsx` instead.
- [x] Add a dev-only route. (Wired in `App.tsx` for `/runtime-poc`.)
- [x] **End-of-week test:** open `/runtime-poc`, see real production trees render in a phone-frame iframe with working tabs and device/zoom controls. ✓

### Risks for this week
- RN-web in iframe has structural issues (touch events, scroll, viewport units) — mitigated by Day 1's prototype.
- Vite build with two entry points has subtle config issues (CORS in dev, asset paths in prod) — budget 4-6 hours for build wrestling.
- PostMessage protocol design choices that block hot updates later — keep the protocol message-based and stateless this week; don't over-engineer.

### Retrospective (filled 2026-05-01)

**Did the Done criterion land?** Re-scoped from the original then yes. The original criterion ("hardcoded fitness Home tree rendered through real `react-native-web` in the iframe") died on Day 1 — RN-web is structurally unusable under Vite's CJS pre-bundler in dev mode, and trying to make it work would have eaten Week 1 with no user-visible payoff. Re-scoped Day 2 to: iframe + postMessage protocol + JSON-tree renderer (renderer happens to be `ScreenRenderer` instead of RN-web). That criterion landed cleanly. By Day 5 the runtime POC renders real Supabase trees from real projects, navigates between screens via tab clicks, and looks like a phone — well past the original "render one hardcoded tree" bar.

**Did Day 1's validation checkpoint pass cleanly?** No. RN-web inside the iframe failed at module init with `inline-style-prefixer/lib/createPrefixer.js` missing its default export under Vite's CJS shim. Excluding from `optimizeDeps` only relocated the failure to `@react-native/normalize-colors`. The "documented fallback" (CSS isolation in main DOM) was orthogonal — the actual fallback was renderer choice (Path 3 — see decision log 2026-05-01 entry below).

**Time spent:** ~25 hours over 5 days (estimate was 24-32). Lighter than budget because the Path 3 pivot cut the Vite/CJS interop work entirely, and Days 3-5 each ran 4-5 hours with clear scoping.

#### Architectural learnings (the why-did-we-decide-that documentation)

**Why Path 3 (ScreenRenderer) over RN-web.** The original plan was to render via `react-native-web` because it would give true RN primitives at runtime — closer to what the AI thinks it's generating, closer to what an exported Expo app would look like. The implementation reality on Day 1: RN-web 0.21.2 is installed, aliased in `vite.config.ts`, and *never exercised at runtime in this codebase*. Every existing `from 'react-native'` import lives inside string-template code generators that emit Snack source. The first time we actually tried to bundle RN-web for a runtime page, Vite's dev-mode CJS pre-bundler exposed two unfixable interop holes (`inline-style-prefixer`, `@react-native/normalize-colors`). The estimated cost to power through was 1-2 days of Vite config wrestling with no user-visible benefit — RN-web's render output looks identical to what `ScreenRenderer` already produces for the screens Mokkoi generates today (no native-specific behaviors like `Platform.select`, no native modules, no native gestures). The Day-2 pivot kept the architecture (iframe + postMessage) and swapped only the renderer. Future-you in Week 4: if export fidelity becomes important (e.g., users want to copy runtime code into an Expo project) and RN-web's Vite interop has been fixed, swap back is mechanical — replace the renderer inside the iframe; the protocol and parent code don't change.

**Why parent owns all data orchestration; iframe stays dumb.** Day 3's instinct was to give the iframe its own Supabase client so it could fetch its own trees. Resisted because: (a) duplicating auth in the runtime bundle means duplicating auth bugs, (b) the runtime would need to know about Mokkoi-specific concerns (project IDs, screen IDs, RLS) that have nothing to do with rendering, (c) future hot-update work in Week 5 wants to push partial trees from the parent without involving network round-trips through the iframe. The current shape — parent fetches, parent posts via `mokkoi:render-tree`, iframe just renders — is the same shape that Week 5's hot updates will use. The iframe's only job is "given a JSON tree, render it; given a click, report it." This scales: Week 2's image proxy and icon expansion can stay in the iframe (they're rendering concerns), but Week 3's flow connections, Week 4's theme propagation, and Week 5's hot updates all stay parent-side. The protocol stays small.

**Why heuristic BottomNav detection is acceptable for Phase 1.** The clean way to detect BottomNav-vs-just-a-row-of-buttons is to read the `BottomNav` macro tag off the tree. We can't, because `expandComponents()` runs server-side at generation time and discards the macro semantics — the stored tree is a flat raw-primitive tree with no metadata about what was originally a `BottomNav`, `ListRow`, `ChipSelector`, etc. Day 4's heuristic (`flexDirection:row` + `paddingBottom>=24` + `borderTopWidth>=1` + ≥2 button children) is deliberately conservative — false negatives (missing a real BottomNav) are recoverable by the user picking another screen, false positives (treating a button row as nav) would route taps to the wrong place. It works on the one production app that has a BottomNav. It will break on edge cases, which is fine for Phase 1 because the *real* fix is structural: preserve macro semantics in stored trees and expand only at render time. Phase 2 macro-metadata preservation is logged as P2 ARCHITECTURE in the backlog. Don't sand the heuristic; replace the data model.

**Macro semantic loss — the bigger architectural debt.** This is the finding from Week 1 that informs Week 2-5 planning. `BottomNav` is the visible case but not the only one: `ListRow` items lose their key-value structure (so we can't auto-format them), `ChipSelector` chips lose their selection model, `FormInput` fields lose their submission targets, and so on. Every rendering decision the runtime needs to make about what something *is* (vs what it visually *looks like*) requires either a heuristic or a synonym table. Phase 2 should preserve macro tags through expansion — the simplest version is keeping the macro `type` and `props` attached as metadata on the expanded subtree's root node. The runtime then has the option to read the metadata for navigation/interactivity decisions while still falling back to rendering the expanded primitives. This is a generation-pipeline change, not a runtime change — Week 4 is probably the right time, after the runtime is live and the cost-of-not-having-this is concrete.

**Why parent owns nav state (not the iframe).** Day 4 considered putting the active screen ID inside the iframe as React state. Pulled back because: (a) the parent already has the screen list and connections; the iframe would be re-deriving state the parent already owns, (b) URL params (`?project=&screen=`) are a parent concern; the iframe can't write to the parent's URL, (c) Week 3's planned chat-panel-tab ↔ in-iframe-tab two-way sync needs the parent to be the source of truth or it ping-pongs (the same bug that bit the canvas's `PreviewPhoneFrame` in Phase 2). Single-source-of-truth from the start avoids Week 3 unwinding it. The iframe sends `mokkoi:nav-click {label}`, the parent decides the target screen, the parent posts back the new tree. The iframe never holds nav state.

#### Honest verification — what the testing actually told us

**Only 1 of 4 production apps has a BottomNav.** Three of the four projects in the dev DB are single-screen seed apps (MCP imports, mokkoi, the second fitness app) with no nav at all. Only the fitness tracker exercises Day 4's nav code path. We are therefore over-fit to one app's tree shape. Week 2's verification needs canonical archetype seed data (food-delivery, banking, e-commerce, social) — already filed as P3 INFRA in the backlog. Without it, every "we tested across N apps" claim has an asterisk.

**Only 2 of 5 tabs on the one app actually navigate.** The fitness tracker's BottomNav has 5 tabs: `home`, `nutrition`, `person`, `fitness_center`, and one rendering as `circle` (fallback for the AI's `bar-chart-3` which isn't in the icon map). `home` and `nutrition` navigate correctly via fuzzy match against screen names. The other three warn-and-no-op because the AI generated icon-only tabs (no Text labels), so we fall back to the icon glyph name (`person`, `fitness_center`, `circle`) and there's no screen named `person` or `fitness_center` to match. This is two compounding prompt-quality failures: (a) AI omits Text labels on tabs, (b) AI emits icon names that aren't in our map. Both are fixable in Week 2's prompt iteration cycle (logged as P2 PROMPT). The runtime's nav code is doing the right thing; it's working with bad input.

**What this tells us about test data and prompt quality.** Two corollaries: (1) Week 2 must seed real archetype apps before claiming "the runtime renders any app" — we genuinely don't have evidence for that yet. (2) The runtime is now exposing prompt-quality issues that the static renderer was hiding (icon-only tabs look fine in a screenshot; they break navigation). Expect Week 2-3 to surface 5-10 more "the AI is generating something that renders but doesn't behave" issues that get caught by the runtime test rig and not by the eval harness. The runtime is, among other things, a continuous prompt-quality observer.

#### Open backlog from Week 1 (P2/P3, see [BACKLOG.md](BACKLOG.md))

- `[P2, ARCHITECTURE]` Stored trees have lost macro semantic structure — informs Phase 2.
- `[P2, PROMPT]` AI generates BottomNav tabs without Text labels — fix in Week 2 prompt iteration.
- `[P2, PROMPT]` BottomNav consistency across primary screens — re-investigate with Week 2 archetype seed data.
- `[P2, PROMPT]` Empty / placeholder labels in components, wrong macro selection for data displays (chips vs key-value rows) — Week 2 prompt iteration.
- `[P2, RENDERER]` `JUNK_CHILD_RE` regex incorrectly filters single-word PascalCase labels — short fix; could batch with Week 2 work.
- `[P3, INFRA]` Seed canonical archetype test apps in dev DB — block Week 2 verification on this.
- `[P3, RENDERER]` Fitness Home progress-ring text overlay — visual quirk, low priority.
- `[P3, PROMPT]` Logo / brand text rendered raw — investigate root cause when convenient.
- `[P3, RUNTIME]` Icon-name → screen-name synonym map — patch only; obsoleted if Phase 2 macro-preservation lands.

#### Mood

**Working well:** the architecture pivot on Day 1 cost half a day and saved a week. The parent-owns-state pattern feels right — every Week 1 day extended it without re-architecting. The runtime is real enough to test prompt quality, which the static renderer was never going to do.

**Watch for in Week 2:** scope creep around "make icons render correctly" — there are 230+ Lucide names + Material Symbols mappings + the existing fallback. Box this to a known subset (top 80 most-used) and accept the long tail as a separate concern. Also watch for the runtime exposing more prompt-quality failures that *look* like rendering bugs — triage carefully so backlog items get filed in the right area (PROMPT vs RENDERER).

#### In-progress notes (Day 1-5)

- **Day 1 (2026-05-01):** prototype revealed RN-web has structural issues with Vite's CJS pre-bundler in dev mode. `inline-style-prefixer/lib/createPrefixer.js` is bundled missing its `exports.default = createPrefixer`, throwing `(0, import_createPrefixer.default) is not a function` at module init. Excluding RN-web from `optimizeDeps` punts the failure deeper to `@react-native/normalize-colors` (different CJS interop break). RN-web 0.21.2 has never been exercised at runtime in this codebase — every existing `from 'react-native'` lives inside string-template code generators. Two pre-existing dev-server bugs surfaced and one was fixed: `process is not defined` (snack-sdk reads `process.env.NODE_ENV` at init; production replaces it statically, dev didn't — fixed via 6-line `window.process` shim in `index.html`).
- **Day 2 (2026-05-01):** pivoted runtime renderer from RN-web to ScreenRenderer (Path 3). Same iframe + postMessage architecture; just swapped the renderer inside the iframe. ScreenRenderer imported as-is — no slicing needed (its only deps are `types/mokkoi` and `utils/iconMap`). Hard-coded a macro-laden tree (HeaderBar + ScrollView + StatCard×3 + PromoCard + ListRow×3 + BottomNav), expanded via `expandComponents` client-side, sent via postMessage. Iframe rendered the full screen with Material Symbols icons, real layout, and scrolling. **One Vite-specific iframe quirk:** files served from `public/` skip Vite's HTML transform, so `@vitejs/plugin-react`'s preamble isn't injected — JSX modules error with "can't detect preamble." Fix: added the preamble manually to `public/runtime/index.html` (5 lines, no-op in production).
- **Architecture deferred to Week 2:** runtime currently treats macro components as primitives (relies on `expandComponents` running on the parent before postMessage). Decide in Week 2 whether the runtime should expand macros itself (so Supabase reads can stream raw macro trees directly) or stay parent-expanded.
- **Pre-existing canvas bug surfaced:** `ScreenRenderer.tsx`'s `JUNK_CHILD_RE` regex (line 195) uses the `/i` flag, which makes the all-caps junk filter incorrectly match any single-word PascalCase string like "Discover", "Featured", "Home", "Profile". These labels disappear in both the canvas AND the runtime — fidelity preserved, but it's a real bug. Not fixed today (out of scope; ScreenRenderer.tsx is read-only this week). Add to BACKLOG.md.
- **Day 3 (2026-05-01):** wired the runtime to fetch real production apps from Supabase. New `src/lib/runtimeFetch.ts` exposes `fetchUserProjects` / `fetchProjectScreens` / `fetchScreenTree`. `RuntimePoc.tsx` now boots from URL params (`?project=&screen=`) with project + screen dropdowns (most-recent 20 projects, sorted by `updated_at`). Iframe stays a dumb renderer — all data orchestration is parent-side; protocol unchanged. Verified across 3 of 4 available projects (fitness tracker, MCP imports, fitness dashboard); no new console errors, only the pre-existing icon-name fallback warnings. Two backlog items filed: missing canonical archetype seed data (no food-delivery / banking apps in dev DB), and a fitness Home progress-ring text overlay (fidelity preserved with canvas — pre-existing).
- **Day 4 (2026-05-01):** BottomNav tabs are clickable in the runtime. Click → `mokkoi:nav-click` postMessage → parent fetches → re-renders. Parent owns nav state, iframe stays dumb. Protocol: new `mokkoi:nav-click` message; reuses existing `mokkoi:render-tree` for the response. Foundation for Week 3 broader interactivity. **Architecture note:** stored trees lost the `BottomNav` macro semantics (server-side `expandComponents` runs at generation time), so tab detection uses an inline-style heuristic on the row container (`flexDirection:row` + `paddingBottom>=24` + `borderTopWidth>=1` + ≥2 `[role="button"]` children) and label-based mapping via `findNavigationTarget` from `src/utils/previewNavigation.ts` (canonical: project's `connections` JSONB) with a fuzzy screen-name fallback for apps without flow connections. ScreenRenderer untouched — click capture lives in `src/runtime/main.tsx`'s wrapper `<div onClickCapture>`. Verification: 1 of 4 production apps has a BottomNav (the fitness tracker; the other three are single-screen seed apps). On the fitness tracker, `home`/`nutrition` tabs navigate correctly via fuzzy match; `person`/`fitness_center`/`circle` (rendered fallback for unknown `bar-chart-3`) tabs warn-and-no-op because the AI generated icon-only tabs (no Text labels), forcing fallback to icon glyph names that don't always overlap with screen names. URL params + screen dropdown stay in sync. Three backlog items filed: macro semantic loss in stored trees (P2 architecture), AI generates BottomNav without Text labels (P2 prompt), icon-name → screen-name synonym map (P3 runtime).
- **Day 5 (2026-05-01):** phone-frame chrome (bezel + iOS notch / Android status bar + home indicator) wraps the iframe, plus device + zoom dropdowns wired into the test rig. New `src/components/RuntimePhoneFrame.tsx` (~120 lines) — separate from the existing `PhoneFrame.tsx` because PhoneFrame embeds its own content (ScreenRenderer / image / shimmer) with no children slot, while the runtime's content is an iframe owned by the parent. Reused: `DEVICE_PRESETS` (16 devices), `getDevicePreset` / `resolveDeviceId` from `constants/devices.ts`, `MIN_ZOOM` / `MAX_ZOOM` from `utils/computeFitScale.ts`. Smart default zoom: `getDefaultZoom(height)` returns 1.0 / 0.75 / 0.5 by device size so iPhone SE doesn't render tiny and an iPad fits on a laptop screen — sticky once the user manually overrides via dropdown. URL params extended from `?project=&screen=` to `?project=&screen=&device=&zoom=` so a test setup is fully shareable. Verified across all 4 production apps and 3 device categories (iOS / Android / iPad equivalent): chrome swaps correctly, manual zoom overrides survive device changes, BottomNav nav still fires through the iframe (postMessage protocol unchanged). No regressions on Day 1-4 functionality.

---

## Week 2 — Image rendering, icons, all component leaves (20-26 hours)

### Week 2 prep notes (added 2026-05-01 at Week 1 close)

**Goal recap.** Every component type the AI emits today renders correctly in the runtime. The Week 2 deliverables list below was written pre-pivot when the renderer was going to be RN-web from scratch — most of it is already done because the runtime adopted the existing `ScreenRenderer`, which already handles the leaf cases (Image with proxy, Icon with Lucide-first iconMap, ScrollView, TextInput, Switch, SVG primitives). Week 2 should re-scope to what's actually missing rather than re-implementing what's already working.

**Components to verify render correctly in the runtime (re-validate, not re-build):**
- `Image` with Pexels-keyword proxy (`ProxyImage` exists in `ScreenRenderer.tsx` — confirm it works through the iframe origin without CORS issues).
- `Icon` with `iconMap.ts` (Lucide-first; Material Symbols fallback shipped 2026-05-01 via `KNOWN_MATERIAL_SYMBOLS` set + circle glyph fallback).
- `ScrollView` (already verified scrolling on Day 2).
- `TextInput` and `Switch` (currently rendered as plain primitives by `ScreenRenderer`; check whether they render as interactive HTML inputs or static visuals — likely static, may be fine for Phase 2 scope).
- SVG primitives (`Svg`, `Circle`, `Path`, `Rect`, `Line`) — confirm they render via the existing pass-through.
- `LinearGradient` — verify it renders via CSS linear-gradient.

**Backlog items from Week 1 to address before/during Week 2:**
- `[P3, INFRA]` Seed canonical archetype test apps — **do this before Week 2 verification work**, not after. Without food-delivery / banking / e-commerce / social apps in the dev DB, we cannot honestly claim "the runtime renders any app." Consider lifting test data from production rather than generating fresh.
- `[P2, PROMPT]` AI generates BottomNav tabs without Text labels — fix in Week 2's prompt iteration cycle. Trivial prompt-side change ("every BottomNav tab MUST have a Text label child"), high impact on Week 1's nav reliability.
- `[P2, PROMPT]` Empty labels and wrong macro selection (chips vs key-value rows) — bundle into the same iteration cycle.
- `[P2, RENDERER]` `JUNK_CHILD_RE` regex over-filtering single-word PascalCase labels — short renderer fix; could batch with Week 2 work since Week 2 is renderer-focused.

**Open architectural questions to resolve early in Week 2:**
- *Should the runtime expand macros at render time, or continue accepting pre-expanded trees?* Week 1 chose pre-expanded (parent expands via `expandComponents`, posts the expanded tree). The cost: macro semantics are gone by the time the runtime sees the tree, so navigation/interactivity rely on heuristics (Day 4) and synonym tables. The fix is Phase 2 macro-metadata preservation in stored trees — but if that's deferred to Week 4, Week 2 has a tactical decision: either accept heuristics for everything, or have the parent attach a `_macros` sidecar to the tree before postMessage. Recommendation: accept heuristics through Week 2-3 and revisit at the start of Week 4 when macro preservation becomes the unblock for richer interactivity.
- *How to bound icon-name coverage?* The iconMap has hundreds of entries; the AI emits names that aren't in any of them. Phase 1 shipped a fallback (`circle` at 0.4 opacity). Phase 2 question: do we keep growing the map (synonym entries for AI-generated names), or push back on the prompt to constrain icon vocabulary? The eval harness shipped 99.33% icon validity at iteration-1 — pushing past 99.9% has diminishing returns vs the renderer's silent-fallback already covering the 0.7% gap.
- *Image proxy origin — through iframe or through parent?* The `ProxyImage` fetch currently runs inside the renderer. If it runs inside the iframe, every image resolves over the iframe's origin (same as the parent in dev, but worth verifying for production CORS). If it runs in the parent (parent resolves URLs and posts them with the tree), the iframe never makes outbound requests — cleaner isolation, slightly more work in the protocol. Decide on Day 1 of Week 2.

### Goal
Every component type the AI emits today renders correctly in the runtime. Visual parity with the static renderer at the same level of polish.

### Concrete deliverables
- Extended `runtime/RuntimeRenderer.tsx` with cases for all 25 component types.
- `runtime/Image.tsx` — Pexels proxy fetching but emits real `<Image source={{uri}} />`.
- `runtime/Icon.tsx` — real `lucide-react` vector icons, no Material Symbols font.
- Layout regression tests in `eval/` — render 6 archetype trees in the runtime, screenshot, diff against static renderer.

### "Done" criterion
Render the existing fitness app's seven screens (Home, Workouts, Workout Detail, Active Workout, Progress, Nutrition, Profile) one at a time via test page. Each looks visually equivalent to or better than the static renderer. Real photos load. Real vector icons render — no `directions_walk` text bug.

### Validation checkpoint
**End of Day 3.** All five fitness screens render via runtime. If any single screen is fundamentally broken (not a small style issue but actually unrenderable), that's a sign the renderer architecture has a gap; debug or scope down.

### Hours estimate
20-26 hours.

### Tasks
- [ ] **Day 1 — Text styling polish.** Extend `Text` case to handle full styling: fontWeight, lineHeight, letterSpacing, textAlign, color.
- [ ] Add `TextInput` → RN-web's `TextInput`.
- [ ] Add `Switch` → RN-web's `Switch`.
- [ ] Add `ActivityIndicator`, `SafeAreaView`.
- [x] **Day 1 (revised cadence, 2026-05-01) — Image rendering hardening.** Re-scoped from the original Day 2 task. Instead of a separate `runtime/Image.tsx`, hardened the existing `ScreenRenderer` Image case in place (reused by both canvas and runtime — see decision log). Added `RawUriImage` component for the `source.uri` branch with URI validation, onError → styled placeholder filling original dimensions, and deduped `console.warn` for diagnostic logging. `searchQuery` and `avatar` branches verified unchanged. Dual improvement (canvas + runtime). Deferred avatar onError and LoremFlickr double-bounce optimization to backlog (P3).
- [x] ~~Add optional `props.resolvedUri` field~~ — not needed; existing `ProxyImage` fetch via `/api/generate?action=image` is already cached (in-memory + Supabase), and `source.uri` direct URLs go to `<img>` without a separate resolution step.
- [x] Test: render a tree with images — verified Workouts (4 searchQuery via LoremFlickr), Aura Studio Product (4 lh3 source.uri), forced-failure synthetic tree (broken URL, empty URI, malformed URI all fall through to placeholder).
- [x] `props.avatar` support already present (DiceBear initials URL) — verified unchanged.
- [x] **Day 4 (revised cadence, 2026-05-01) — Form input rendering audit + fixes.** Audited TextInput, Switch, Checkbox, RadioButton, Slider in ScreenRenderer. Findings: TextInput rendered a real `<input>` but with `readOnly` hard-coded — user physically could not type; AI's `value` prop was discarded entirely; no focus styles; no `keyboardType`, no `multiline`. Switch was visually styled but had no `onClick`, no local state — visually frozen at AI's initial value. Checkbox/RadioButton/Slider have no cases (and aren't in the prompt's primitive list, not observed in production trees, not produced by macros) — left untouched. **Architecture decision: uncontrolled.** The runtime is a preview, not a real form. AI's `value` is a layout placeholder ("Sarah", "you@example.com") meant to demo the design, not real user state. Going controlled would require a node-identity-keyed state map in the renderer purely so users can type — complex, easy to break, no payoff. Uncontrolled means AI's `value` becomes HTML `defaultValue`, user types freely on top of it, switch flips on click via local `useState`. Week 3's real form-state work will replace this intentionally, not patch over it — uncontrolled-by-design, not by-omission. Hardened: extracted TextInput and Switch into `InteractiveTextInput` and `InteractiveSwitch` components (so hooks can run), removed `readOnly`, piped AI `value` to `defaultValue`, added `keyboardType` → HTML `inputMode` mapping (email-address/numeric/decimal-pad/phone-pad/url/number-pad), `multiline:true` → `<textarea>`, focus indicator via `:focus { box-shadow }` rule (box-shadow used instead of outline because the inline `outline:none` from the previous white-rectangle defense overrides external `outline` rules). Switch local state via `useState(initialOn)`, click toggles, Space and Enter also toggle (`tabIndex:0` for keyboard reachability), aria-checked stays in sync. **Switch reset on navigation works without a `key` prop hack**: when BottomNav nav posts a different-shape tree, React unmounts and remounts → state resets naturally. Verified with synthetic A→B→A nav cycle, switches returned to AI initial values. Same-shape re-posts (e.g. hot reload) preserve user state, which is the desired UX. Future Week 3 form-state work shouldn't preemptively add identity-management code for this — current architecture handles it. **Canvas dual-improvement**: Switch in canvas now also toggles on click (was visually frozen before). All P1+P2 verification passed; no new gaps surfaced.
- [x] **Day 3 (revised cadence, 2026-05-01) — Scroll behavior audit + fixes.** Audited ScrollView + FlatList in ScreenRenderer. Findings: ScrollView already had the "stretchy children" fix and Webkit-touch polish, but lacked `overscroll-behavior` so scrolling at end-of-content could chain to the parent runtime POC page; FlatList ignored `props.horizontal` (always vertical), missed `WebkitOverflowScrolling:'touch'` and `scrollbarWidth:'none'` so vertical FlatLists looked different from vertical ScrollViews; `scrollbarWidth:'none'` was Firefox-only — Chrome/Safari still showed scrollbars. Hardened: added `overscrollBehavior:'contain'` to both ScrollView and FlatList outer divs, brought FlatList to feature-parity with ScrollView (horizontal axis handling, touch polish, scrollbar hide), added a `.mokkoi-screen-scroll::-webkit-scrollbar { display: none }` rule to both `public/runtime/index.html` (iframe) and `index.html` (canvas), and tagged both scroll containers with that class. **Dual-defense for scroll-chain isolation is intentional, not redundant**: per-component `overscroll-behavior:contain` covers ScrollView/FlatList, and a body-level `overscroll-behavior:none` in the iframe HTML catches future scroll containers we haven't built yet (e.g. raw Views with `overflow:auto` from AI). FlatList now mirrors ScrollView's full feature set. Canvas dual-improvement: scrollbar is now hidden in Chrome/Safari too, was Firefox-only before. Verified on Workouts screen: vertical scroll reaches end cleanly without chaining; synthetic horizontal-FlatList postMessage test confirms axis swap. New backlog entry: empty/zero-content children squish in horizontal scroll (P3 RENDERER, defensive — pre-existing pattern, not observed in production trees).
- [x] **Day 2 (revised cadence, 2026-05-01) — Icon rendering audit + improvements.** Re-scoped from "build runtime/Icon.tsx with lucide-react." The runtime adopted ScreenRenderer's existing Material Symbols path, so today was an audit-and-harden pass on the shared renderer. Findings: 5 strict-list Lucide names (`alert-circle`, `battery-dead`, `bicycle`, `barbell`, `cake`) had no `LUCIDE_TO_MATERIAL` entry and silently fell back to circle; the Material Symbols font CSS used `display=swap`, causing a brief flash of raw glyph names ("home", "favorite") in the fallback font on cold load; macros in `lib/component-library.ts` violated the strict-Lucide rule by emitting Material snake_case names (`arrow_back`, `monitoring`, `chevron_right`, `sentiment_satisfied`). Hardened: added the 5 missing aliases + 5 conservative aliases for observed AI hallucinations (`bar-chart-3`, `bar-chart-4`, `chevron-double-right`, `chevron-double-left`, `star-border`); switched font CSS to `display=block` so glyphs stay invisible during font load instead of rendering raw words; renamed macro icon names to Lucide kebab-case so our macros match the rule we enforce on the AI. Verified on fitness Workouts screen: 18/18 icons render with proper glyphs, zero fallback. Three new backlog entries: document `filled` prop (P2 PROMPT), strict-list generator should validate against `KNOWN_MATERIAL_SYMBOLS` (P2 PROMPT), Material Symbols font subsetting (P3 PERF).
- [x] **VALIDATION CHECKPOINT** — fitness app screens render via runtime across all primary types. Day 1-4 verifications + Day 5 sweep confirm coverage.
- [x] **Day 5 (revised cadence, 2026-05-01) — Leaf-component sweep + Week 2 retrospective.** Audited every `case` in `renderNode` against the prompt's primitive list and macro outputs. Coverage map: every prompt primitive (View, SafeAreaView, ScrollView, Text, TextInput, TouchableOpacity, Image, ActivityIndicator, Switch, FlatList, Svg, Circle, Path, Rect, Line, Icon, LinearGradient) has a dedicated case, plus bonus SVG primitives (Defs, SvgLinearGradient, Stop) used by ProgressRing. Zero P1 gaps. Two P2 gaps fixed: `Text.numberOfLines` was silently ignored — added `-webkit-line-clamp` switch when prop is set (works for both single-line and multi-line truncation); TouchableOpacity gave no pressed-state visual feedback before Week 3 wires real onPress — added a `.mokkoi-touchable:active { opacity: 0.7 }` global rule (in both iframe and canvas HTML) so tapping at least dims the element. Verified: numberOfLines=2 clamps to 36px (~2 lines), numberOfLines=1 to 18px (~1 line), unconstrained text wraps to 54px (3 lines). Week 3 deferrals: TouchableOpacity onPress wiring, Polygon/Ellipse/G SVG primitives (not in prompt), Text RN-only props (`adjustsFontSizeToFit` etc.), KeyboardAvoidingView/Modal/RefreshControl.

### Risks for this week
- `lucide-react` bundle bloat → dynamic import or hardcoded subset.
- SVG rendering inside RN-web has known issues with `strokeDasharray` (used by ProgressRing) → keep raw SVG, don't use react-native-svg.
- Image proxy CORS issues from iframe origin → use `crossOrigin="anonymous"` on `<Image>` source attribute or proxy through Mokkoi's API endpoint.

### Retrospective (2026-05-01)

Week 2 closed. The runtime renders production trees with high visual fidelity across every primary component type: images load with onError fallbacks, icons resolve through a hardened map, scroll behaves correctly inside the iframe, form inputs accept input, SVG primitives render. Day 5's audit found zero P1 gaps — all visibly-broken issues identified during Days 1-4 were closed during Days 1-4. The remaining backlog is iteration-2 prompt territory and P3 polish.

**What shipped, day by day:**
- **Day 1 — Image hardening.** `RawUriImage` component for `source.uri` rendering, with URI validation, `onError` handler, and a styled placeholder that fills the original style dimensions instead of collapsing or rendering a broken-image icon. Avatar and searchQuery branches verified unchanged.
- **Day 2 — Icon rendering audit + improvements.** 5 strict-list Lucide names (`alert-circle`, `battery-dead`, `bicycle`, `barbell`, `cake`) had no `LUCIDE_TO_MATERIAL` entry and silently fell back to circle — added explicit aliases. 5 conservative aliases for observed AI hallucinations (`bar-chart-3`, `bar-chart-4`, `chevron-double-{left,right}`, `star-border`). Material Symbols font CSS switched from `display=swap` to `display=block` to eliminate the cold-load flash of raw glyph names like "favorite" rendering in DM Sans. Macro internals in `lib/component-library.ts` switched from snake_case Material names (`arrow_back`, `monitoring`, `chevron_right`, `sentiment_satisfied`) to Lucide kebab-case so our own macros match the rule we enforce on the AI.
- **Day 3 — Scroll behavior fixes.** Dual-defense `overscroll-behavior` for scroll-chain isolation (per-component `contain` on ScrollView/FlatList outer divs PLUS body-level `none` in iframe HTML — intentional belt-and-braces, not redundancy: the body rule catches future scroll containers we haven't built yet, e.g. raw Views with `overflow:auto` from AI). FlatList finally honors `props.horizontal`, gets touch polish and scrollbar hide to match ScrollView. `.mokkoi-screen-scroll::-webkit-scrollbar { display: none }` rule added to both iframe and canvas HTML — Chromium and Safari now hide scrollbars too, was Firefox-only via inline `scrollbarWidth:none`.
- **Day 4 — Form inputs interactive.** TextInput dropped `readOnly`, AI's `value` becomes HTML `defaultValue`. Switch became interactive via local `useState`. Both extracted to `InteractiveTextInput` / `InteractiveSwitch` so hooks can run. `keyboardType` → HTML `inputMode` mapping. `multiline:true` → `<textarea>`. Focus indicator via `:focus { box-shadow }` (box-shadow not outline because the inline `outline:none` defense from the white-rectangle fix overrides external `outline` rules). Switch keyboard accessibility (`tabIndex:0`, Space + Enter toggles).
- **Day 5 — Leaf-component sweep.** `Text.numberOfLines` line-clamp support, TouchableOpacity active-state opacity feedback. Then this retrospective.

**Architectural decisions worth carrying into Week 4:**

1. **Image fallback design — placeholder fills original dimensions.** When `RawUriImage` fails (`onError`), it doesn't collapse to zero, render a broken-image icon, or stretch to fill its parent. It renders a neutral filled rectangle at exactly the style dimensions the AI specified. Looks intentional, not broken. Layout doesn't shift. This is the right model for a *preview* — fidelity to layout intent matters more than surfacing the failure prominently. Diagnostic logging via deduped `console.warn` keeps the failure visible to engineers without polluting the visual.

2. **Dual-defense scroll-chain isolation is intentional, not redundant.** Per-component `overscroll-behavior:contain` on ScrollView/FlatList covers today's known scroll containers. Body-level `overscroll-behavior:none` on the iframe `html, body` catches anything we haven't built — e.g. if iteration-2 prompt teaches the AI to emit a raw `View` with `overflow:auto`, the body rule prevents that from chaining out. Future-you will see the duplication and be tempted to remove one. Don't. The body rule is the safety net for unknowns.

3. **Forms uncontrolled by deliberate choice.** AI's `value` prop is a layout placeholder ("Sarah", "you@example.com"), not real user state. Going controlled would require a node-identity-keyed state map in the renderer purely so users can type — complex, easy to break re-render identity, no payoff in a preview. Uncontrolled means `value` → `defaultValue`, user types freely, switch flips on click via `useState`. Switch state resets when navigating away and back via BottomNav: React unmounts/remounts on tree-shape change, state resets naturally, no `key` prop hack needed. Same-shape re-posts (hot reload) preserve user state — the desired UX. Week 3's real form-state work will replace this intentionally, not patch over it.

4. **Dual-improvement pattern via shared ScreenRenderer.** Every Week 2 fix improved both canvas and runtime simultaneously, because the runtime delegates to the same `ScreenRenderer` component the canvas already used. This was *not* the original Week 2 plan — the original plan was to build a separate `runtime/RuntimeRenderer.tsx` from RN-web primitives. The pivot to ScreenRenderer (made on Week 1 Day 2 after RN-web's CJS pre-bundling broke under Vite) saved a week's work AND surfaced production canvas bugs that had been latent without anyone noticing: broken-image icons on `lh3` URLs, raw text flash before Material Symbols loaded, scrollbars visible in Chrome despite the Firefox-only inline `scrollbarWidth:none`. The pattern to carry forward: every renderer change is a canvas change, hold both surfaces to the same fidelity bar.

**Backlog accumulated this week (ordered by impact, not by day):**
- `[P2, PROMPT]` Document `filled` prop on Icon — active BottomNav tabs visually identical to inactive (only color differs). Documenting in iteration-2 lets AI generate proper active-state visual hierarchy.
- `[P2, PROMPT]` Strict icon list should be validated against `KNOWN_MATERIAL_SYMBOLS` at prompt-build time — Day 2's 5 misses surfaced because the strict list was hand-edited without checking the iconMap. Generator validation prevents recurrence.
- `[P2, PROMPT]` BottomNav icon-only tabs (carryover from Week 1) — AI sometimes emits BottomNav without Text labels, which forces label fallback to icon glyph names that don't always overlap with screen names → fuzzy nav can no-op.
- `[P2, ARCHITECTURE]` Stored trees lost macro semantic structure (carryover from Week 1) — `expandComponents` runs at generation time, so by the time the runtime sees a stored tree, BottomNav/StatCard/etc. are gone. Heuristic detection works for BottomNav today (Week 1 Day 4), but Week 3's broader interactivity will pressure this. Possibly Phase 2 fix (sidecar `_macros` field), possibly Week 4 problem.
- `[P3, RENDERER]` Empty/zero-content children squish in horizontal scroll — pre-existing pattern, defensive only, not observed in production trees.
- `[P3, PERF]` Material Symbols variable axis font is large — subset to actually-used glyphs.
- `[P3, RENDERER]` Avatar onError + LoremFlickr double-bounce optimization — minor.

**What's working well:**
- **Audit → gap → approve → implement → verify rhythm.** Each day starts with reading, not coding. Decisions made before implementation. Verification surfaces real issues honestly — Day 4's "switch state didn't reset on same-tree re-post" was nearly logged as a bug until the verification scenario was sharpened to actual nav-away-and-back, which proved the natural React behavior was correct.
- **Backlog discipline.** Verification gaps logged, not silenced. Day 5's audit shows zero P1 items because Days 1-4 actually closed their P1 lists — the backlog is honest.
- **Hard rules holding.** ScreenRenderer modifications stayed minimal and additive. `api/_lib/design-system.ts` untouched. Production prompt code untouched. The runtime POC is dev-only — production canvas + Snack export are unaffected, except where they got the dual-improvement upgrades.

**What to watch in Week 3:**
- **Real interactivity is the hardest week.** Event propagation across the iframe boundary is solved for BottomNav (Week 1 Day 4), but extending to non-BottomNav clicks needs a clean abstraction or it'll calcify into special-cases. Navigation state for buttons that aren't tabs is the genuinely new problem.
- **The macro semantic loss issue may force harder choices.** Week 1's heuristic detection ("flexDirection:row + paddingBottom>=24 + borderTopWidth>=1 + ≥2 button-role children = BottomNav") works for one macro. Extending the heuristic vocabulary to ListRow, ProductCard, etc. will be brittle. The Phase 2 sidecar approach may need to land sooner than Week 4.
- **Prompt-side issues will surface as runtime gaps.** The P2 PROMPT entries logged this week (icon-only labels, undocumented filled prop, strict-list validation) are about to matter. Runtime can patch around some, but iteration-2 prompt work will land in Week 3 or 4 and the entries should be addressed there, not patched in the renderer.
- **Scope creep risk.** Week 3 has the most "wouldn't it be nice if…" pull (animations, transitions, scroll-restore). Stay strict on the day-by-day plan. Backlog over implement.

**Mood:** confident. Technical debt is low — every fix this week was additive, not corrective. Scope is healthy — Week 2's "make every component type render" is fully delivered. Week 3 is the inflection point: until now we've been hardening static rendering; from Day 1 of Week 3 onward we're building interactivity, which is fundamentally different and where most preview tools fail.

---

## Week 3 — Scroll, navigation, onPress, real interactivity (22-28 hours)

### Week 3 prep notes (added 2026-05-01 at Week 2 close)

**Goal recap.** Make every `onPress` handler fire correctly, propagate navigation events for non-BottomNav clicks, handle deep-linking to specific screens, and decide what state (if any) the runtime retains across navigation. Scroll behavior is already solved (Week 2 Day 3) — the original Week 3 deliverable list overlaps Week 2's actual outcome and should be re-scoped to focus on interactivity.

**Backlog items from Week 2 to address before/during Week 3:**
- `[P2, ARCHITECTURE]` Stored trees lost macro semantic structure — Week 1's heuristic BottomNav detection works for one macro; extending it to ListRow / ProductCard / etc. will get brittle fast. Either lift this to Phase 2 (sidecar `_macros` field on stored trees) before Week 3 starts piling on click handlers, or accept brittle heuristics for Week 3 and revisit at Week 4 start. Recommendation: revisit on Week 3 Day 1 — if the click-routing design wants macro context, fix it then; if not, defer.
- `[P2, PROMPT]` BottomNav icon-only tabs — AI emits some BottomNav tabs without Text labels, breaking icon-name → screen-name fuzzy matching. Iteration-2 prompt fix is one line ("every BottomNav tab MUST have a Text label child"). High impact on Week 3's nav reliability. Bundle with the other iteration-2 prompt entries when that cycle runs.

**Open architectural questions to resolve early in Week 3:**

1. **Where does click-event detection live for non-BottomNav clicks?** Today (Week 1 Day 4): BottomNav tab clicks are detected iframe-side via an `onClickCapture` wrapper around `<ScreenRenderer>`, with a heuristic that walks up from the clicked element looking for a tab-row ancestor. This works for BottomNav because the row pattern is stable. For arbitrary `TouchableOpacity` → `onPress` → navigate flows, the same iframe-side capture pattern can extend, but the heuristic needs a different signal (a child Text label? a `flowConnections` lookup keyed by clickable text?). **Question to answer Day 1**: extend the iframe-side onClickCapture wrapper, or introduce a new abstraction (e.g. each TouchableOpacity gets a stable `data-mokkoi-id` from a tree-walk pass, click handler maps id → action)? The second is more work but degrades less when AI generates unusual structures.

2. **How are non-BottomNav clicks routed to navigation?** `findNavigationTarget` in [src/utils/previewNavigation.ts](src/utils/previewNavigation.ts) already handles label → screen lookup via the project's `connections` JSONB plus a fuzzy screen-name fallback. Week 3 should reuse this, not build a new lookup. The open question is *what label* gets passed in: the clicked element's nearest Text descendant? A `data-action` attribute injected during a pre-pass? Decide before Day 2.

3. **State retention across navigation.** When user navigates A → B → A, what does the runtime remember? Options:
   - **Nothing** — every screen mount is fresh, scroll position resets to top, form input clears, switch state resets. This is what happens today by default (Week 2 Day 4 verified for Switch). Simple, predictable, matches what most preview tools do.
   - **Per-screen scroll position** — feels native, low complexity (one map keyed by screenId).
   - **Per-screen form input** — feels native but blurs the line between "preview" and "real form." Probably overkill for runtime POC; defer to Phase 2.
   - **Decide explicitly Day 1.** Drift is the enemy. The Week 2 Day 4 retro called out "scroll position retention is Week 3" — that's the prompt. Pick "scroll only" and commit, or pick "nothing" and commit. Don't accidentally implement it via inattention.

**Scope health check.** Week 3 has the highest "wouldn't it be nice if…" pull of any week. Animations, transitions, swipe-to-go-back, modal presentation, keyboard show/hide — all tempting, all out of scope. The Week 2 audit→gap→approve rhythm worked because gaps were small and bounded. Week 3 gaps will be larger; the rhythm needs to hold harder. If a Day 1 audit surfaces 3+ P1 items, that's a sign the Week 3 plan is over-scoped — cut, don't extend.

### Goal
The runtime renders an *interactive* app. Tabs switch screens. Buttons fire. Scroll feels native.

### Concrete deliverables
- `RuntimeRenderer` handles `Pressable` with working `onPress` wired to runtime navigation.
- Protocol extended for multi-screen render: `{type: "render", screens, activeScreenId, connections}`.
- `runtime/Navigation.tsx` — in-runtime navigator (state-based, mirrors `usePreviewNavigation` logic).
- Two-way nav sync: parent's chat-panel tabs and iframe's bottom-tab bar stay in sync.

### "Done" criterion
Render the fitness app, tap "Workouts" in the bottom tab bar — preview swaps to Workouts screen. Tap "Upper Body Strength" list row — if planner connected it, navigate to Workout Detail. Scroll the Workouts list — smooth, native scroll feel. Mokkoi's chat panel tabs reflect in-iframe navigation.

### Validation checkpoint
**End of Day 3.** Tabs work in iframe AND chat panel reflects it. If two-way sync ping-pongs (similar bug to the Phase 2 PreviewPhoneFrame issue), pause and fix the sync architecture before proceeding.

### Hours estimate
22-28 hours.

### Tasks
- [x] **Day 1 (revised cadence, 2026-05-01) — Interactivity foundation.** Original Day 1 ("multi-screen protocol") was already delivered Week 1 (parent owns nav state, iframe posts back via `mokkoi:nav-click`). Re-scoped Day 1 to design + scaffold the click-handling architecture for non-BottomNav clicks. Audited current state: BottomNav done, every other TouchableOpacity inert. Resolved five architectural questions (decision log below). Generalised iframe-side click capture from BottomNav-only to a discriminated click protocol with classification, narrow-scope deferral for compound clickables, and visible toast feedback for unresolved clicks. Also surfaced a structural issue with the dev DB (kitchen-sink workspaces, not canonical apps) — bumped seed-archetype-test-apps backlog from P3 → P2.

  **Decision log (A-E):**

  **A. Click-event detection: single iframe-wrapper handler, extended.** Generalised `findClickedTab` → `classifyClickedElement` in `src/runtime/main.tsx`. Walks up to the innermost `[role="button"]` and emits a discriminated kind. Per-component capture would require touching ScreenRenderer (forbidden — shared with canvas) or a tree-walk pre-pass injecting `data-mokkoi-id` (more invasive). The wrapper-based pattern keeps the classification vocabulary in one file and matches the Week 1 "iframe stays dumb" decision (parent owns dispatch).

  **B. Click routing: 3-tier resolution + visible toast on unresolved.** (1) `findNavigationTarget(connections, screenId, label)` — canonical, planner-provided trigger. (2) `fuzzyMatchScreen(label, screens)` — covers Login button → LoginScreen even without an explicit connection. (3) No match → parent posts `mokkoi:click-unresolved` back to iframe → toast "No screen wired for '<label>'". Silent no-op was rejected: at demo time, every dead button reads as "the runtime is broken." A subtle "not wired" overlay reframes it as "needs wiring in the planner" — same information, different perception. Toast is debounced 300ms by label (mash-clicks don't chatter), latest replaces previous (no stack), 1.4s lifetime.

  **C. State retention: reset everything.** Already the de-facto behavior — uncontrolled inputs unmount with the tree, Switch local `useState` resets on remount (Week 2 Day 4). Picking "reset" is a no-cost commitment; "restore-scroll" would require parent-side `Map<screenId, scrollY>` + scroll observer + identity tracking. Standard preview-tool semantics (v0, Bolt, Replit Agent all reset). Cheaper to add restore later if real users complain than to remove it.

  **D. Message protocol: single `mokkoi:click` with `elementKind` discriminator.** Replaces narrowly-typed `mokkoi:nav-click` (BottomNav-specific). Shape: `{ type: 'mokkoi:click', elementKind: 'BottomNavTab' | 'Button' | 'IconButton', label, metadata? }`. Generic-with-discriminator scales: adding "FormSubmit" later is a new kind, no new listener, no new postMessage filter. One listener in `RuntimePoc.tsx` switching on `elementKind`. Deferred kinds don't post — they short-circuit at the iframe with the toast.

  **E. Heuristic detection scope: 3 kinds handled, everything else explicitly deferred.** `BottomNavTab` (existing row signature: `flexDirection:row` + `paddingBottom>=24` + `borderTopWidth>=1` + ≥2 button children). `Button` (exactly 1 non-icon Text descendant, not in BottomNav row, not in list-row). `IconButton` (0 Texts + 1 Material Symbols icon). Everything else → `Deferred` with subreason: `list-row` (parent has ≥2 sibling role=button, column layout, median sibling subtree ≥5 descendants), `compound` (≥2 Text descendants), `no-label` (no extractable label). FlatList style-signature ancestor matching (`display:flex` + `flexDirection:column` + `flexGrow:'0'` + `flexShrink:'0'`) was tried first but over-matched: many AI-generated screens use FlatList as the *page* layout, which deferred every button on the page including header `See All` links. Removed in favor of the structural sibling rule alone — the rule keys on local repetition, which is what list-row-ness actually is.

  **The narrowing decision (defer compound clickables to Phase 2).** The FlowConnection model is structurally label-keyed (`{from, to, trigger}` where trigger is a string). Label-based routing works cleanly when one clickable has one canonical label that the planner could plausibly attach to a connection — true for action buttons, BottomNav tabs, header chevrons, "View All" links. Structurally false for cards (visible text is data, not action — planner doesn't attach trigger="iPhone 15 Pro" to a connection) and for list rows (per-item navigation needs the row's data id, not a label). The right fix is server-side `_macros` sidecar preservation (Phase 2 architecture). Spending 3 days in Week 3 on largest-text-wins / first-text-wins heuristics produces brittle code that the macros work will replace anyway. **Cost we're accepting:** at demo time, cards and list rows in production apps are inert (toast-and-no-op). Mitigated by toast UX framing it as "needs wiring" rather than "broken runtime."

  **Demo-flow survey finding (16 screens across all 4 dev-DB projects).** Roughly 75-80% of sampled clickables classify as routable kinds (Button / IconButton / BottomNavTab); 20-25% as Deferred (mostly compound, rarely list-row). Cards are the dominant Deferred case. Critically, in screens that resemble onboarding flows (goal-selection cards) or category-pickers (food-delivery cards, plant-selling cards, fitness workout cards), cards are the *primary* user choice — narrow-scope ships those visibly inert with toast fallback. List-row pattern was rare in sampled screens (none triggered `Deferred:list-row` — AI tends to wrap repeating content in compound TouchableOpacity-with-many-Texts rather than as siblings under a parent column). Toast UX makes this honest at demo time but doesn't make the screens functional. Phase 2 macro-metadata work is the dominant Phase 2 deliverable for full coverage.

  **Parked for Day 2-3 evaluation, not landed today: opportunistic FlowConnection lookup for `Deferred:compound`.** A compound clickable with `extractLabel="Lose Weight"` could try `findNavigationTarget(connections, screenId, "Lose Weight")` opportunistically before deferring. Risk: planner has to know to attach trigger="Lose Weight" to the connection, which it may not — and a wrong fuzzy match (card title fuzzy-matches an unrelated connection trigger) is worse than honest deferral. Will evaluate Day 2-3 with observed behavior on more screens.

  **Implementation:** [src/runtime/main.tsx](src/runtime/main.tsx) — generalised classifier, toast component, debounced toast queue, new protocol shape. [src/pages/RuntimePoc.tsx](src/pages/RuntimePoc.tsx) — listener handles `mokkoi:click` with kind switch, posts `mokkoi:click-unresolved` back when neither FlowConnection nor fuzzy match resolves. [public/runtime/index.html](public/runtime/index.html) — added `@keyframes mokkoi-toast-fade`. ScreenRenderer untouched. Verified live: BottomNav nav unchanged; `See All` correctly classifies as Button → no FlowConnection → toast fires; mash-click debounce confirmed; structural list-row rule correctly classifies "See All" inside a FlatList-as-page-layout (the bug found and fixed during verification).
- [x] **Day 2 (revised cadence, 2026-05-01) — Classifier hardening.** Original Day 2 ("Pressable onPress + flow connection wiring") was already delivered as part of Day 1's interactivity foundation — the click protocol routes Button/IconButton/BottomNavTab through `findNavigationTarget` + fuzzy fallback, and Day 1's narrowing decision explicitly defers compound clickables to Phase 2. Re-scoped Day 2 to: harden the classifier and observability so Days 3-5 don't trip on the foundation. Audited Day 1's parked items, surfaced two material findings, shipped polish-only changes.

  **Phantom-bug discovery on Day 1's "empty-label Button" entry.** Day 1 verification claimed 8 of 9 buttons on the Velox Audio product screen classified as `Button(empty-label)` (color-swatch buttons rendered as empty wrappers). Day 2 re-verification by triggering real clicks and capturing the iframe console showed every one of those cases is correctly classified as `IconButton` by the production code. Root cause: my Day 1 audit harness ran in the parent window context examining iframe DOM nodes, where `cur instanceof HTMLElement` resolves against the *parent* window's `HTMLElement` constructor and returns false for elements from the iframe's window. The harness's `countText` therefore never recognized `.material-symbols-outlined` ancestors and counted icon glyph names as label text. The runtime classifier itself runs *inside* the iframe (correct `instanceof` resolution) and works correctly. **Withdrew the Day 1 backlog entry** with a phantom-bug annotation rather than silently deleting it — future-me should see this in the decision log so I don't relitigate "should we add the Deferred:no-label refinement?" The runtime classifier is more solid than Day 1 indicated.

  **FlowConnection canonical routing is dead code at runtime today.** Inspected actual `projects.connections` Supabase responses across all 4 dev DB projects. Project 1 (fitness, kitchen-sink): 4 connections, **0 with `trigger` field set**. Projects 2/3/4: empty `connections` arrays entirely. Across the entire dev DB, `findNavigationTarget` returns null 100% of the time — every routing success since Week 1 Day 4 has gone through `fuzzyMatchScreen`. This drove **decision B (skip opportunistic compound-card lookup)**: the only "opportunistic" path remaining without trigger data is fuzzy match on card primary text against screen names, which is exactly the wrong-match risk we wanted to avoid ("Lose Weight" card → "Weight Lifting Plan" screen via substring match). Honest deferral via toast is correct. Logged as `[P2, ARCHITECTURE]` for strategic consideration outside the runtime work — the fix is one of: make canvas FlowConnection drawing more prominent / automatic; lean harder on fuzzy matching as canonical; or pull Phase 2 macro-metadata preservation forward (planner emits macros with `targetScreenId` baked in, FlowConnections become unnecessary).

  **Static → dynamic toast positioning pivot.** Day 1's toast at `bottom: 24` overlapped the BottomNav by 22px on the fitness Home screen. Initial fix was a static `bottom: 100` (clears typical 86px BottomNav with margin). Verification on the same screen showed the static offset was *still* overlapping by 26px — production BottomNav heights vary up to 120px (paddingBottom + content + safe-area inset combined). Switched to dynamic measurement: `computeToastBottom()` walks the iframe DOM for the BottomNav row signature (same `flexDirection:row + paddingBottom>=24 + borderTopWidth>=1 + ≥2 button children` predicate as `isBottomNavRow`) and computes `viewportH - bottomNavTop + 16` per render, falling back to 24 when no BottomNav is present. ~10 line cost, robust across the production height range. Verified clearing on a 86-tall BottomNav (10px gap) and falling back to 18px-from-bottom on a no-BottomNav product screen.

  **Diagnostic log structure.** Standardized prefix `[mokkoi-click]` covers iframe + parent; structured field shape `kind=X label='Y' tried=<list> matched=<source>:<id|none>` makes the FlowConnection-dead-code finding visible at scrub time on every miss. Resolution success and failure use the same shape — only `matched` differs. Sample line: `[mokkoi-click] parent → kind=BottomNavTab label='nutrition' tried=flowConnection,fuzzyName matched=fuzzyName:ef4f8f9f-...`.

  **Two new backlog entries from Day 2 audit:**
  - `[P2, ARCHITECTURE]` FlowConnection canonical routing is dead code in production (above).
  - `[P3, RUNTIME]` Single-text data-as-label classifies as Button. TouchableOpacity wrappers around data text (person names like "Nora Ward", transaction amounts, message previews) classify as `Button` because they have exactly one Text descendant. Toast says "No screen wired for 'Nora Ward'" — misleading because the data was never supposed to be wired. Same Phase 2 macro-metadata root cause as compound. Toast is honest about lack of wiring, just framed awkwardly.

  **Implementation:** [src/runtime/main.tsx](src/runtime/main.tsx) — log prefix rename, iframe-side log restructure, `computeToastBottom()` helper. [src/pages/RuntimePoc.tsx](src/pages/RuntimePoc.tsx) — parent-side log restructure with `tried=` and `matched=` fields. ScreenRenderer untouched. No new code paths.
- [ ] ~~**Day 2 (original) — Pressable onPress.**~~ Delivered Week 3 Day 1 as part of the interactivity foundation. Click protocol routes Button/IconButton/BottomNavTab through `findNavigationTarget` + fuzzy fallback; compound clickables deferred to Phase 2 per Day 1 narrowing decision. Box left struck-through to preserve the original plan history.
- [x] **Day 3 (revised cadence, 2026-05-01) — Wrap Week 3 + Week 4 production swap design.** Strategic pivot day, not feature build. Days 1-2 surfaced the architectural ceiling on Phase 1 interactivity (FlowConnection canonical routing is empirically dead in dev DB; cards/list-rows make up most production primary nav and require macro metadata to resolve cleanly). The choice today: ship Days 4-5 as more heuristic patches that Phase 2 work would replace anyway, OR wrap Week 3 short and start Week 4 (production swap) early. Chose the second — don't ship temporary fixes when the time can buy production-readiness instead. Audited the production preview path (`InlineSnackPreview` overlaying `PreviewPhoneFrame` on the canvas; Snack hosted runtime times out in 15s and has been falling back to static for users); designed the Week 4 swap (decisions A-G in the Week 4 section below). Findings that reshaped Week 4 scope: theme propagation is a non-issue (theme is generation-time hint baked into per-component inline styles, not runtime tokens — saves ~half a day); existing `ErrorBoundary` component is already production-quality, just needs wiring inside the iframe; the dual-mount feature-flag pattern is already proven in the codebase (`InlineSnackPreview` overlays static fallback). New backlog entry: `[P2, INFRA]` runtime preview telemetry — blocker for Week 5 flag-flip to default-ON, not for Week 4 ship-behind-flag.
- [ ] ~~**Day 3 (original) — Two-way sync.**~~ Deferred. The original "iframe ↔ chat panel tab" two-way sync presupposes a chat-panel-tab UI that the canvas does not currently expose. The behavior pattern (parent owns nav state, iframe posts back) is already in place from Day 1; if the chat panel grows tab UI later, the protocol handles it without changes. Box left struck-through to preserve original-plan history.
- [ ] ~~**Day 4 (original) — Scroll polish.**~~ Deferred. Scroll behavior verified Week 2 Day 3 (the `mokkoi-screen-scroll` two-div pattern in ScreenRenderer). No production complaints surfaced.
- [ ] ~~**Day 5 (original) — Pressable feedback.**~~ Delivered Week 2 Day 5 (`.mokkoi-touchable:active { opacity: 0.7 }` global rule).

### Risks for this week
- ~~Pressable-inside-ScrollView tap-vs-scroll detection edge case~~ — not surfaced in production trees this week. Defer.
- ~~Two-way sync ping-pong~~ — chat-panel-tab UI doesn't exist; sync work deferred.
- Flow connections without explicit triggers — empirically confirmed: **all** dev-DB connections lack triggers. Logged as `[P2, ARCHITECTURE]` Day 2.

### Retrospective (filled 2026-05-01)

**Did the Done criterion land?** The original Done criterion ("Render the fitness app, tap 'Workouts' in bottom tab bar — preview swaps to Workouts screen. Tap 'Upper Body Strength' list row — if planner connected it, navigate to Workout Detail. Scroll the Workouts list — smooth, native scroll feel.") landed *partially*. BottomNav nav works (Week 1 Day 4, verified again Day 1-2). Scroll feels native (Week 2 Day 3). But "tap a list row → navigate" did not land — the audit revealed list rows can't route under the FlowConnection model because data-bound text isn't a stable trigger label. Honest accounting: the Done criterion was written before we understood that list-row routing requires macro metadata Phase 2 will preserve.

**What shipped (Days 1-3):**
- **Day 1** — Interactivity foundation. Generic `mokkoi:click` protocol with `elementKind` discriminator, classifier for BottomNavTab/Button/IconButton/Deferred(list-row|compound|no-label), 3-tier resolution (FlowConnection → fuzzy screen-name → toast), iframe-side debounced toast UX. Narrow scope explicitly accepted: cards and list rows defer to Phase 2.
- **Day 2** — Classifier hardening. Dynamic toast positioning (BottomNav heights vary up to 120px in production; static offsets failed). Structured single-prefix log shape `[mokkoi-click] kind=X label='Y' tried=<list> matched=<source>:<id|none>`. Phantom-bug withdrawal: Day 1's "empty-label Button" finding was a cross-window `instanceof HTMLElement` bug in my audit harness, not a runtime issue — withdrew the backlog entry with the rationale annotated rather than silently deleting.
- **Day 3** — Strategic wrap + Week 4 production-swap design.

**What didn't ship (Days 4-5 collapsed into Day 3):**
- List-row interactivity — deferred to Phase 2 macro metadata.
- Form submission detection — deferred (no real backend wired; protocol shape ready).
- Cards / compound-clickable routing — deferred to Phase 2 macro metadata.
- Two-way iframe ↔ chat-panel-tab sync — deferred (chat panel doesn't expose tab UI).

**Architectural decisions made this week:**
- Generic `mokkoi:click` protocol with `elementKind` discriminator (extensible without listener proliferation).
- Single iframe-wrapper click handler (consistent with Week 1's "iframe stays dumb" decision; ScreenRenderer untouched per the shared-with-canvas hard rule).
- 3-tier resolution: FlowConnection → fuzzy screen-name → visible "no screen wired" toast.
- Reset-on-navigation for state retention (Phase 1 simplicity; React unmount/remount on tree-shape change resets state naturally).
- Heuristic detection scoped narrowly to label-routable kinds (BottomNavTab, Button, IconButton). Compound clickables and list rows are explicitly deferred — toast UX makes this honest at demo time.
- **Phase 1 ceiling explicitly accepted**: cards and list rows cannot route under the FlowConnection model because they lack a 1:1 label-to-trigger mapping. The right fix is server-side macro-metadata preservation (Phase 2). Heuristic patches (largest-text-wins, first-text-wins) produce brittle code that Phase 2 work replaces.

**Critical findings:**
- **FlowConnection canonical routing is empirically dead in dev DB.** Across all 4 projects, `findNavigationTarget` returns null 100% of the time. Every routing success has gone through `fuzzyMatchScreen`. Logged as `[P2, ARCHITECTURE]` Day 2 — strategic options: lean harder on fuzzy, make canvas FlowConnection drawing more prominent/automatic, or pull Phase 2 macro-metadata forward.
- **Phantom-bug discovery** on the Day 1 "empty-label Button" entry. Audit-harness ran in parent window context; `instanceof HTMLElement` failed cross-window; counted icon glyph names as label text. Runtime classifier itself was always correct. Withdrew the entry with a phantom-bug annotation — leaving it standing would have misled future-me.
- **Most production screens have card-driven primary nav.** The Day 1 demo-flow survey across all 4 projects found cards and compound clickables on roughly half of sampled screens, with cards as the *primary* user choice in onboarding goal-selection, food-delivery category pickers, fitness workout selection, and similar. Phase 1 narrow scope means demo screens have visibly inert primary content with toast fallback. Honest at demo time, but doesn't make those screens functional.
- **Production preview path has been falling back to static for users.** `InlineSnackPreview`'s 15-second Snack-runtime boot timeout exceeds budget consistently. The static `PreviewPhoneFrame` (which uses `ScreenRenderer` directly — same renderer the runtime POC iframe uses) is what users actually see today. The Week 4 production swap is replacing a non-functional component, not a working one.

**The strategic pivot — choosing to wrap Week 3 short:**

Days 1-2 surfaced the architectural ceiling. By end of Day 2, the question on the table for Days 3-5 was: ship more heuristic patches (largest-text card routing, list-row data-binding hacks, etc.) that improve the surface but don't change the underlying limitation, OR wrap Week 3 short and start Week 4 production swap early?

Chose to wrap. Rationale: don't ship temporary fixes when Phase 2 architecture solves the same problems cleanly later, and use the freed time for production-readiness work that genuinely matters — the broken Snack preview is what real users see today. Future-me dogfooding the runtime in Week 5 will value "production swap landed solid" more than "we shipped a card-routing heuristic that the macros work eventually replaced anyway."

**Original plan assumed production-live by Week 4 end. Day 3 audit reveals reality:** Week 4 ships runtime production-ready behind a localStorage feature flag, dev burn-in for ~1 week, then deliberate flag-flip in Week 5 contingent on dogfood signal. mokkoi.com users see the runtime in **Week 5, not Week 4**. This is the right phasing for risk control but worth being explicit so future-me doesn't read "Week 4 ships" as "live for users." The flag-flip in Week 5 is a deliberate go/no-go gated on telemetry (which has its own backlog entry as a blocker for that flip).

**What's working well:**
- The audit → gap → approve → implement → verify rhythm caught the FlowConnection-dead-code finding empirically rather than after a week of building on a wrong assumption.
- Backlog discipline — the week ended with multiple entries withdrawn or reframed (empty-label Button withdrawn as phantom; canonical seed apps bumped P3→P2; FlowConnection-dead-code added as P2 ARCHITECTURE; data-as-label and telemetry added). Honest documentation of architectural debt.
- Verification that surfaces real findings vs. papering over. Day 1 verification caught the Signal 2 over-match in the list-row heuristic before commit. Day 2 verification caught the static-toast-still-overlaps-BottomNav issue before commit (forced the dynamic measurement pivot).
- Strategic willingness to redraw the day-by-day plan based on what work actually surfaces. Days 1, 2, and 3 all re-scoped from the original plan.

**What to watch in Week 4:**
- Production swap is high-stakes — even behind a flag, regressions in `App.tsx` (where the runtime mounts) could break the canvas for users.
- Auth integration "inherits from canvas" is the elegant path, but if the iframe somehow loses its same-origin cookie context (cross-origin cookie blocking, sandbox attribute drift), RLS reads silently fail and the iframe shows empty. Verify with a real signed-in dev account.
- Theme propagation was confirmed as a non-issue, but the conclusion came from one search pass — if a theme system surfaces during Week 4 implementation, scope grows. Soft conclusion to recheck.
- Error boundary needs *real* testing — force malformed trees (missing `type`, undefined `children`, circular references), partial fetch failures, RLS-denied responses. Not just "it looks fine in dev."
- Streaming postMessage cost is a real perf concern. Day 4 has a fork: throttle posts inside the iframe, or fall back to in-process `PreviewPhoneFrame` during `isStreaming` and only swap to iframe at stream-complete. Decide with measurement, not feel.

---

## Week 4 — Production swap (runtime replaces InlineSnackPreview behind a flag) (16-22 hours)

> **Note (designed 2026-05-01, Week 3 Day 3).** This plan replaces the original Week 4 plan ("Theme, error boundaries, static-renderer handoff") which was written before the Days 1-2 audit findings reshaped scope. Theme propagation is confirmed as a non-issue (theme is a generation-time AI hint baked into per-component inline styles — there is no runtime token system to propagate). Migration sanity-check across "257 existing Supabase trees" was based on a count that no longer matches dev DB reality (mostly kitchen-sink demo screens, not coherent multi-screen apps). The new plan is scoped to actually-needed work for the production swap, with explicit phasing: **Week 4 ships behind a localStorage flag, Week 5 contains the deliberate flag-flip decision** based on dev burn-in signal and telemetry.

### Goal
Replace `InlineSnackPreview` with an iframe-based runtime preview that uses the existing `ScreenRenderer` + Week 1-3 click protocol. Ship behind a localStorage feature flag, with `PreviewPhoneFrame` as the no-flag default (zero behavior change for users who don't opt in). Land the building blocks for the Week 5 flag-flip: error boundary wired, dev-only chrome stripped, streaming integration measured.

### Concrete deliverables
- `src/components/RuntimeIframePreview.tsx` — drop-in replacement shape for `InlineSnackPreview`. Overlays `PreviewPhoneFrame` (same overlay-on-fallback architecture). Reads localStorage flag `mokkoi.runtime.iframePreview`.
- Error boundary wired around `<ScreenRenderer>` inside the iframe (using existing `src/components/ErrorBoundary.tsx`, no new component).
- Light tree-validation pass before render (`validateTree(tree)` — fast object-shape check).
- Streaming integration: throttled `mokkoi:render-tree` posts during `ai.isStreaming` (or fall back to `PreviewPhoneFrame` during streaming, decision point Day 4).
- Dev-only diagnostic logs gated behind `import.meta.env.DEV`.
- Existing `InlineSnackPreview` and `snack-sdk` dep **kept** through Week 4. Deletion is Week 5.

### "Done" criterion
With `localStorage.setItem('mokkoi.runtime.iframePreview', '1')` set, open `/app/:projectId` on a real signed-in dev account. The right-pane preview shows the iframe runtime with the active screen rendered, BottomNav clicks navigate, button clicks toast or route, malformed trees show the ErrorBoundary fallback (force one to verify), generation streaming UX is no worse than current static `PreviewPhoneFrame`. Without the flag, behavior is byte-identical to today's canvas.

### Validation checkpoint
**End of Day 4.** Real signed-in dev account, real production project from `mokkoi.com`, flag enabled. Generate a fresh app from a prompt, watch streaming, navigate via BottomNav, click a button, force a malformed tree. If first-paint is >500ms or streaming is visibly jankier than today's `PreviewPhoneFrame`, fork to "use PreviewPhoneFrame during streaming, swap to iframe at stream-complete" and re-verify. Telemetry backlog item gates the Week 5 flag-flip — does **not** gate Week 4 ship.

### Hours estimate
16-22 hours.

### Architectural decisions log (made 2026-05-01, Week 3 Day 3)

**A. URL routing — replace InlineSnackPreview in-place.** New `<RuntimeIframePreview>` component lives at `src/App.tsx:588`'s position in the tree. Iframe still served from `public/runtime/index.html`. No new top-level route. Public-share path (`/preview/:projectId/:screenId` → `PreviewPage` → direct ScreenRenderer) keeps current behavior — that wasn't broken, don't expand scope.

**B. Auth integration — inherit from canvas.** Iframe is a child of authenticated `<App />`; same-origin → same supabase session → same RLS. Iframe knows nothing about auth. **Skip Supabase fetch from runtime entirely** — parent has `projectId`, `activeScreenId`, `screens.connections`, the active tree all in canvas memory; post directly via `mokkoi:render-tree` plus a new `mokkoi:set-connections` (or fold connections into the render-tree message).

**C. UI cleanup from POC** — remove project/screen dropdowns, status indicator, URL param sync, RuntimePhoneFrame chassis (canvas owns the chassis via `PreviewPhoneFrame` underneath). Keep dev-only logs gated behind `import.meta.env.DEV`. Reuse canvas's existing device + zoom state (`screens.projectDeviceId`, `previewManualZoom`).

**D. Theme propagation — nothing to do.** Confirmed by reading [api/_lib/design-system.ts](api/_lib/design-system.ts): theme is a generation-time hint that bakes into per-component inline `style.backgroundColor`/`style.color`. No runtime theme system exists. Trees carry their own theme. This frees ~half a day of original Week 4 scope.

**E. Error boundaries — wire existing `<ErrorBoundary>` inside iframe + light tree validation.** No new ErrorBoundary component (the existing one in `src/components/ErrorBoundary.tsx` is already production-quality). Light pre-render `validateTree()` (object shape, type field, children-is-array) catches the most common malformed-tree case before ScreenRenderer even runs. Component-level isolation (per-recursion boundaries) deferred to backlog — over-engineering until we see real production crashes; would also require touching ScreenRenderer (forbidden under shared-with-canvas hard rule).

**F. Replacing InlineSnackPreview — feature flag + dual-mount + delayed retirement.** localStorage `mokkoi_runtime_iframe_preview = '1'` enables runtime, default disabled. (Flag name corrected to snake_case Week 4 Day 1 to match codebase convention — `mokkoi_theme_preference` etc. The original dotted name in this section was written before checking the existing pattern.) Both components mounted in App.tsx but mutually exclusive based on flag. Week 4 ships flag-off-by-default. Week 5 contains the deliberate flag-flip decision (see Day 5 below). Snack deletion is Week 5 contingent on flag flipped + clean dogfood + telemetry.

**G. Performance baseline.** First useful paint ≤500ms after parent has the tree. Subsequent posts ≤50ms incremental. Iframe boots once-per-canvas-session (don't unmount on screen change). Streaming posts throttled to one every 250ms; final post on stream-complete always fires. Day 4 measures and forks: throttled-iframe vs. PreviewPhoneFrame-during-streaming.

### Tasks

- [x] **Day 1 (2026-05-01) — `<RuntimeIframePreview>` component + flag plumbing.** Built `src/components/RuntimeIframePreview.tsx` as drop-in replacement shape for `<InlineSnackPreview>` (same overlay contract, same scaling math, iframe src points at `/runtime/index.html`). Wired `src/App.tsx:588` IIFE that picks between InlineSnackPreview (default) and RuntimeIframePreview based on `localStorage.getItem('mokkoi_runtime_iframe_preview') === '1'`. Tree posted from canvas memory (`screens.generatedScreens` + `activeGeneratedId`), no Supabase round-trip. Click routing replicates RuntimePoc's three-tier resolution (FlowConnection → fuzzy name → unresolved postback). Flag name corrected from plan-spec `mokkoi.runtime.iframePreview` to snake_case `mokkoi_runtime_iframe_preview` to match codebase convention. Commits `d9bb38f` (component) + `679c1b5` (App.tsx integration). Verification was static-only (typecheck + diff inspection + /runtime-poc smoke) — live Pass A/B testing blocked by local browser/auth redirect friction (filed as P3 INFRA backlog). Real flag-OFF/flag-ON verification shifts to Day 2 as part of error-boundary work, which organically requires flag-ON. Acceptable trade because flag defaults OFF — production canvas users are unaffected until the deliberate Week 5 flip.
  - Acceptance: with flag set, iframe loads and renders the active screen of any real project. Without flag, App.tsx behavior is byte-identical to today. **Static-equivalence confirmed by code-read; runtime equivalence to be confirmed Day 2.**

- [ ] **Day 2 — Error boundary + tree validation.** Wrap `<ScreenRenderer>` in `<ErrorBoundary fallbackMessage="Couldn't render this screen">` inside the iframe. Add `validateTree()` defensive pass — fast object-shape check, fails fast with a structured warning instead of a render crash.
  - Acceptance: force-feed a malformed tree (missing `type`, undefined `children`, circular reference) → fallback UI shows inside iframe, click-routing still works to navigate away. Rest of runtime unaffected.

- [x] **Day 3 — Production UI cleanup.** Audit found `RuntimeIframePreview` was already structurally clean from Day 1 (no project/screen dropdowns, no status indicator, no URL param sync, no RuntimePhoneFrame chassis — it's a drop-in shape for `InlineSnackPreview`). Only remaining work was console gating: 4 per-click `console.log/warn` calls wrapped in `if (import.meta.env.DEV)`. Two low-volume signals deliberately left ungated: once-per-boot `[runtime-preview] runtime ready` (useful for "did the iframe boot for this user" production debugging) and the `expandComponents` `console.error` (real error path, future telemetry hook). Mirrors `InlineSnackPreview`'s gate-noisy-stuff/keep-signals-visible precedent. Net 4 line edits.
  - Acceptance: in flag-on production build, dev tools console is quiet on click; iframe renders only screen content with no debug chrome. **Met** — Pass A flag-OFF and Pass B flag-ON both verified clean (no double chrome, BottomNav routes, fuzzyName matches resolve, unresolved labels produce toast, no layout regressions).

- [~] **Day 4 — DEFERRED (2026-05-02).** Audit at session-start found `RuntimeIframePreview` is consumed in `App.tsx` with `disabled={isGenerating || isStreaming}` — the iframe is fully gated off while the AI streams, with `PreviewPhoneFrame`'s static fallback shown instead. The original Day 4 plan (throttle `mokkoi:render-tree` posts to one every 250ms during streaming) presupposed a live iframe receiving posts during stream. There isn't one. Throttling has no surface to apply to. Re-scoping into a real product win — drop the `disabled` gate during streaming, surface `useAIGeneration`'s `partialTree` as it accretes, and add the throttle layer so users watch the screen materialize live (Bolt/Lovable UX) — is a multi-day product decision, not a perf tweak. Filed as `[P2, RUNTIME]` "Live iframe during streaming with progressive tree updates" in BACKLOG. Today's session pivoted to backlog cleanup (Stripe URL env-fix, `fuzzyMatchScreen` dedupe, this docs pass) instead. **Future-you note:** when picking Day 4 back up, the design question is partial-tree validation tolerance (does `validateTree` need a softer in-progress mode?) and partial-render error tolerance (does ErrorBoundary need a different fallback during streaming so transient render failures don't flash a "Couldn't render this screen" mid-stream?). Not a 1-day task.

- [ ] **Day 5 — Week 4 wrap + Week 5 prep.** Re-scoped after Day 4 deferral. Originally "decision point: dev burn-in start, flag-flip plan, telemetry hook design"; that scope still applies but loses the streaming-specific signal. Tasks: (a) capture Week 4 retrospective fields below with what's known, (b) write decision criteria for the Week 5 flag-flip given current burn-in data (no `ErrorBoundary` catches surfaced, no click-routing surprises in Days 1-3 dogfooding, perf signal still unmeasured), (c) scope the `[P2, INFRA]` runtime-preview-telemetry backlog item into Week 5 Day 1 work, (d) decide whether the live-iframe-during-streaming P2 (Day 4 successor) should be the headline Week 5 effort (real user-visible win, multi-day) versus polish + telemetry-first (safer cutover path). Acceptance unchanged: written decision criteria for the flag-flip exist in this plan / commit message. Dev team uses flag-on as their default for Week 4 → Week-5-Day-1 burn-in.

### Risks for this week

- **Streaming UX regression** is the highest risk. Day 4 has a measured fork; don't let "throttled posts" feel like the right answer if measurement says PreviewPhoneFrame-during-streaming is visibly better.
- **Auth inheritance silent failure.** If somehow the iframe loses same-origin cookie context (sandbox drift, cross-origin policy change), RLS reads silently fail and the iframe shows empty. Verify Day 1 with a real signed-in account, not just dev mode.
- **App.tsx mount-order regressions.** Adding a new conditional overlay alongside InlineSnackPreview could cause subtle React state issues (effect cleanup ordering, ref attachment timing). Defensive: only one of the two overlays mounts at any time based on flag value, not both unconditionally.
- **Production deployment is NOT this week.** mokkoi.com still serves the existing canvas with InlineSnackPreview behind it. Week 4 is dev-burn-in only. The actual cutover (default-flag-flip) is a Week 5 decision contingent on signal and telemetry.
- **Theme-as-non-issue is a soft conclusion.** Re-confirm during Day 1 implementation; if a theme system surfaces (e.g. `<ThemeProvider>` wrapping ScreenRenderer somewhere not yet found), scope grows and this plan adjusts.
- **Telemetry gap blocks Week 5 flip, not Week 4 ship.** `[P2, INFRA]` runtime preview telemetry is the explicit blocker for the deliberate go/no-go in Week 5. Land the flag-on dogfood path in Week 4, the telemetry in Week 5 Day 1, the flip Week 5 Day 2-3 if signal is clean.

### Retrospective
- [ ] Did the Done criterion land (flag-on iframe runtime works on real production project for dev account)? Yes / No
- [ ] Day 4 fork: throttled-iframe-during-streaming OR PreviewPhoneFrame-during-streaming? Decision and measurement: _____________
- [ ] First-paint p50 latency: _____ ms
- [ ] Errors caught by ErrorBoundary during burn-in: _____ (count + brief description per type)
- [ ] Week 5 flag-flip decision criteria, written: Yes / No
- [ ] Time spent: _____ hours
- [ ] Adjustment for Week 5: _____________
- [ ] Bundle delta: -_____ KB gzipped
- [ ] Time spent: _____ hours
- [ ] Adjustment for Week 5: _____________

---

## Week 5 — Polish, performance, hot updates (16-20 hours)

### Goal
The runtime feels good. Demo-ready. v1.0 candidate.

### Concrete deliverables
- Hot-update path: tree edits don't re-mount the iframe.
- Performance budget enforced: 200-node tree renders in <100ms.
- Theme transitions (200ms) on dark/light toggle.
- Inspector dev tool (`?inspect=1` URL param).
- `runtime/README.md` documenting architecture, protocol, debugging.

### "Done" criterion
Generate a fitness app. Edit "Make it darker" via chat. Watch the runtime smoothly transition to a darker palette without re-mounting (current tab stays, scroll position retained). Tap a tab — instant. Scroll — buttery. Solo-founder happiness moment: it feels alive.

### Validation checkpoint
**End of Day 3.** Hot updates working without state loss. If naive React reconciliation breaks scroll/tab state on every edit, that's a polish failure — defer hot updates to v1.1, ship Week 5 without them.

### Hours estimate
16-20 hours.

### Tasks
- [ ] **Day 1 — Hot updates.** Replace full iframe re-mount with delta-render. Parent posts `{type: "render", tree}` on every change; iframe re-renders via React reconciliation.
- [ ] Test: edit Home screen, observe runtime updates without scroll reset.
- [ ] **Day 2 — Performance pass.** Profile a 200-node tree render. If >100ms, add memoization at macro-component level.
- [ ] Use React DevTools Profiler.
- [ ] Target: 95th-percentile render <100ms.
- [ ] **Day 3 — Theme transitions.** Add 200ms CSS transition on theme color changes.
- [ ] Test: toggle dark/light, observe smooth transition without flash.
- [ ] **VALIDATION CHECKPOINT** — hot updates + performance acceptable? If hot updates break state, defer to v1.1, ship without.
- [ ] **Day 4 — Dev tools.** Add `?inspect=1` URL param: overlays a tree-debug view, highlights nodes on hover, shows JSON for selected node.
- [ ] Make it dev-only (gate on `import.meta.env.DEV`).
- [ ] **Day 5 — Documentation.** Write `runtime/README.md`:
  - Architecture diagram (parent → iframe → RN-web)
  - Protocol message types
  - How to add a new component type
  - How to debug iframe issues
  - Known limitations
- [ ] Update `docs/IMPLEMENTATION_PLAN.md` (this file) — mark project complete, link to runtime README.

### Risks for this week
- Hot-update reconciliation edge cases break state → defer to v1.1.
- Performance regressions from feature creep → keep this week tight, no new features.
- Documentation slips because "shipping" feels more urgent → document as you go on Day 4-5, not at the end.

### Retrospective
- [ ] Did the Done criterion land? Yes / No
- [ ] Hot updates work without state loss? Y / N
- [ ] Render 95p latency: _____ ms
- [ ] Time spent: _____ hours
- [ ] Project shipped? Y / N
- [ ] What's deferred to v1.1? _____________

---

## Abort conditions (cross-cutting)

These are signals to stop the project, not just adjust within it. Re-read this section at the end of every week.

**Stop and re-architect when:**
- You've made no measurable progress for 4+ consecutive days. "Measurable" means a deliverable shipped or a problem definitively solved, not "I learned something."
- You're applying a 5th fix to an issue you thought was fixed twice already. Yesterday's `snack-sdk` arc is the cautionary tale — Phase 2c through 2e was four fixes, and we kept going past the abort signal. Don't repeat.
- Two consecutive weeks fail their "Done" criterion. Once is debugging; twice is structural.
- A validation checkpoint fails and the documented fallback path is also blocked. (Example: Week 1 Day 2, RN-web doesn't scroll in iframe AND CSS isolation in main DOM also doesn't work. Both options exhausted = abort.)

**Push through when:**
- You've made measurable progress in the past 3 days.
- The architecture itself isn't in question; the issues are debugging-style.
- You're applying fix #1 or #2 to a known problem, not fix #5.

**Hard cutoff:** if total project time exceeds Week 7 calendar (5 weeks runtime + 2 weeks macro + 0 weeks slack), stop. Ship what works, defer the rest, take the L on full demo parity, revisit with what you learned. Solo founders need to be brutal about sunk cost.

---

## Things explicitly NOT in scope

These are deferred, deleted, or accepted as-is. Do not work on them during the 6-7 week project window.

- **Canvas editor view.** ~140 lines of `App.tsx` plus the entire pan/zoom/drag system in `useCanvasState`. Pause investment. Hide the toggle button or move it behind a power-user setting. Do not delete.
- **HTML import flow.** ~600 lines in `api/generate.ts:730-1330` (`HTML_IMPORT_SYSTEM_PROMPT` and surrounding pipeline). Hide behind a "Power tools" menu. Stop testing as a primary flow. Do not delete.
- **Image proxy fallback to LoremFlickr.** Simplify in `snackUrl.ts:54-91` — pick Pexels as the only source, drop loremflickr fallback.
- **Full 16-device dropdown list.** De-emphasize. Show 3 defaults (iPhone, Android, iPad) with "More devices" disclosure.
- **Mokkoi web UI design system pass.** Acknowledge the inline-styles/no-tokens situation; do not fix during this project. Dedicated project after the runtime ships.
- **MCP integration improvements.** Whatever exists, leave alone.
- **Stripe billing UI polish.** Functional is enough.
- **Team collaboration features.** Not v1.0.
- **Public sharing.** Not v1.0.
- **Variation generation refinements.** Not v1.0.
- **Screenshot-to-screen.** Not v1.0.
- **Inline preview with `snack-sdk`.** Officially abandoned. Code deleted in Week 4.

---

## Decision log

Record significant strategic decisions made during the project. Format: `[YYYY-MM-DD] Decision: ____. Reason: ____. Trade-off: ____.`

- `[2026-04-28]` Decision: Sequence macro work before runtime, not parallel. Reason: parallel split focus on solo founder; runtime against 92%-raw trees would expose AI's poor compositions. Trade-off: 1-2 week delay before runtime work begins.
- `[2026-04-28]` Decision: Custom react-native-web runtime in Mokkoi-controlled iframe (not snack-sdk, not Sandpack, not WebContainers). Reason: snack-sdk debugging in Phase 2 hit unexplainable runtime issues; RN-web is already installed and aliased; iframe gives clean isolation. Trade-off: 4-5 weeks of new infrastructure vs continuing to fix snack-sdk.
- `[2026-04-28]` Decision: Render JSON tree via tree-walk, do NOT compile arbitrary TSX in browser. Reason: Babel-standalone + module resolution + CSS pipeline is a 2-month rabbit hole. Trade-off: runtime can only render Mokkoi's macro-tree format, not user-edited inline TSX.
- `[2026-04-28]` Captured baseline: **1.9% average macro density** across 303 screens (2.3% across 249 real screens with ≥30 nodes). 87.1% of real screens have ZERO macros. The "before-photo" metric for Week 0 is far worse than the strategic memo's earlier 8% estimate (which was % of screens containing any one macro, not actual node-density). Day-3 rewrite target: 50%+ density.
- `[2026-04-28]` Day 1 finding: macro library has at least one real gap — `ListRow` doesn't accept a `Switch` trailing element, so settings-toggle rows can't legitimately use it. Add `ListRow` switch-trailing support as low-risk parallel improvement during Day 3-4 prompt work. Tracked as a Day 4 sub-task.
- `[2026-04-29]` Built eval harness; baseline captured from production data. Headline: 2.28% macro density (mean), 12.9% macro presence, 8.8% BottomNav adoption, 4% ListRow, 2.8% ChipSelector, 91.7% icon validity, 100% content realism. The 8% icon-invalidity rate directly explains the icons-as-text rendering bug. Day-3 rewrite target: ≥50% density, ≥80% BottomNav adoption, 100% icon validity.
- `[2026-04-29]` Verified: Day 1's Postgres `jsonb_path_query_array($.**.type)` was double-counting nodes (each node + once per parent enumeration). Density ratio is unaffected (numerator and denominator both 2x'd) but absolute node counts in `eval/snapshot-2026-04-28.json` are 2x reality. Harness's walkNodes count is correct. Snapshot file kept as-is for archival; harness output is authoritative going forward.
- `[2026-04-29]` Fresh-mode (30 controlled prompts) deferred until `ANTHROPIC_API_KEY` is available in `.env`. Harness is fully built and tested for prompt extraction; just needs the key. Snapshot baseline serves as the before-photo for Day 3 iteration; first fresh run can establish the controlled-set baseline whenever convenient.
- `[2026-04-29]` Day 3 prompt rewrite v1 landed (three targeted edits per spec; no scope creep). Harness polished: inline `.env` loader bypasses the empty-shell-export issue, `--limit=N` flag for smoke testing, rolling token-budget throttle, empty-aggregate guards in headline/markdown renderers. **Fresh-mode evaluation blocked by dev key tier:** the `.env` `ANTHROPIC_API_KEY` is capped at 10K output-tokens/min, and Anthropic pre-charges `max_tokens` against that budget. Haiku 4.5's verbose output needs `max_tokens ≥ 20K` per generation call (production uses 32K); at `max_tokens=10K` every smoke-test app truncates mid-screen (3/3 fit-N attempts each fail with `stop_reason=max_tokens`); at `max_tokens > 10K` requests are rejected pre-flight with a 429 rate-limit error. Two paths forward: (a) higher-tier API key for the harness, (b) restructure generation to one screen per call. Both deferred. Day-3 prompt edits are committed on their analytical merits; v1 vs baseline numbers unmeasured for now.
- `[2026-04-30]` Harness refactored to one-screen-per-call generation (`eval/harness.mjs --mode=fresh-streamed`). Path (b) chosen over (a) because it's also the architecture Week 1 runtime will need (progressive screen rendering). New flow: planner call (`max_tokens=2000`) → N sequential per-screen calls (`max_tokens=5500`, ~3.5 chars/token), additive alongside the original `--mode=fresh`. Production code (`api/_lib/design-system.ts`, `api/generate.ts`, `api/generate-flow.ts`) untouched. Added: `stripFunctionLiterals()` to clean JS arrow/function values out of AI output before JSON parse, explicit "no function literals" rule in per-screen user prompt, post-call throttle adjustment from `max_tokens` reservation down to actual `usage.output_tokens` to free up budget. **Day 3 iteration 1 measured against baseline (snapshot, 249 prod screens): macro density 2.28% → 17.10% (Δ +14.8 pp, target ≥10% ✓), BottomNav adoption 8.8% → 86.3% (Δ +77.5 pp, target ≥40% ✓✓), icon validity 91.74% → 99.33% (Δ +7.6 pp, target ≥99% ✓), content realism 100% held. ListRow 4.0% → 23.6%, ChipSelector 2.8% → 35.2%, SectionHeader 6.8% → 50.0%, macro presence 12.9% → 97.3%.** Caveats: ~25% per-screen failure rate from output truncation on heavy data-viz screens (Progress, History) at the 5500-token cap; mean nodes/screen dropped 67 → 54 so this iteration changed both prompt and generation architecture — the gain isn't cleanly attributable to the prompt edits alone. Full run took 6h 22min over Tier 1 throttle. Output: `eval/fresh-streamed-2026-04-30.{json,md}`.
- `[2026-04-30]` Day 5 UAT complete. Iteration-1 working in production, with 2 issues identified for follow-up: icon renderer fallback (P1) and BottomNav consistency (P2). Both logged to `BACKLOG.md`. Week 0 closed with caveats. Decision: skipped iteration-2 — Day 3 results were strong enough to ship without a second cycle. Day 5 was compressed into a single evening session combining ship + UAT. Curl-smoke step pivoted to user-driven UI UAT after MCP auth was blocked by a dev/prod key mismatch. Tomorrow's first decision is whether to hot-fix the P1 renderer issue before starting Week 1, or proceed straight to runtime.
- `[2026-05-01]` P1 icon renderer fallback hot-fixed (commit `84f5656`, deployed to production). Renderer-side change only — `KNOWN_MATERIAL_SYMBOLS` set added to `src/utils/iconMap.ts` and `src/components/ScreenRenderer.tsx` Icon case now substitutes a neutral `circle` glyph at 0.4 opacity for any unknown name and emits a one-time `console.warn` for diagnostic backlog-building. Production now displays a generic icon for unmatched names instead of raw text. Prompt and design-system intentionally not touched. Time spent: ~1h. Week 1 runtime work begins separately this afternoon.
- `[2026-05-01]` Week 1 Day 1 — RN-web in iframe under Vite dev validated as **structurally broken**. Vite's CJS pre-bundler produces a malformed `inline-style-prefixer/lib/createPrefixer.js` shim (drops `exports.default = createPrefixer`); excluding from `optimizeDeps` only relocates the failure to other CJS deps (`@react-native/normalize-colors` etc.). RN-web was aliased+installed but never exercised at runtime in this codebase — only inside string-template code generators that emit Snack source. Day 1 also surfaced a separate dev-server crash (`process is not defined` from `snack-sdk`'s eager module init); fixed with a 6-line `window.process` shim in `index.html` (no-op in production). Prototype architecture (iframe + postMessage protocol) validated cleanly; renderer choice is the only question.
- `[2026-05-01]` Week 1 Day 3 — Runtime wired to fetch real production apps from Supabase. Parent-side fetching via `src/lib/runtimeFetch.ts` (thin one-shot utility — `fetchUserProjects`, `fetchProjectScreens`, `fetchScreenTree`); iframe stays a dumb renderer (no Supabase client / auth in the runtime bundle) and the `mokkoi:render-tree` postMessage protocol is unchanged. App selection: project + screen dropdowns (most-recent 20 projects, sorted by `updated_at`) plus URL params (`?project=&screen=`) for shareable repro links. Verified across 3 of 4 available dev projects (fitness tracker, MCP imports, fitness dashboard). True archetype-spread (food delivery, banking, e-commerce) blocked by missing seed data — filed P3 backlog item. Trade-off: dropdown is dev-only ergonomics; production runtime in Week 4 will receive `project`/`screen` IDs directly from the canvas and won't need it.
- `[2026-05-01]` Week 1 Day 2 — Runtime renderer pivoted from RN-web to ScreenRenderer (Path 3). Reason: 1-2 days of Vite/CJS interop debt vs zero user-visible benefit — the user-facing goal (live preview with working tabs/scroll/nav) is delivered by runtime architecture in Weeks 2-4, not by renderer choice. ScreenRenderer is battle-tested in production (lineHeight fix, ScrollView two-div pattern, junk-children filter), self-contained (only imports `types/mokkoi` + `utils/iconMap`), and was importable as-is without slicing. Same iframe+postMessage architecture preserved; future migration to RN-web possible if export fidelity becomes important. Trade-off: runtime can only render what ScreenRenderer renders today (macros must be pre-expanded by the parent). Verified end-to-end with a macro-laden test tree (HeaderBar + ScrollView + StatCards + PromoCard + ListRows + BottomNav) — full screen rendered with Material Symbols icons. One Vite quirk handled: `public/`-served HTML skips the React-plugin preamble injection, so the preamble is added manually to `public/runtime/index.html`.
- `[2026-05-01]` Week 2 Day 1 — Image rendering hardened. Audited the three branches in `ScreenRenderer.tsx` Image case; `searchQuery` (ProxyImage with FLUX/Pexels/LoremFlickr waterfall) and `avatar` (DiceBear) were already solid. Gap was the `source.uri` raw-URL branch — bare `<img>` with no `onError`, no URI validation, no loading state, used in production by import-html trees that hot-link `lh3.googleusercontent.com/aida-public/...` URLs (those URLs expire/403 at scale, leaving broken-image icons). Shipped a new `RawUriImage` component + `ImagePlaceholder` helper in `ScreenRenderer.tsx`: validates the URI (rejects empty, non-`http(s)`/`data:` prefixed) and short-circuits to the placeholder without making a network request, attaches an `onError` that swaps to the same styled placeholder filling the original slot dimensions (so a missing 300x200 hero looks intentional, not broken — `rgba(255,255,255,0.05)` background + centered icon, matches original `borderRadius`), and emits a one-time deduped `console.warn('[image] load failed:', uri)` for diagnostic logging (mirrors the iconMap warn pattern, will surface URL-expiration patterns in production). **Dual improvement: this fix improves canvas AND runtime simultaneously — the canvas has had this same broken-image bug for imported lh3 URLs all along.** Other branches untouched: `searchQuery` (ProxyImage) and `avatar` (DiceBear) verified unchanged via Workouts and Aura Studio Product test screens. Deferred to backlog: `[P3, RENDERER]` avatar-branch onError (DiceBear is reliable enough); `[P3, RENDERER]` LoremFlickr double-bounce on ProxyImage fallback (works, just slower than ideal). Hard rule "don't modify ScreenRenderer.tsx unless absolutely necessary" cleared because React `onError` cannot be attached from outside the component tree, and the change is additive (new component + 1 line swap, doesn't touch other branches). Time spent: ~2.5h.
- `[2026-05-01]` Week 1 Day 5 — Phone-frame chrome + device/zoom controls shipped to the runtime POC. New `RuntimePhoneFrame` component (separate from canvas's `PhoneFrame`) wraps the iframe with bezel + iOS notch / Android status bar + home indicator. Device dropdown (full 16-preset list) + zoom dropdown (50/75/100%) + smart `getDefaultZoom(height)` so each device opens at a sensible size. URL params extended to `?project=&screen=&device=&zoom=` for shareable test setups. Reason for separate component (not refactoring `PhoneFrame` to accept children): `PhoneFrame` is shared with the canvas and already has 4 content branches (streaming/generating/imageUrl/generatedTree); adding a 5th `children` branch is a regression risk for Week 1's last day, and the chrome JSX is self-contained enough that duplication has near-zero ongoing cost. Trade-off: if Week 4's production handoff wants to unify them, the consolidation is mechanical (extract chrome into a `<PhoneChrome>` sub-component used by both). Week 1 closed.
- `[2026-05-01]` Week 4 Day 1.5 — **P0 fix**: runtime iframe production build was broken since Week 1 Day 1 deploy. Discovered during the Day 1 evening dogfood pass when mokkoi.com/runtime-poc hung at "Iframe: waiting · Loading screens…". Console showed `Failed to load module script: /@react-refresh` and `/src/runtime/main.tsx` with strict-MIME rejection (server returned text/html for both). Root cause: `public/runtime/index.html` lived in `public/`, which Vite copies verbatim with no HTML transform — so the hand-rolled preamble's references to `/@react-refresh` (Vite dev-only virtual module) and `/src/runtime/main.tsx` (raw .tsx, no on-the-fly transform in prod) shipped as-is to production. Both 404'd on Vercel → fell through the SPA catch-all rewrite → returned text/html → strict-MIME blocked them as module scripts → iframe never booted. Latent for ~3 weeks because all dogfooding was on localhost where Vite dev transforms .tsx on the fly. Fix is the standard Vite multi-page-app pattern: moved `public/runtime/index.html` → `runtime/index.html` at project root (so Vite *processes* it instead of copying it), stripped the manual `/@react-refresh` block (not needed once the React plugin's HTML transform handles preamble injection in dev and elides it in prod), and declared both HTML entries under `build.rollupOptions.input` in `vite.config.ts`. Iframe-src URLs unchanged (`/runtime/index.html` works in both dev and prod). **Verification:** `npm run build` emits `dist/runtime/index.html` (3.05 kB) + hashed `dist/assets/runtime-gAEz9MjI.js` (5.28 kB); built HTML references the hashed asset with no dev-only paths. `npx serve dist` (no SPA) and `npx serve dist -s` (SPA fallback — simulates Vercel) both return 200 application/javascript for the JS asset and 200 text/html for the HTML; SPA catch-all only fires for genuinely missing routes. Vite dev server still serves `/runtime/index.html` correctly; `/runtime-poc` reaches "Iframe: ready" status with no MIME errors. **Implication:** Day 1's deferred Pass A/Pass B verification was moot — the iframe couldn't have worked in production regardless of canvas-side flag plumbing. Day 2 starts with proper verification on top of this fix. **Future-you note:** when adding more iframe-served entry pages, use the multi-page-app pattern (declare in `build.rollupOptions.input`), not the `public/` shortcut — `public/` skips HTML transforms and produces production-broken output. Commit `aefcea4`. Time spent: ~1h.
- `[2026-05-02]` Week 4 Day 3 — **Production UI cleanup landed as a 4-line gate edit, not the larger strip the plan anticipated.** Step 1 audit of `src/components/RuntimeIframePreview.tsx` found the component was already structurally production-clean from Day 1: no project/screen dropdowns, no status indicator, no title, no URL param sync, no `RuntimePhoneFrame` wrapper, prop shape already matches what canvas integration needs, overlay shape (`position:absolute; inset:0`) and opacity 0→1 fade-in on `iframeReady` already in place — i.e. Day 1 had absorbed Day 3's cleanup scope organically. Only outstanding work was console gating: 4 per-click `console.log`/`console.warn` calls wrapped in `if (import.meta.env.DEV)` so they don't fire in prod. **Mixed-gate decision (matching InlineSnackPreview's precedent more precisely than blanket-DEV-gate):** the 4 high-volume per-click logs (empty-label warn, flowConnection match, fuzzyName match, matched=none warn) are gated; 2 low-volume signals stay ungated — the once-per-boot `[runtime-preview] runtime ready` (useful production "did the iframe boot for this user" diagnostic) and the `expandComponents` `console.error` (real error path, future telemetry-hook target). `projectName` prop kept despite being unused in the body — preserves 1:1 signature match with `InlineSnackPreview` so the Week 5 canvas swap site stays trivial. **Verification:** Pass A (flag OFF) and Pass B (flag ON) both clean — canvas right-pane behavior unchanged when flag absent, iframe overlays correctly without double chrome when flag set, BottomNav clicks route via fuzzyName when label matches a screen name, unresolved labels produce toast, no layout regressions, DEV-gated logs fire as expected in dev mode. `localhost` redirect blocker from Day 1.5 cleared earlier today (Supabase Redirect URLs allowlist didn't include localhost — fixed via dashboard) so live Pass A/B was straightforward this time. **Future-you note:** when reviewing this commit, don't be surprised it's only 4 lines — the structural cleanup the plan describes was already in `d9bb38f` (Day 1's component) and `679c1b5` (App.tsx integration). The plan was written before Day 1 implementation absorbed the scope. Hard rules upheld: `RuntimePoc.tsx`, `ScreenRenderer.tsx`, `InlineSnackPreview.tsx`, error boundary, tree validation, postMessage protocol all untouched. Commit `d98b316`. Time spent: ~1h.
- `[2026-05-02]` Week 4 Day 2 — **Two-layer error defense around the runtime ScreenRenderer.** Layer 1 is `validateTree()` (new, `src/utils/validateTree.ts`): a pure root-only structural check returning `{ valid: true, tree } | { valid: false, reason }`. Rejects `null`, `undefined`, non-object/array root, missing or non-string `type`, empty-string `type`, and `children` present-but-not-array. Deep recursion intentionally skipped — adds cost without benefit since Layer 2 catches mid-tree crashes anyway. Layer 2 is the existing `ErrorBoundary` wrapping `<ScreenRenderer>` inside `RuntimeApp` (`src/runtime/main.tsx`). Different intents: validation is a graceful guard for known-bad shapes; the boundary is the unexpected-crash safety net for things that pass validation but throw mid-render. Both render the same `RuntimeFallback` UI ("Couldn't render this screen", subtext "The screen tree had an unexpected shape.", styled to match the existing toast aesthetic) so the user sees one consistent state regardless of which layer fired. **Single boundary placement at iframe entry point only** — audit confirmed React error boundaries don't traverse iframe boundaries, so wrapping in `RuntimePoc.tsx` or `RuntimeIframePreview.tsx` would catch nothing useful (those parents only host the iframe, they don't mount `ScreenRenderer` themselves). Both parent surfaces inherit the boundary automatically because they both load the same `/runtime/index.html` document. **Future-you note:** do NOT add boundaries in the parent surfaces thinking they'll catch runtime crashes — they won't. The single boundary in `main.tsx` is the architecturally correct location. **`ErrorBoundary` API extended additively:** new optional `fallback?: ReactNode` prop, when set replaces the default inline fallback markup; when omitted the existing `fallbackMessage` behavior is fully preserved. Backwards-compatible; no existing callers affected. Chose this over a 30-line markup duplication after the simpler API change cost only ~5 lines. **Verification (static-only, per Day 1.5 trade-off — `localhost` redirect issue documented in BACKLOG still blocks live dev testing):** TypeScript clean (`npx tsc --noEmit` zero errors), production build clean (`dist/runtime/index.html` 3.05 kB + `dist/index.html` 3.32 kB both emitted with hashed assets), and `validateTree` exercised against 6 synthetic trees:

  | # | Case | Expected | Actual | Result |
  |---|------|----------|--------|--------|
  | 1 | valid production-shaped tree | valid | valid | PASS |
  | 2 | null | invalid (tree-null) | invalid (tree-null) | PASS |
  | 3 | undefined | invalid (tree-undefined) | invalid (tree-undefined) | PASS |
  | 4 | `{}` (no type) | invalid (type-missing) | invalid (type-missing) | PASS |
  | 5 | `{ type: 'View', children: 'not-an-array' }` | invalid (children-not-array) | invalid (children-not-array) | PASS |
  | 6 | `{ type: 123, children: [] }` (wrong type type) | invalid (type-not-string) | invalid (type-not-string) | PASS |

  6/6 pass with correct reason strings. Test was a one-shot JS port of the validator (no TS test infra in repo) — produced this audit-trail table then deleted to avoid keeping a JS shadow of TS logic in the tree as a footgun. Live verification of the fallback UI in actual runtime deferred to whenever (a) the localhost redirect issue is fixed, or (b) a manual production smoke test on `mokkoi.com/runtime-poc` is performed. Acceptable risk: flag-OFF by default, no real users exposed to `RuntimeIframePreview` until Week 5 flag-flip. **Layer 3 deferred to backlog** — per-component error isolation (wrap each `renderNode` recursion in its own boundary so one bad node doesn't kill its siblings) would require modifying `ScreenRenderer.tsx`, which is forbidden by the Day 2 hard rule. Filed as `[P3, RUNTIME]` to defer until production produces a real crash signal motivating the cost. `ScreenRenderer` itself unmodified. Time spent: ~2h.
- `[2026-05-01]` Week 4 Day 1 — Production runtime preview component built + wired behind localStorage flag. New `src/components/RuntimeIframePreview.tsx` (~230 LOC) is a drop-in shape for `InlineSnackPreview` — same overlay contract (`position: absolute; inset: 0` over `<PreviewPhoneFrame>`), same scaling math via `computeFitScale`, just with `src="/runtime/index.html"` instead of a Snack web-player URL and the runtime postMessage protocol (`mokkoi:runtime-ready` / `mokkoi:render-tree` / `mokkoi:click` / `mokkoi:click-unresolved`) replacing Snack's transport. Tree source is canvas memory (props), not Supabase — runtime stays passive, parent owns all data orchestration (consistent with the architectural pattern set in Week 1). Click routing replicates the three-tier resolution from `src/pages/RuntimePoc.tsx` (FlowConnection → fuzzy name → echo unresolved); `fuzzyMatchScreen` inlined with a P3 backlog item to extract once the shape stabilizes. App.tsx integration uses an IIFE around the previously-unconditional `<InlineSnackPreview>` mount; reads `localStorage.getItem('mokkoi_runtime_iframe_preview') === '1'` (strict equality on `'1'` — explicit opt-in, any other value is off, with an inline comment). **Flag-name correction:** plan originally specified dotted `mokkoi.runtime.iframePreview`; switched to snake_case `mokkoi_runtime_iframe_preview` to match codebase convention (`mokkoi_theme_preference`, `mokkoi_model_preference` in SettingsPage). Plan section F updated to reflect. **Verification gap:** Day 1 was static-only (TypeScript clean, diff structurally identical when flag absent, `/runtime-poc` route unaffected). Live Pass A (flag-OFF byte-identity) and Pass B (flag-ON iframe boots, renders, BottomNav routes, toast shows) blocked by ~25min of local Chrome/auth redirect friction (localhost ↔ 127.0.0.1 ↔ mokkoi.com bouncing under HSTS). Deferred to Day 2 — error-boundary work organically requires flag-ON anyway, so verification shifts rather than disappears. Risk contained: flag defaults OFF, no real users affected until Week 5 flag-flip decision. Commits `d9bb38f` (component standalone) + `679c1b5` (App.tsx integration). Time spent: ~2h.
- `[2026-05-02]` Week 4 Day 4 — **DEFERRED.** Original Day 4 plan (throttle `mokkoi:render-tree` posts during AI streaming + measure first-paint perf) presupposed a live iframe receiving posts during stream. Audit at session-start found `RuntimeIframePreview` is invoked from `App.tsx` with `disabled={isGenerating || isStreaming}` — the iframe is fully gated off while the AI streams, with `PreviewPhoneFrame`'s static fallback shown instead. Throttling has no surface to apply to. Two options: (1) build the throttle layer anyway as latent infra for the eventual flag-flip → tactical and cheap but pure dead code today, with a real risk of bit-rotting before it's exercised; (2) reframe Day 4 as the multi-day effort it implies — drop the `disabled` gate, surface `useAIGeneration`'s `partialTree`, throttle posts to render the screen materializing live (Bolt/Lovable streaming UX). Picked (2)-as-deferral, not (2)-as-this-session: a real product win is worth the multi-day push but doesn't fit into one session of cleanup work, and the design questions (partial-tree validation tolerance, partial-render error tolerance during streaming) need their own brainstorming pass before implementation. Filed as `[P2, RUNTIME]` "Live iframe during streaming with progressive tree updates (Bolt-style UX)" in BACKLOG. Today's session pivoted to backlog cleanup instead.
- `[2026-05-02]` Backlog cleanup session — three commits. (1) `2cb90ec` `chore(api): use req.headers.origin fallback for Stripe URLs` — `api/create-checkout.ts:72-73` and `api/create-topup.ts:44-45` had hardcoded `https://mokkoi.com` URLs for Stripe `success_url`/`cancel_url`, bouncing localhost dev sessions to production after Stripe checkout. Replaced with the same `req.headers.origin || process.env.MOKKOI_PUBLIC_URL || 'https://mokkoi.com'` fallback chain `api/mcp-sync.ts:79` already uses (with `req.headers.origin` first since it's per-request, not per-deploy). Production behavior identical (in production, `req.headers.origin` resolves to the same `https://mokkoi.com`). No live billing test today (no Stripe sandbox); typecheck + production build clean. (2) `4328829` `refactor: extract fuzzyMatchScreen to shared util` — closes the P3 dedupe note left in Week 4 Day 1's `RuntimeIframePreview`. Both `src/pages/RuntimePoc.tsx:37` and `src/components/RuntimeIframePreview.tsx:26` had byte-identical implementations differing only in the typed shape parameter (`RuntimeScreenSummary` vs `GeneratedScreen`). Extracted to `src/utils/fuzzyMatchScreen.ts` with `<T extends { name: string }>`. Pure refactor — no behavior change. (3) Localhost auth fix logged: Supabase Redirect URLs allowlist updated via dashboard earlier today (no code change), unblocking localhost dev verification — confirmed clear when Day 3 Pass A/B ran cleanly on localhost. Both P3 backlog items moved to Closed.
- `[YYYY-MM-DD]` _____________

---

## Per-week retrospective template (blank)

Copy this template at the end of each week and fill in. Keep retros honest — they're for future-you.

```
## Week N retrospective — [YYYY-MM-DD]

- Did the Done criterion land? Y / N
- If no, was the cause local (debug it) or structural (re-architect)?
- Time actually spent: _____ hours (estimate was _____)
- What surprised me: _____________
- What I'd do differently next week: _____________
- Energy/motivation at end of week: low / medium / high
- Any abort signals firing? _____________
- Adjustment for next week: _____________
```
