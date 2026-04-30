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

### `[P1, RENDERER]` Icon fallback for invalid names

Surfaced during Day 5 UAT (2026-04-30). The Home screen of a task-tracker test generation displayed `ALERT_O` as red raw text — same class of bug as the historical `directions_walk` / `local_fire_department` cases. Iteration-1's strict prompt reduced frequency (icon validity 91.74% → 99.33%) but did not eliminate it.

**Root cause is renderer-side, not prompt-side.** When an `Icon` component receives a `name` prop that doesn't match `iconMap` exactly, the renderer falls through to displaying the raw string instead of a fallback glyph. This is fragile — even one in 100 invalid names produces a visible regression in a demo.

**Fix:** in `src/utils/iconMap.ts` (and the analogous runtime path when Week 1 lands), look up the name against the map; if it misses, return a generic fallback icon (e.g., Lucide `HelpCircle` or `Square`) instead of letting the string render. Add a `console.warn` for the invalid name so it shows up in dev but never as red text in the UI.

Accept that the AI will sometimes produce invalid icon names; make the renderer resilient to it.

---

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

(none yet)
