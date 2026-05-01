# Mokkoi — Backlog

Running list of follow-up issues identified during the implementation project. Items here are not blockers for the current week's "Done" criteria but should be triaged before, during, or after the next major milestone.

Priority tags:
- **P0** — production regression, fix immediately
- **P1** — user-visible quality issue, fix this week or next
- **P2** — quality improvement, fix when convenient
- **P3** — nice-to-have, no SLA

Area tags: `RENDERER`, `PROMPT`, `RUNTIME`, `EVAL`, `INFRA`, `UX`, `DOCS`.

---

## Open

### `[P3, RENDERER]` Empty/zero-content children squish in horizontal scroll

Pre-existing in ScrollView, now also in FlatList: explicit-width Views with no inner text/image content collapse to minimal width inside horizontal scroll containers. Fix would be `min-width: max-content` on inner row, or `align-self: flex-start` on each child. Not observed in current production trees. Surfaced during Week 2 Day 3 verification. Severity: low — defensive only.

---

### `[P2, PROMPT]` Document `filled` prop on Icon in iconography prompt section

Renderer supports `filled: true|false` for outline vs filled icon variant. Currently undocumented in prompt, so AI never uses it. Result: active BottomNav tabs visually identical to inactive (only color differs). Documenting in iteration-2 lets AI generate proper active-state visual hierarchy. Discovered Week 2 Day 2 icon audit. Severity: medium — affects perceived polish on every nav.

---

### `[P2, PROMPT]` Strict icon list has names with no iconMap mapping

Iteration-1 prompt strict list (231 Lucide names) was generated from iconMap keys, but 5 names (`alert-circle`, `battery-dead`, `bicycle`, `barbell`, `cake`) had no `LUCIDE_TO_MATERIAL` entry, falling back to placeholder. Today's hot-fix added the missing mappings (Day 2 commit), but the strict-list generator should validate against `KNOWN_MATERIAL_SYMBOLS` at prompt-build time to prevent recurrence. Severity: low — patched today, but pattern could repeat if icon coverage drifts.

---

### `[P3, PERF]` Material Symbols font is full-variable (large)

Variable axis font ships everything. Subsetting to actually-used glyphs would cut load time. Defer until perf is measured as bottleneck. Severity: low — perf optimization.

---

### `[P2, PROMPT]` Empty / placeholder labels in components

Surfaced during 2026-05-01 UAT of an iteration-1 expense-tracker generation. Buttons rendered with placeholder names like "Alex Bennett" instead of action text ("Save Expense", etc.). ChipSelector chips rendered with icons but no text labels. Stat cards showed values but no category headings.

