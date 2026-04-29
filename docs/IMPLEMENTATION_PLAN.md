# Mokkoi — Implementation Plan

**Last updated:** 2026-04-28

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
- [ ] ~~Re-run harness against new prompt~~ **BLOCKED** — see decision-log entry below. Dev `ANTHROPIC_API_KEY` is rate-capped at 10K output-tokens/min, but Anthropic pre-charges `max_tokens` against the budget. Haiku 4.5 needs ≥20K tokens per generation call to avoid mid-stream truncation; with the dev key cap, every generation either truncates (`max_tokens ≤ 10K`) or is rejected pre-flight (`max_tokens > 10K`). Fresh-mode evaluation cannot be run on this key.
- [ ] **DECISION POINT (deferred):** measurement of v1 prompt against baseline is unblocked once a higher-tier API key (production tier-2+) is available, OR the harness is restructured to generate one screen per call (significant refactor — out of Day 3 scope).
- [ ] **Day 4 — Iterate.** Apply learnings from v1 results. Tighten icon-name guidance ("ALL icon names MUST be from this list: [80 explicit names]").
- [ ] Re-run harness. Save `eval/v2-2026-04-XX.json`.
- [ ] If macro usage ≥ 50% AND icon validity = 100%, ship.
- [ ] **Day 5 — Ship + chore-batch.** Merge new prompt to main. Watch next 10 production generations land in Supabase.
- [ ] Spot-check macro usage in production generations.
- [ ] Document the lift in `eval/post-rewrite.md`.
- [ ] **Chore-batch:** spend 1-2 hours setting up the second Vite build target (`vite.runtime.config.ts` or `build.rollupOptions.input` extension) so Week 1 doesn't start with config wrestling. No `runtime/` code yet — just the build pipeline.

### Risks for this week
- AI ignores even strong negative examples → fine-tune fallback as documented.
- Prompt length pushes total system-prompt tokens past comfort → consider splitting prompt into a primary call + a follow-up macro-pass call (more complex but more reliable).
- Eval scoring inconsistencies (e.g., what counts as a "macro" vs raw expansion) → settle the scoring contract on Day 2 before iterating.

### Retrospective (fill in at end of week)
- [ ] Did the Done criterion land? Yes / No
- [ ] If no, was the cause local (debug it next week) or structural (re-architect)?
- [ ] Final macro usage rate: _____%
- [ ] Final icon validity rate: _____%
- [ ] Time actually spent: _____ hours
- [ ] Adjustment for Week 1: _____________

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
- [ ] **Day 1 — Smallest possible prototype.** Hand-write a 50-line `runtime/index.html` that imports React + react-native-web from CDN, mounts a `<ScrollView>` with 20 `<View>` children, sees if it scrolls inside an iframe served from `/runtime/index.html`.
- [ ] **VALIDATION CHECKPOINT** — does it scroll? If yes, continue. If no, attempt CSS isolation in main DOM (10 min sanity check). If that also fails, **abort** and revisit architecture.
- [ ] **Day 2 — Vite build target.** Configure second build entry that emits the runtime bundle to `dist/runtime/`.
- [ ] Verify `npm run build` produces both `dist/index.html` (main app) and `dist/runtime/index.html` (runtime).
- [ ] Verify dev server serves `/runtime/` correctly.
- [ ] **Day 3 — Protocol design.** Write `runtime/protocol.ts` with typed message contracts: `parent → iframe {type: "render", tree}`, `iframe → parent {type: "ready"}`, `iframe → parent {type: "error", message}`.
- [ ] **Day 4 — RuntimeRenderer v1.** Tree-walk with 5 leaf cases: `View`, `Text`, `Image` (no proxy yet — expects pre-resolved `props.source.uri`), `TouchableOpacity` → `<Pressable>`, `ScrollView`.
- [ ] Copy `cleanStyle()` helper from existing `src/components/ScreenRenderer.tsx`.
- [ ] Other component cases fall back to `<View>` with a console.warn.
- [ ] **Day 5 — Parent-side wiring.** Create `src/components/InlineRuntimePreview.tsx` that loads the iframe and posts a tree via the protocol.
- [ ] Create throwaway `src/pages/RuntimeTest.tsx` mounting `<InlineRuntimePreview tree={hardcodedHomeTree} />`.
- [ ] Add a dev-only route to `RuntimeTest.tsx`.
- [ ] **End-of-week test:** open `/runtime-test`, see the hardcoded fitness Home tree render in the iframe.

### Risks for this week
- RN-web in iframe has structural issues (touch events, scroll, viewport units) — mitigated by Day 1's prototype.
- Vite build with two entry points has subtle config issues (CORS in dev, asset paths in prod) — budget 4-6 hours for build wrestling.
- PostMessage protocol design choices that block hot updates later — keep the protocol message-based and stateless this week; don't over-engineer.

### Retrospective
- [ ] Did the Done criterion land? Yes / No
- [ ] Did Day 1's validation checkpoint pass cleanly?
- [ ] Time spent: _____ hours
- [ ] Surprising blockers: _____________
- [ ] Adjustment for Week 2: _____________

---

## Week 2 — Image rendering, icons, all component leaves (20-26 hours)

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
- [ ] **Day 2 — Image rendering.** Build `runtime/Image.tsx` that ports the `ProxyImage` fetch pattern from `src/components/ScreenRenderer.tsx`.
- [ ] Add optional `props.resolvedUri` field — if parent resolved the image, skip the fetch.
- [ ] Test: render a tree with 5 Pexels-keyed images, all load.
- [ ] Add `props.avatar` support → DiceBear initials URL.
- [ ] **Day 3 — Icons.** Build `runtime/Icon.tsx` using `lucide-react`.
- [ ] Import the Lucide-first iconMap from `src/utils/iconMap.ts` (or duplicate to avoid main-app coupling).
- [ ] Pre-list ~80 most-used icons; tree-shake the rest.
- [ ] Wire up: AI emits `{type: 'Icon', props: {name: 'directions_walk', size: 20, color: '#fff'}}` → renders as `<lucide.Footprints size={20} color="#fff" />`.
- [ ] Test: render 30 different icon names, all show real vector glyphs.
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
