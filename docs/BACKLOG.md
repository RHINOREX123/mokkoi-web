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

### `[P2, PROMPT]` BottomNav consistency across primary screens within an app

Surfaced during Day 5 UAT (2026-04-30). The task-tracker test app showed BottomNav on Home / Tasks / Add Task but not on Task Detail / Profile. Reads as inconsistent — could be intentional drill-down design (detail screens push without the tab bar, common iOS pattern), or could be the AI being unevenly applying the rule.

**Investigation needed before fixing:**
- Sample 5–10 fresh-streamed generations from the iteration-1 eval run and check whether the missing-BottomNav screens are consistently *detail/modal* screens (intentional) or are scattered across primary screens (unintentional).
- If consistent with detail-screen pattern → no prompt change needed; document the convention.
- If scattered → tighten the prompt's BottomNav rule to clarify "all *primary* (tab) screens MUST share BottomNav; *detail/modal* screens MAY omit it".
- Renderer-side option: if a screen is in the navigation's `tabScreens` list but its tree has no BottomNav, the renderer could inject one. More fragile but eliminates the AI's freedom to forget.

Not urgent — this isn't a broken-looking demo, just a polish issue. Punt to Week 1 or later when the runtime is doing real navigation and the question of "should this detail screen have a tab bar" has a more concrete answer.

---

## Closed

### `[P1, RENDERER]` Icon fallback for invalid names — resolved 2026-05-01 (commit `84f5656`)

Surfaced during Day 5 UAT (2026-04-30). The Home screen of a task-tracker test generation displayed `ALERT_O` as red raw text — same class of bug as the historical `directions_walk` / `local_fire_department` cases. Iteration-1's strict prompt reduced frequency (icon validity 91.74% → 99.33%) but did not eliminate it.

**Root cause was renderer-side.** `toMaterialSymbol()` in `src/utils/iconMap.ts` returned the raw normalized string on a miss, which the canvas renderer then placed inside `<span class="material-symbols-outlined">` — the Material Symbols font only renders ligatures for valid glyph names, so unknown names leaked through as raw text.

**Fix shipped (commit `84f5656`):** added `KNOWN_MATERIAL_SYMBOLS` set to `iconMap.ts` and gated the renderer in `src/components/ScreenRenderer.tsx` — known names render normally, unknown names render the `circle` glyph at 0.4 opacity (visually distinct for UAT) and emit a one-time `console.warn` of the form `[Mokkoi] Unknown icon name: 'X' (rendering fallback)` for diagnostic backlog-building.

Verified locally (alert_o measured 168px raw text vs. circle glyph at 24px) and confirmed in production bundle `assets/index-5wlfiH62.js`. Prompt and design-system were intentionally not touched.
