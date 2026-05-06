# Mokkoi Roadmap — Tasks parked for future work

Each `.md` file in this folder is a **task spec** for a feature we've discussed but haven't built yet. They live here so any future Claude Code session (or human) can pick one up cold and execute without needing prior conversation context.

## Status tags

Every task file starts with a status:

- **`idea`** — discussed, not yet scoped
- **`scoped`** — clear plan, ready for someone to pick up
- **`in-progress`** — actively being worked on (someone owns it)
- **`shipped`** — merged to main, deployed; archived here for history

## How to pick up a task

1. Read the task file end-to-end
2. Check the status — only pick up `scoped` tasks unless you're explicitly extending an `in-progress` one
3. Follow the **Files to touch** section as your starting map
4. Run typecheck + build before committing (`npx tsc -b && npm run build`)
5. Update the task's status to `in-progress` when you start, `shipped` when merged
6. Open a PR — never push to `main` directly without the user confirming

## Conventions

- **One task per file.** No multi-feature mega-files.
- **Self-contained.** A new Claude Code session should be able to read the file and execute without external context.
- **Concrete file paths.** "Update `api/generate.ts` line ~1500" beats "update the API."
- **Honest scope.** If a task is 2 hours, say 2 hours. If it's 2 days, say 2 days.
- **Out-of-scope explicit.** What's *not* part of this task = saves arguments later.

## Current tasks

| File | Status | Brief |
|---|---|---|
| `conversational-intent.md` | scoped | Haiku-powered chat intent gating — Mokkoi chats when asked, builds when told |
| `reference-image-prompt-fix.md` | scoped | System prompt update so attached images are inspiration, not exact clones |
| `templates-page.md` | idea | `/templates` route + sidebar entry; pre-built starter library |
| `public-gallery-remix.md` | idea | `/gallery` page + Remix button on public projects |
| `voice-prompt.md` | idea | Mic icon next to Camera; Web Speech or Whisper transcription |
| `figma-export-pro.md` | idea | Pro-tier feature: export Mokkoi project → Figma frames |
