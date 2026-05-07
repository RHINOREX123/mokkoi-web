# Fix UTF-8 mojibake in dashboard / chat panel strings

## Status: user-visible strings fixed (claude/fix-mojibake-user-visible). Comment-only mojibake still deferred.

## Background

Multi-byte chars (em-dash —, ellipsis …, arrow →, middle dot ·, ✅, ❌)
were encoded as Windows-1252 then re-saved as UTF-8 multiple times, producing
nested mojibake byte sequences of 18 / 32 / 67 bytes per original char.

Damage was introduced in commit 47330f9 (single/double-encoded) and
compounded in 2907a1e (some files re-saved at deeper layers).

## What's fixed

User-visible strings across 4 files (`src/App.tsx`,
`src/pages/Dashboard.tsx`, `src/components/dashboard/PromptCard.tsx`,
`src/components/ChatPanel.tsx`):

- Textarea / input placeholders
- Toast messages (`✅ Saved...`, `❌ Save failed...`)
- JSX label text and aria-labels
- Date format separators (`May 7 · 2:13 PM`)
- The `startsWith` comparison in `App.tsx` toast-duration logic was
  updated to match the new emoji prefixes.

Approach: byte-precise replacement via PowerShell, scoped per-line, with
mojibake byte sequences forward-computed by re-running the cp1252→UTF-8
mojibake pipeline N layers (verified 2-, 3-, and 4-layer variants).
A naive global regex replacement was rejected because the same
intended character appears at different nesting depths across files.

## What's still deferred

Comment-only mojibake (~159 instances inside `//` and `/* */`):

- `src/App.tsx` (heaviest — JSDoc + inline)
- `src/pages/Dashboard.tsx`
- `src/components/dashboard/PromptCard.tsx`
- `src/components/ChatPanel.tsx`
- `src/hooks/useVoiceRecording.ts` (comments only — entire file deferred)

Comments are invisible at runtime so user impact is zero. Worth a follow-up
pass with `ftfy` per-file with diff review when there's quiet time.

## Prevention

- `.editorconfig` at repo root pins `charset = utf-8`, `end_of_line = lf`.
- `npm run check:encoding` (script `scripts/check-encoding.mjs`) walks
  `src/` and `api/`, fails on the canonical mojibake fingerprints
  `Ã[¢‚Æ‚]` and `Â[§¦]`. Wire into CI when a general workflow exists.

## Priority

Comment-only cleanup: low. Wait until someone finds time and can
review the `ftfy` output line-by-line.
