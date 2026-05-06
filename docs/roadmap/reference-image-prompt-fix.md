# Reference image prompt fix — SUPERSEDED

**Status:** `superseded` — replaced by `multi-image-app-generation.md`
**Outcome:** Shipped as commit `f9a5d44`, tested live, **didn't work**,
reverted from main on 2026-05-06.

## Why this approach failed

The fix was prompt-only — it added a new "INSPIRATION MODE" prompt
branch inside `api/generate.ts`'s **single-screen multimodal flow**
(around line 1568). The new prompt told Sonnet to "build a complete
multi-screen app with functional bottom nav."

The problem: that code path only returns a **single component tree**.
Sonnet did the most reasonable thing it could — built one screen with
a beautiful bottom-nav UI element, but with no real screens wired to
those tabs. Tapping any tab on the generated app showed
*"No screen wired for 'Home'"*.

Live test result (post-deploy):
- Attach 4 food-app screenshots + prompt "create a meal planner"
- Got: 1 screen ("Favorites"), bottom nav present but non-functional
- Expected: multi-screen app inspired by references with working nav

Root cause: the multi-screen pipeline (`appRequest`) is a separate code
path that explicitly excludes image submissions
(`!imageData` in its gating condition). The prompt fix lived in the
wrong path.

## What ships instead

`multi-image-app-generation.md` covers the proper fix:

1. Routing — image + app-prompt + no-clone-intent → multi-screen path
2. Multi-screen pipeline accepts image content blocks
3. Chat history displays all attached images (separate display bug
   discovered during testing)

DO NOT pick up the work below. It's left here for history.

---

(Original spec preserved below for context — but the approach is wrong.)

---

## The problem

When users attach reference images via the dashboard Camera button (Phase E/F) and submit with a minimal text prompt, Mokkoi treats the images as **exact clones** rather than **visual inspiration**. Result:

- AI generates ONE rendered screen that looks like the most prominent reference
- Bottom tab navigation isn't functional (no real screens connected)
- Multi-screen app structure is missing
- User expected an inspired-by app; got a single-screen mockup

**Repro:**
1. mokkoi.com → Camera → attach 4 screenshots of a food app
2. Type a short prompt like "create an app based on this design"
3. Hit Send
4. Result: one screen rendered, bottom tabs visible but inactive, no multi-screen flow

## The root cause

System prompt in `api/generate.ts` doesn't differentiate between:
- "Build me an app, here are some references for vibe" (most common case)
- "Recreate this exact screen pixel-true" (rare, explicit only)

It defaults to literal-clone behavior when images are attached, which is wrong for the common case.

## The fix

Edit the system prompt in `api/generate.ts` (search for `imageData && typeof imageData === 'string'` block, around line 1552 — that's where the multimodal message is constructed). Add explicit guidance for handling reference images.

Proposed system prompt addition:

```
When the user attaches reference images alongside their prompt:

  - Treat the images as VISUAL INSPIRATION: colors, layout style,
    typography vibe, spacing, mood. Not as literal clones.
  - Build a complete multi-screen app structure regardless of how
    many or what the references look like.
  - Bottom tab navigation, headers, and inter-screen flows must be
    fully wired and functional.
  - Only attempt a literal pixel-true clone if the user explicitly
    says: "clone this", "recreate exactly", "match pixel-by-pixel",
    or "this is the screen, just rebuild it."
  - When in doubt, prefer inspired-by over clone.

Examples of intent:
  - "build a food app like this" → use the references for vibe;
    build full app with home / browse / detail / saved screens.
  - "clone this screen" → exact-match a single screen.
  - "make me an app" + 3 images → use references for style; build
    full app structure that fits the visual language.
```

## Files to touch

```
api/generate.ts          — system prompt (the multimodal branch)
                           around line 1552 (image handling block)
```

The prompt is a string template; just add the new guidance inside it. No code structure changes needed.

## Verification

1. Local dev OR Vercel preview
2. Attach 3-4 food/recipe app screenshots, prompt: "create a meal planner"
3. Result should be: multi-screen Flutter/RN app with home + browse + detail + favorites; bottom nav functional; visual style inspired by references
4. Now try: "clone this exactly" + 1 screenshot → should produce a single-screen pixel-tight match
5. Both intents working = ship

## Out of scope

- Adding new endpoints
- Changing the multimodal API contract (Phase F already did this)
- UI changes (this is purely backend prompt engineering)
- Touching the in-chat single-image attach flow

## Related shipped work

- Phase E (b3b9d69): Camera button single-image attach
- Phase F (518cc7e + 7a3b0c0): Multi-image (up to 4) backend + UI consolidation
- This task closes the loop on quality of *what gets generated* with those images.
