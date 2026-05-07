# Fix UTF-8 mojibake in dashboard / chat panel strings

Several source files have multi-layer mojibake on fancy chars (em-dash,
ellipsis, arrow, section sign, smart quotes). Visible to the user as
garbled placeholder text on the dashboard:

> "Let's build Ã¢ã,Â¬â€š describe your app, paste a screenshot, or import a Figma fileÃ¢ã,Â¬Â¦"

Should be:

> "Let's build — describe your app, paste a screenshot, or import a Figma file…"

## Affected files (run `git grep "Ã¢"` to find more):

- `src/components/ChatPanel.tsx`
- `src/components/dashboard/PromptCard.tsx`
- `src/pages/Dashboard.tsx`
- `src/hooks/useAIGeneration.ts` (likely)
- Possibly more

## Root cause

UTF-8 bytes were interpreted as Windows-1252 and re-encoded as UTF-8 at
some point in the file's history — likely a save in an editor with the
wrong default encoding. The damage is multi-layered (em-dash byte E2 80
94 is now ~10 bytes of garbage) so a simple find-and-replace risks
making things worse, especially because partial patterns overlap (the
em-dash mojibake and the close-quote mojibake share a prefix).

## Suggested fix approach

1. For each affected file, do a one-time manual review:
   - Check `git log` for when the chars were last clean
   - Either revert to that revision OR rewrite the affected lines by hand
2. Add a CI check that fails the build if any source file contains the
   sequence `Ã¢` (a near-perfect mojibake fingerprint)
3. Configure project editor settings (`.editorconfig` or VSCode
   `settings.json`) to force UTF-8 without BOM on every save

## Why deferred

Fixing this is mechanical but risky — I attempted a scripted fix and
made one file worse before reverting. Wants a careful manual pass per
file rather than a regex bulk-replace.

## Priority

Cosmetic-but-visible bug. Doesn't block any feature. Annoying to read
in user-facing copy. Pick up when there's a quiet hour.