The components themselves render correctly — the AI is failing to populate the text fields with semantically appropriate copy, or is leaking content from one slot (a person's name) into another (a button label). Likely fixed by an iteration-2 prompt rewrite tightening rules on populating text/label fields and giving archetype-specific examples of well-labeled action buttons and chips.

Estimated effort: ~6 hours (one iteration cycle — prompt edit + fresh-streamed eval run + UAT).

---

### `[P2, PROMPT]` Wrong macro selection for data displays

Surfaced during 2026-05-01 expense-tracker UAT. Detail screens (e.g., Transaction Details) rendered as floating colored chip-shaped pills instead of labeled key-value rows. Visual hierarchy collapses — the screen reads as decorative tags rather than structured data.

The AI is reaching for the wrong macro (likely ChipSelector or a Chip-style List variant) when the correct choice is a labeled `ListRow` / key-value layout. Fix is prompt-side: better archetype-specific examples in `FUNCTIONAL_APP_RULES` showing "detail screen → key-value rows, NOT chips" with positive/negative pairs.

Estimated effort: part of the iteration-2 cycle above.

---

### `[P2, PROMPT]` BottomNav consistency across primary screens within an app

Surfaced during Day 5 UAT (2026-04-30). The task-tracker test app showed BottomNav on Home / Tasks / Add Task but not on Task Detail / Profile. **Re-confirmed 2026-05-01** in the expense-tracker app: Home and Transactions have BottomNav; Add Expense, Transaction Detail, and Profile do not. Same pattern across two unrelated app archetypes — strengthens the "scattered, not intentional drill-down" read but isn't conclusive yet.

**Investigation needed before fixing:**
- Sample 5–10 fresh-streamed generations from the iteration-1 eval run and check whether the missing-BottomNav screens are consistently *detail/modal* screens (intentional iOS-style drill-down) or are scattered across primary screens (unintentional).
- If consistent with detail-screen pattern → no prompt change needed; document the convention.
- If scattered → tighten the prompt's BottomNav rule to clarify "all *primary* (tab) screens MUST share BottomNav; *detail/modal* screens MAY omit it".
- Renderer-side option: if a screen is in the navigation's `tabScreens` list but its tree has no BottomNav, the renderer could inject one. More fragile but eliminates the AI's freedom to forget.

Not urgent — this isn't a broken-looking demo, just a polish issue. Punt to Week 1 or later when the runtime is doing real navigation and the question of "should this detail screen have a tab bar" has a more concrete answer.

---

### `[P2, RENDERER]` JUNK_CHILD_RE regex incorrectly filters single-word labels

`ScreenRenderer.tsx:195`'s `JUNK_CHILD_RE` has `/i` flag, causing single-word PascalCase strings (Home, Profile, Discover, Featured, Trending, etc.) to be incorrectly filtered as junk children alongside legitimate junk like "TRUE"/"HORIZONTAL". Affects canvas AND runtime (fidelity preserved between them). Likely 1-character or short-rewrite fix — make regex match only known-junk patterns, not generic single-word PascalCase. Discovered during Week 1 Day 2 runtime POC. Severity: medium (visible content loss for single-word labels in production).

---

### `[P2, INFRA]` Seed canonical archetype test apps in dev DB

Current dev DB has only 4 projects (2 fitness + 1 MCP imports + 1 mokkoi). Missing food-delivery, banking, e-commerce, and social archetypes for runtime verification testing. Seeding canonical test apps would let Week 2-5 verification cover archetype-spread properly. Lift from production via test-data export, or generate fresh ones. Surfaced during Week 1 Day 3 verification — could only test 3 of the 4 available projects, none of which were food-delivery or banking.

**Bumped P3 → P2 on 2026-05-01 during Week 3 Day 1 demo-flow survey.** Survey revealed dev DB is one focused workspace (project 2: MCP Imports, 10 single-screen demos) plus three kitchen-sink workspaces (projects 1/3/4: 80+/28+/44 screens of disconnected demos, version copies, and regenerations from one-off prompts). There is no canonical multi-screen demo flow per archetype to walk start-to-finish, which actively constrains Week 3-5 verification quality — can't honestly survey nav patterns across diverse archetypes when the underlying data is heterogeneous noise. Should be addressed before Week 4 production-swap testing, when verification needs to span food-delivery, banking, e-commerce, and social archetypes with real multi-screen flows.

---

### `[P3, RENDERER]` Fitness Home progress-ring text overlay

"1,847 cal" text overlaps the green "Daily Goal" progress ring label on the fitness tracker's Home screen. Affects canvas AND runtime (fidelity preserved between them). Layering / positioning issue in the `ProgressRing` macro composition — the value text and the ring's own label end up at the same vertical position. Discovered during Week 1 Day 3 verification. Severity: low — visual quirk, not blocking.

---

### `[WITHDRAWN]` Empty-label Buttons should classify as Deferred:no-label

**Withdrawn 2026-05-01 during Week 3 Day 2 verification.** Originally filed Day 1 based on audit-harness data showing 8 of 9 buttons on the Velox Audio product screen classifying as "Button(empty-label)". Day 2 re-verification by triggering real clicks and capturing the actual runtime classifier's output found that all of those cases are correctly classified as `IconButton` by the production code (`arrow_back`, `circle`, `share`, `home`, `notifications`, etc.). The phantom data came from a cross-window `instanceof HTMLElement` bug in the audit harness — the harness ran in the parent window context examining iframe DOM nodes, where `cur instanceof HTMLElement` resolved against the parent window's constructor and returned false for elements from the iframe's window. The harness's `countText` therefore never recognized `.material-symbols-outlined` ancestors and counted icon glyph names as label text. The runtime classifier itself runs *inside* the iframe (correct `instanceof` resolution) and works correctly. No work to do.

---

### `[P3, PROMPT]` Logo / brand text rendered raw

Surfaced during 2026-05-01 expense-tracker UAT. "GAS" appeared as a text node in a transaction row where it was likely intended as a station logo or brand badge. Could indicate the AI is conflating an `Image` (or icon-style brand mark) with a `Text` component, or attempting to label something without proper logo/icon context.

**Investigation needed:** confirm whether this is a renderer issue (logo component not implemented / falling through to text) or a prompt issue (AI emitting `Text` where an icon/image macro is the right choice). Once root cause is known, fix in the appropriate layer. Low priority — single-instance issue, no SLA.

---

### `[P2, ARCHITECTURE]` FlowConnection canonical routing is dead code in production

Across all 4 dev DB projects, **0 of 4 have any FlowConnection trigger fields populated**. Project 1 (fitness kitchen-sink) has 4 connections with only `fromScreenId` + `toScreenId` (no `trigger`). Projects 2/3/4 have empty connections arrays entirely. Every routing success since Week 1 Day 4 (BottomNav) and Week 3 Day 1 (Button/IconButton) has gone through `fuzzyMatchScreen` against screen names — the canonical `findNavigationTarget` lookup tier in `src/utils/previewNavigation.ts` is unreachable in current production data.

Strategic implications, pick one or combine:
1. Canvas UX should make FlowConnection drawing more prominent / automatic (today users probably don't realize triggers are needed for canonical routing).
2. Runtime should lean harder on fuzzy matching — accept fuzzy as the canonical path, document the trade-off.
3. Pull Phase 2 macro-metadata preservation forward — the planner emits macros with `targetScreenId` baked in, and FlowConnections become unnecessary as a label-keyed lookup table.

Discovered Week 3 Day 2 by inspecting the actual `projects.connections` Supabase responses across all 4 projects. Severity: medium — affects every interactivity decision in Weeks 3-5 and reframes what "click resolution" actually means at runtime today.

---

### `[P2, INFRA]` Runtime preview telemetry / error reporting

Today there is no error reporting, analytics, or iframe-failure tracking around the runtime preview. "Monitor for regressions during dev burn-in" means manually checking canvas behavior and reading dev-tools console. Before the Week 5 flag-flip to default-ON for real users, basic telemetry needs to exist:
- Iframe boot success/failure rate (handshake completed vs. timed out).
- Render error frequency (ErrorBoundary catches, with tree shape signal so we can pattern-match).
- Click-routing miss rate (`matched=none` warns vs. successful matches — already structured at the log level Week 3 Day 2).
- First-paint latency distribution (parent posts tree → iframe acks render).

Doesn't need to be Sentry-tier for Week 5; even a console-aggregated dev metric or a tiny telemetry endpoint that batches counts would unblock the cutover. Discovered Week 3 Day 3 production-swap design. Severity: medium — blocker for the Week 5 flag-flip / production cutover, not for the Week 4 ship-behind-flag milestone.

---

### `[P3, RUNTIME]` Single-text data-as-label classifies as Button

TouchableOpacity wrappers around data text (person names like "Nora Ward" in an activity feed, transaction amounts in a banking app, message previews in a messages list) classify as `Button` because they have exactly one Text descendant. The runtime then posts `{ kind: 'Button', label: 'Nora Ward' }`, the parent finds no FlowConnection or fuzzy screen-name match, and the toast says `No screen wired for 'Nora Ward'` — misleading because the data was never supposed to be wired. Same root cause as the compound-clickable data-vs-action discrimination: the runtime can't tell action labels from data without macro metadata. Discovered Week 3 Day 2 verification on a fitness Home screen with a friends-activity card. Severity: low — the toast is honest about lack of wiring, just framed awkwardly. Phase 2 macro-metadata preservation resolves this naturally (the macro emits `Card` with `kind:'activity-feed-row'` and the runtime knows the inner text is data).

---

### `[P2, ARCHITECTURE]` Stored trees have lost macro semantic structure

`expandComponents()` runs server-side at generation time, converting macros (BottomNav, ListRow, ChipSelector, etc.) into raw primitive trees with no metadata about the original macro intent. This loses tab→screen mappings, list semantics, form submission targets, etc. Future runtime/interactivity work has to use brittle heuristics instead of clean metadata. Long-term fix: preserve macro metadata in stored trees, expand only at render time. Affects: navigation, form handling, smart layouts, accessibility. Discovered during Week 1 Day 4. Severity: medium-long-term — accept heuristic approach for Phase 1, plan refactor for Phase 2.

---

### `[P2, PROMPT]` AI generates BottomNav tabs without Text labels

Production fitness tracker app has BottomNav with icon-only tabs (no Text children). Without labels, runtime navigation can only fall back to icon glyph names ("person", "fitness_center"), which often don't match screen names. Users see broken nav that should work. Fix in iteration-2 prompt: require Text labels on every BottomNav tab. Discovered during Week 1 Day 4 verification. Severity: medium — affects nav reliability across most generated apps with BottomNav.

---

### `[P3, RUNTIME]` Icon-name → screen-name synonym map

When BottomNav tabs lack text labels, runtime falls back to icon glyph names. Adding a synonym map (person→Profile, fitness_center→Workouts, bar_chart→Progress, home→Home, search→Search) would lift nav hit-rate on icon-only navs from current ~40% to ~80%. Becomes obsolete once macro metadata is preserved in stored trees (P2 ARCHITECTURE entry). Severity: low — patch, not fix. Skip if Phase 2 macro-preservation work happens within ~1 month.

---

### `[P3, RENDERER]` Avatar branch onError fallback

`src/components/ScreenRenderer.tsx` avatar branch (DiceBear SVG, lines 344-353) has no `onError` handler. DiceBear is reliable, but defense-in-depth would mirror the `RawUriImage` pattern (swap to styled placeholder filling original dimensions, log dedupe warn). Discovered during Week 2 Day 1 image hardening (2026-05-01). Severity: low — DiceBear failures are rare in practice.

---

### `[P3, RENDERER]` LoremFlickr double-bounce on searchQuery proxy fallback

When `ProxyImage`'s primary path fails, fallback to LoremFlickr requires the image to fail twice: the proxy returns a LoremFlickr URL → that URL fails to render → the `<img onError>` handler fires *another* LoremFlickr URL with the same hash. Optimization opportunity to skip the first failed request, e.g. by trying LoremFlickr directly when the proxy is unreachable in dev. Discovered during Week 2 Day 1 image hardening (2026-05-01). Severity: low — fallback works, just slower than ideal.

---

## Closed

### `[P1, RENDERER]` Icon fallback for invalid names — resolved 2026-05-01 (commit `84f5656`)

Surfaced during Day 5 UAT (2026-04-30). The Home screen of a task-tracker test generation displayed `ALERT_O` as red raw text — same class of bug as the historical `directions_walk` / `local_fire_department` cases. Iteration-1's strict prompt reduced frequency (icon validity 91.74% → 99.33%) but did not eliminate it.

**Root cause was renderer-side.** `toMaterialSymbol()` in `src/utils/iconMap.ts` returned the raw normalized string on a miss, which the canvas renderer then placed inside `<span class="material-symbols-outlined">` — the Material Symbols font only renders ligatures for valid glyph names, so unknown names leaked through as raw text.

**Fix shipped (commit `84f5656`):** added `KNOWN_MATERIAL_SYMBOLS` set to `iconMap.ts` and gated the renderer in `src/components/ScreenRenderer.tsx` — known names render normally, unknown names render the `circle` glyph at 0.4 opacity (visually distinct for UAT) and emit a one-time `console.warn` of the form `[Mokkoi] Unknown icon name: 'X' (rendering fallback)` for diagnostic backlog-building.

Verified locally (alert_o measured 168px raw text vs. circle glyph at 24px) and confirmed in production bundle `assets/index-5wlfiH62.js`. Prompt and design-system were intentionally not touched.
