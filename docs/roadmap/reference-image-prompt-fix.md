# Reference image prompt fix

**Status:** `scoped`
**Estimated effort:** 1–2 hours focused work + iteration testing
**Priority:** High (real bug observed in production)
**Owner:** unassigned

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
