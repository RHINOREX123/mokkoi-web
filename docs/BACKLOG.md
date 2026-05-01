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

### `[P3, PROMPT]` Logo / brand text rendered raw

Surfaced during 2026-05-01 expense-tracker UAT. "GAS" appeared as a text node in a transaction row where it was likely intended as a station logo or brand badge. Could indicate the AI is conflating an `Image` (or icon-style brand mark) with a `Text` component, or attempting to label something without proper logo/icon context.

**Investigation needed:** confirm whether this is a renderer issue (logo component not implemented / falling through to text) or a prompt issue (AI emitting `Text` where an icon/image macro is the right choice). Once root cause is known, fix in the appropriate layer. Low priority — single-instance issue, no SLA.

---

## Closed

### `[P1, RENDERER]` Icon fallback for invalid names — resolved 2026-05-01 (commit `84f5656`)

Surfaced during Day 5 UAT (2026-04-30). The Home screen of a task-tracker test generation displayed `ALERT_O` as red raw text — same class of bug as the historical `directions_walk` / `local_fire_department` cases. Iteration-1's strict prompt reduced frequency (icon validity 91.74% → 99.33%) but did not eliminate it.

**Root cause was renderer-side.** `toMaterialSymbol()` in `src/utils/iconMap.ts` returned the raw normalized string on a miss, which the canvas renderer then placed inside `<span class="material-symbols-outlined">` — the Material Symbols font only renders ligatures for valid glyph names, so unknown names leaked through as raw text.

**Fix shipped (commit `84f5656`):** added `KNOWN_MATERIAL_SYMBOLS` set to `iconMap.ts` and gated the renderer in `src/components/ScreenRenderer.tsx` — known names render normally, unknown names render the `circle` glyph at 0.4 opacity (visually distinct for UAT) and emit a one-time `console.warn` of the form `[Mokkoi] Unknown icon name: 'X' (rendering fallback)` for diagnostic backlog-building.

Verified locally (alert_o measured 168px raw text vs. circle glyph at 24px) and confirmed in production bundle `assets/index-5wlfiH62.js`. Prompt and design-system were intentionally not touched.
