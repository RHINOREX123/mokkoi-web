# Multi-image app generation — proper fix

**Status:** `scoped`
**Estimated effort:** 2–3 hours focused backend + targeted frontend
**Priority:** **HIGH** — replaces the reverted prompt-only fix
**Owner:** unassigned

## Why this exists (history)

A previous attempt — see `reference-image-prompt-fix.md` (now marked
superseded) — tried to fix this with system-prompt-only changes inside
the single-screen pipeline. It shipped, was tested, **didn't work**, and
was reverted. The fix lived in the wrong code path: the prompt asked
Sonnet to "build a multi-screen app" but the response format expected a
single component tree, so Sonnet returned one screen with a bottom nav
UI that had no functional targets.

This task fixes the actual routing and ships a working result.

## The problem (concrete)

User flow:

1. mokkoi.com → Camera → attach 3-4 reference screenshots
2. Type something like *"build a meal planner"* (no clone keywords)
3. Hit Send

What user sees today:

- ❌ Single screen rendered (e.g., a Favorites screen)
- ❌ Bottom tab bar visible but tapping any tab shows
  *"No screen wired for 'Home'"*
- ❌ No multi-screen flow

What user should see:

- ✅ Multi-screen app: home + browse + detail + favorites/profile
- ✅ Bottom nav fully wired — every tab navigates to a real screen
- ✅ Visual style inspired by attached references (palette, layout
  language, typography vibe)
- ✅ NOT a literal clone of the references (unless explicitly asked)

## Root cause

`api/generate.ts` has two distinct code paths:

```ts
// Multi-screen pipeline — streams 4-8 screens, wires nav
const appRequest = isAppPrompt(prompt)
  && !imageData          // ← excludes image submissions
  && !editingScreen

// When appRequest is false AND image is attached → falls into
// the single-screen multimodal branch (~line 1568)
if (hasImage) {
  // Returns ONE screen tree, no nav wiring
}
```

The exclusion `!imageData` was historically correct — Mokkoi started as
a screen-design tool where image-attached meant "clone this screen."
Now Mokkoi is an app builder, and users attaching images expect a full
app inspired by them.

## The fix — three coordinated changes

### Change 1: Routing — image + app-prompt + no-clone-intent → multi-screen

In `api/generate.ts` near the `appRequest` declaration:

```ts
// Detect explicit clone intent on the prompt (regex same as the
// reverted fix — keep this regex in a shared const so both routing
// and prompt template use the same source of truth)
const explicitCloneIntent = /\b(clone|recreate|replicate|copy|reproduce|
  pixel[-\s]?(?:perfect|tight|by[-\s]?pixel)|match\s+(?:exactly|pixel)|
  just\s+rebuild|exact(?:ly)?\s+(?:this|the\s+screen))\b/i.test(cleanPrompt)

// Route image submissions to multi-screen pipeline UNLESS user
// explicitly asked for a clone or is editing an existing screen
const appRequest = isAppPrompt(prompt)
  && !editingScreen
  && (!hasImage || !explicitCloneIntent)
```

Effect:
- User attaches images + says "build a meal planner" → multi-screen path
- User attaches 1 image + says "clone this exactly" → single-screen path (preserved)
- User attaches images while editing an existing screen → single-screen path (preserved)

### Change 2: Multi-screen pipeline accepts images

The current `appRequest` pipeline POSTs `{ mode: 'app', prompt, projectId, conversationHistory, deviceId }` to itself and streams back screens. It doesn't pass images to Sonnet.

Find where the `mode: 'app'` Sonnet call is constructed (search for
`'You are an expert mobile app designer'` or similar in api/generate.ts;
the system prompt for app mode lives there). Update the user-message
construction to optionally include image content blocks:

```ts
// In the multi-screen Sonnet call body
const userContent: Array<{type: string; [k: string]: unknown}> = []

if (normalizedImages.length > 0) {
  for (const img of normalizedImages) {
    userContent.push({
      type: 'image',
      source: { type: 'base64', media_type: img.mimeType, data: img.data },
    })
  }
}
userContent.push({ type: 'text', text: appPrompt })
```

Where `appPrompt` is the existing multi-screen system prompt, plus a new
section instructing Sonnet to use the references as inspiration:

