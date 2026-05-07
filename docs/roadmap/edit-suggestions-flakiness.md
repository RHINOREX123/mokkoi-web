# Edit-suggestion buttons fail with "AI got stuck mid-response"

**Status:** `idea` — bug, medium priority
**Estimated effort:** 1-3 hours (depends on root cause)
**Owner:** unassigned

## The bug

After a multi-screen app is built, the chat panel shows quick-suggestion
buttons at the bottom of the latest assistant message: "Make it darker",
"Add more sections", "Change accent color", "Add bottom tabs", "Copy as
TSX", "Copy JSON".

Tapping **"Add more sections"** (and possibly others — needs reproduction)
fires `onSend("Add more sections")` which routes to the edit-screen path.
Generation starts, then fails with: *"Error: The AI got stuck
mid-response. Please try regenerating."*

Spotted by user (Sahil) on 2026-05-07 on a ThriveForge project that was
just built via Plan mode. iPad Mini canvas view.

## Hypothesis

`onSend("Add more sections")` is too vague for the edit pipeline. The
prompt lacks context about WHICH section, WHICH screen, what type of
section, etc. The AI sees: "Here is the current screen JSON: ..." +
"User says: Add more sections" → generates something incomplete →
JSON parse fails → "AI got stuck mid-response".

The other quick suggestions might fail similarly:
- **Make it darker** — usually works (clear semantic intent: theme shift)
- **Add more sections** — likely fails (vague)
- **Change accent color** — vague (which color? no instruction)
- **Add bottom tabs** — usually works (clear intent)
- **Copy as TSX / JSON** — clipboard ops, no LLM call, immune

## Suggested fix

Three options, pick during impl:

1. **Concretize the prompts** in QUICK_SUGGESTIONS to be unambiguous:
   - "Add more sections" → "Add 2-3 more content sections to this screen, like a stats summary, a quick actions row, or a recommendations panel. Match the existing visual style."
   - "Change accent color" → opens a small color picker inline; user picks → prompt becomes "Change the accent color throughout this screen to {hex}"
2. **Remove the vague suggestions** — keep only concrete actions
   ("Make it darker", "Add bottom tabs"). Drop "Add more sections"
   and "Change accent color" until an inline UI lands.
3. **Add a retry path** — when JSON parse fails, retry once with an
   explicit "Return only valid JSON" suffix (already exists for some
   paths in api/generate.ts; verify it's wired for edit-screen calls).

## Out of scope

- Plan-mode behavior (separate concern, working correctly post-7ed959c)
- New "Add more sections" UX (e.g. inline section picker) — V2

## Notes

User also noted that the suggestion buttons "popup" feels excessive
on a built project. May want to A/B reduce the visible count
(currently 6 buttons) to 3-4 most-useful ones, with an "More..."
overflow menu for the rest. Same task or follow-up.
