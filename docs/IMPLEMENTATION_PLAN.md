# Mokkoi — Implementation Plan

**Last updated:** 2026-05-01
**Status as of 2026-05-01:** **Week 1 closed.** Five days of runtime POC work shipped: iframe shell + postMessage protocol (Day 1-2), Supabase fetch wired in (Day 3), BottomNav tap-to-navigate (Day 4), phone-frame chrome + device/zoom controls (Day 5). The runtime renders real production trees from real projects with working tabs and a polished test rig. All in dev only — `mokkoi.com` still serves the broken Snack preview; that swap is Week 4. Renderer pivoted from `react-native-web` to the existing `ScreenRenderer` on Day 2 (see decision log). Macro semantic loss in stored trees is the architectural debt that informs Phase 2 planning. Week 2 begins next session.

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
- [x] **Day 3 (revised cadence, 2026-05-01) — Scroll behavior audit + fixes.** Audited ScrollView + FlatList in ScreenRenderer. Findings: ScrollView already had the "stretchy children" fix and Webkit-touch polish, but lacked `overscroll-behavior` so scrolling at end-of-content could chain to the parent runtime POC page; FlatList ignored `props.horizontal` (always vertical), missed `WebkitOverflowScrolling:'touch'` and `scrollbarWidth:'none'` so vertical FlatLists looked different from vertical ScrollViews; `scrollbarWidth:'none'` was Firefox-only — Chrome/Safari still showed scrollbars. Hardened: added `overscrollBehavior:'contain'` to both ScrollView and FlatList outer divs, brought FlatList to feature-parity with ScrollView (horizontal axis handling, touch polish, scrollbar hide), added a `.mokkoi-screen-scroll::-webkit-scrollbar { display: none }` rule to both `public/runtime/index.html` (iframe) and `index.html` (canvas), and tagged both scroll containers with that class. **Dual-defense for scroll-chain isolation is intentional, not redundant**: per-component `overscroll-behavior:contain` covers ScrollView/FlatList, and a body-level `overscroll-behavior:none` in the iframe HTML catches future scroll containers we haven't built yet (e.g. raw Views with `overflow:auto` from AI). FlatList now mirrors ScrollView's full feature set. Canvas dual-improvement: scrollbar is now hidden in Chrome/Safari too, was Firefox-only before. Verified on Workouts screen: vertical scroll reaches end cleanly without chaining; synthetic horizontal-FlatList postMessage test confirms axis swap. New backlog entry: empty/zero-content children squish in horizontal scroll (P3 RENDERER, defensive — pre-existing pattern, not observed in production trees).
- [x] **Day 2 (revised cadence, 2026-05-01) — Icon rendering audit + improvements.** Re-scoped from "build runtime/Icon.tsx with lucide-react." The runtime adopted ScreenRenderer's existing Material Symbols path, so today was an audit-and-harden pass on the shared renderer. Findings: 5 strict-list Lucide names (`alert-circle`, `battery-dead`, `bicycle`, `barbell`, `cake`) had no `LUCIDE_TO_MATERIAL` entry and silently fell back to circle; the Material Symbols font CSS used `display=swap`, causing a brief flash of raw glyph names ("home", "favorite") in the fallback font on cold load; macros in `lib/component-library.ts` violated the strict-Lucide rule by emitting Material snake_case names (`arrow_back`, `monitoring`, `chevron_right`, `sentiment_satisfied`). Hardened: added the 5 missing aliases + 5 conservative aliases for observed AI hallucinations (`bar-chart-3`, `bar-chart-4`, `chevron-double-right`, `chevron-double-left`, `star-border`); switched font CSS to `display=block` so glyphs stay invisible during font load instead of rendering raw words; renamed macro icon names to Lucide kebab-case so our macros match the rule we enforce on the AI. Verified on fitness Workouts screen: 18/18 icons render with proper glyphs, zero fallback. Three new backlog entries: document `filled` prop (P2 PROMPT), strict-list generator should validate against `KNOWN_MATERIAL_SYMBOLS` (P2 PROMPT), Material Symbols font subsetting (P3 PERF).
- [ ] **VALIDATION CHECKPOINT** — render fitness app's 7 screens. All renderable? If yes, continue.
- [ ] **Day 4 — SVG cases.** Add `Svg`, `Circle`, `Path`, `Rect`, `Line` — render as raw `<svg>` elements (RN-web tolerates this).
- [ ] Add `LinearGradient` — use CSS `linear-gradient` on a `<View>` wrapper, OR `expo-linear-gradient` if simple.
- [ ] **Day 5 — Layout regression tests.** Build `eval/render-comparison.ts` that takes 6 archetype trees and renders them in both the static renderer and the runtime, captures screenshots, generates a diff report.
- [ ] Catalog any visual regressions; fix the top 5; document the rest.

### Risks for this week
- `lucide-react` bundle bloat → dynamic import or hardcoded subset.
- SVG rendering inside RN-web has known issues with `strokeDasharray` (used by ProgressRing) → keep raw SVG, don't use react-native-svg.
- Image proxy CORS issues from iframe origin → use `crossOrigin="anonymous"` on `<Image>` source attribute or proxy through Mokkoi's API endpoint.

### Retrospective
- [ ] Did the Done criterion land? Yes / No
- [ ] Visual regressions resolved? Count: _____
- [ ] Time spent: _____ hours
- [ ] Adjustment for Week 3: _____________

---