```
When the user attaches reference images:
  - Pull from them: color palette, typography, spacing rhythm, layout
    language, mood, iconography style
  - Do NOT clone screen-for-screen
  - Do NOT lift literal text/numbers/names from the images
  - Synthesize ALL attached images into one coherent visual language
  - Build the full multi-screen app structure required by the prompt
```

Note: the multi-screen pipeline likely uses Sonnet's tool-use or a
streaming JSON output already. Don't break that — just ensure the
content array shape is `[image, image, ..., text]` per Anthropic's
multimodal format.

### Change 3: Chat history shows all attached images (display bug)

Today, `ChatMessage.imageData?: string` is singular. When user attaches
4 images, only the first appears in the chat history thumbnail.

Fix in `src/hooks/useAIGeneration.ts`:

```ts
// ChatMessage type:
interface ChatMessage {
  // ...
  imageData?: string         // legacy, single — keep for backward compat
  imageDataList?: string[]   // NEW: all attached images, ordered
}

// In handleSend, when storing the user message:
const userMsg: ChatMessage = {
  // ...
  imageData: images?.[0]?.data,                          // legacy
  imageDataList: images?.map(img => img.data),           // new
}
```

In `ChatPanel.tsx`, render the list when present:

```tsx
{msg.imageDataList && msg.imageDataList.length > 0 ? (
  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
    {msg.imageDataList.map((data, i) => (
      <img key={i} src={`data:image/png;base64,${data}`} ... />
    ))}
  </div>
) : msg.imageData ? (
  <img src={`data:image/png;base64,${msg.imageData}`} ... />
) : null}
```

Backward compat: old messages with only `imageData` still render via
the fallback branch.

## Files to touch

```
api/generate.ts
  - Add explicitCloneIntent regex constant near top of handler
  - Update appRequest condition to include image submissions when
    no explicit clone intent
  - Update the multi-screen pipeline's Sonnet call to accept image
    content blocks
  - Add the inspiration-mode guidance to the multi-screen system
    prompt

src/hooks/useAIGeneration.ts
  - Extend ChatMessage type with imageDataList?: string[]
  - Populate imageDataList when storing user message

src/components/ChatPanel.tsx
  - Render imageDataList when present, fall back to imageData
```

## Verification

1. `npx tsc -b` clean
2. `npm run build` clean
3. **Vercel preview** smoke tests (cannot test on local Vite — backend):

   **Test A — multi-image inspiration:**
   - Attach 4 screenshots from any food/fitness app
   - Prompt: *"build a meal planner"*
   - Expected: multi-screen app (home + browse + detail + favorites),
     bottom nav functional, visual style inspired by references
   - Expected: chat history shows ALL 4 attached images as thumbnails

   **Test B — explicit clone preserved:**
   - Attach 1 screenshot
   - Prompt: *"clone this exactly"*
   - Expected: single-screen pixel-tight clone (existing behavior)

   **Test C — no-image regression:**
   - No images, prompt: *"build a habit tracker"*
   - Expected: multi-screen app, identical to before

   **Test D — bottom nav functional:**
   - From Test A's result, tap each bottom tab
   - Expected: each tab navigates to a real screen with content
   - Expected: NO "No screen wired for 'X'" errors

## Out of scope

- Changing the `appRequest` system prompt's structural decisions
  (multi-screen plan, screen count, etc.) — only adding the
  inspiration-mode guidance for image references
- Multi-image attachment inside the in-chat ScreenshotModal flow
  (that's a separate feature)
- Audio / video reference inputs

## Edge cases to handle

- `images.length > 4` → cap at 4 (UI also enforces; backend defensive
  cap is already in place from Phase F)
- Image too large → already rejected by FE; backend unchanged
- User edits an existing screen with images attached → still goes
  to single-screen path (preserved)
- User attaches images + says "edit this" → routes to edit path,
  not appRequest

## Why this didn't ship in Phase F

Phase F (commit `518cc7e`) was about *infrastructure* — the API
accepts arrays, ChatPanel handles arrays in `handleSend`, etc. It
intentionally didn't change routing because it's a separate concern
and Phase F was already large.

This task closes the loop: now that infra exists, route the right
intent to the right pipeline.

## Related shipped work / docs

- Phase E (`b3b9d69`) — Camera direct file picker
- Phase F (`518cc7e` + `7a3b0c0`) — Multi-image upload + UI consolidation
- Reverted `f9a5d44` (was fix/reference-image-prompt) — prompt-only attempt;
  see `reference-image-prompt-fix.md` for what didn't work and why
