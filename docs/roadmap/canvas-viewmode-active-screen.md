# Canvas viewMode toggle drops active screen

**Status:** `idea` — small UX polish, low priority
**Estimated effort:** 15-30 minutes
**Owner:** unassigned

## The bug

When a user toggles between Phone view and Canvas Editor view on a
built project (`viewMode: 'preview'` ↔ `'canvas-editor'`), the
`activeGeneratedId` state (which screen is currently rendered in the
phone frame) gets cleared. Result: returning to Phone view shows an
empty phone frame with "No screens... Waiting for tree..." text.

Tapping any screen chip in the left panel re-sets `activeGeneratedId`
and the screen renders correctly. Workaround works but feels broken.

Spotted by user (Sahil) on 2026-05-07 after testing Plan mode (commit
`b29319f`). Not a Plan-mode regression — pre-existing on any built
project.

## Repro

1. Have a built project with multiple screens (any project works)
2. Click **Canvas Editor** in the navbar (top right)
3. Click back to phone view (the icon next to it)
4. Observe: phone frame is empty, "No screens... Waiting for tree..."
5. Tap any screen chip in the left chat panel → screen renders

## Root cause hypothesis

Either:
- The viewMode toggle effect clears `activeGeneratedId` somewhere
- Phone view default-renders the active screen but treats `null`
  active as "no screens", instead of falling back to first screen

## Suggested fix

In `src/App.tsx` (where viewMode state lives) or wherever the
viewMode-toggle effect runs:

```ts
// When returning to preview mode from canvas-editor, fall back to
// the first generated screen if no active selection survived.
useEffect(() => {
  if (viewMode === 'preview' && !screens.activeGeneratedId && screens.generatedScreens.length > 0) {
    screens.setActiveGeneratedId(screens.generatedScreens[0].id)
  }
}, [viewMode, screens.activeGeneratedId, screens.generatedScreens])
```

Better: preserve the previous activeGeneratedId in a ref before the
toggle and restore it on return.

## Out of scope

- Plan mode UX (separate concern, already shipped)
- Any change to how chips select screens (works fine)