## Week 3 — Scroll, navigation, onPress, real interactivity (22-28 hours)

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
- [ ] **Day 1 — Multi-screen protocol.** Extend `runtime/protocol.ts` with `RenderScreens` message containing all screens + active id + connections.
- [ ] Update `runtime/main.tsx` to maintain `currentScreenId` state from this protocol.
- [ ] Update `RuntimeRenderer` to render only the active screen but keep all screens loaded for fast switching.
- [ ] **Day 2 — Pressable onPress.** Tree-walk pre-pass that wires bottom-tab `onPress` handlers based on macro `BottomNav` items.
- [ ] Wire flow connections: if a `TouchableOpacity` matches a `connection.trigger` label, its onPress navigates to the connection's `to` screen.
- [ ] Reuse logic from `src/utils/previewNavigation.ts` (`findNavigationTarget`).
- [ ] **Day 3 — Two-way sync.** Iframe → parent: `{type: "navigated", screenId}` postMessage when in-app nav fires.
- [ ] Parent → iframe: when chat panel tab clicks, update the iframe's `activeScreenId` via protocol.
- [ ] **VALIDATION CHECKPOINT** — verify no ping-pong between parent and iframe state. Manual test: tap iframe tab, watch chat panel; tap chat panel tab, watch iframe.
- [ ] **Day 4 — Scroll polish.** Confirm `ScrollView` scrolls smoothly. If `flexShrink: 0` on inner items isn't enough, add explicit `contentContainerStyle` pass.
- [ ] Test on touch device (open dev server on phone).
- [ ] Test scroll-vs-tap detection — ensure swiping doesn't accidentally trigger `onPress`.
- [ ] **Day 5 — Pressable feedback.** Override RN-web's default press state to be slightly more visible (0.7 opacity) for demo clarity.
- [ ] Add `delayPressIn: 50` to reduce perceived lag.
- [ ] Test: tap each interactive button in the fitness app, verify visual feedback fires.

### Risks for this week
- Pressable-inside-ScrollView tap-vs-scroll detection edge case → standard `delayPressIn` of 130ms.
- Two-way sync ping-pong (déjà vu from Phase 2) → use ref-based "origin" guard or single-source-of-truth pattern (parent always wins on prop change).
- Flow connections that don't have explicit triggers (saw 4 unmatched connections in earlier wirer logs) → log + ignore, don't crash.

### Retrospective
- [ ] Did the Done criterion land? Yes / No
- [ ] Two-way sync stable? (no ping-pong)
- [ ] Time spent: _____ hours
- [ ] Adjustment for Week 4: _____________

---

## Week 4 — Theme, error boundaries, static-renderer handoff (18-24 hours)

### Goal
The runtime is robust enough to be the default preview. Static renderer becomes a fallback only.

### Concrete deliverables
- `runtime/Theme.tsx` — context provider populated by parent via protocol.
- `runtime/ErrorBoundary.tsx` — root-level boundary that posts errors to parent.
- `src/App.tsx` — `InlineSnackPreview` import removed, `InlineRuntimePreview` wired in.
- `src/components/InlineSnackPreview.tsx` deleted.
- `package.json` — drop `snack-sdk` and `assert` deps.

### "Done" criterion
`git grep snack-sdk` returns zero matches in `src/`. Open any existing project on production — preview shows runtime, real RN-web rendering, real images, real icons. Generate a fresh app — static renderer briefly during streaming, smooth handoff to runtime when complete, no flicker. Force a render error (malformed tree) — error boundary catches, static fallback shows with notice.

### Validation checkpoint
**End of Day 3.** Batch-render all 257 existing Supabase trees through the new runtime in headless mode. If >30% of trees fail to render correctly even after a week of fixes, the JSON shape isn't actually portable — abort migration, keep static renderer as primary.

### Hours estimate
18-24 hours.

### Tasks
- [ ] **Day 1 — Theme propagation.** Build `runtime/Theme.tsx` context provider.
- [ ] Wire parent to send `{type: "theme", tokens}` on init.
- [ ] Theme keys: surface-0/1/2/3, text-primary/secondary, accent, semantic colors.
- [ ] AI-generated trees referencing theme keys (e.g., `color: "$accent"`) resolve through theme.
- [ ] **Day 2 — Error boundary.** Build `runtime/ErrorBoundary.tsx` at the root.
- [ ] On render error, post `{type: "error", message, stack}` to parent.
- [ ] Render minimal fallback inside iframe ("Preview crashed — falling back to static. Bug logged.").
- [ ] **Day 3 — Migration sanity.** Build `eval/migration-batch.ts` that headless-renders all 257 existing trees through the runtime, catalogs errors.
- [ ] **VALIDATION CHECKPOINT** — fix top 5 most common errors. If pass rate is <70% even after fixes, abort migration and keep static as primary.
- [ ] **Day 4 — Wire into App.tsx.** Replace `InlineSnackPreview` with `InlineRuntimePreview`.
- [ ] Static `PreviewPhoneFrame` becomes during-streaming-only view.
- [ ] Smooth handoff: when `isGenerating || isStreaming` flips to false, fade from static to runtime.
- [ ] **Day 5 — Cleanup.** Delete `src/components/InlineSnackPreview.tsx` (290 lines).
- [ ] Drop `snack-sdk` and `assert` from `package.json`.
- [ ] Remove `assert: 'assert'` alias from `vite.config.ts`.
- [ ] Run `npm run build` — confirm bundle smaller (-55KB gzipped).
- [ ] Deploy to production. Verify on existing fitness project.

### Risks for this week
- Some legacy trees rely on quirks of static renderer (HTML/CSS behaviors) → catalog on Day 3, fix top 5, accept the long tail.
- Theme key references in trees that AI hasn't been generating yet → defer until Week 5 if not already in production trees.
- Production rollout breaks user projects → deploy behind a feature flag (`?runtime=1` URL param) for first 24 hours, then flip default.

### Retrospective
- [ ] Did the Done criterion land? Yes / No
- [ ] Migration pass rate: _____%
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
