# Bolt-Style Preview + Canvas Editor Toggle — Design

## Goal

Convert the project workspace from "design canvas first" to "real app first." When a user opens a project, they should see one big phone simulating the app they generated — taps work, navigation flows — not a row of segregated phone frames. The canvas grid still exists, but lives behind a deliberate **Canvas Editor** toggle so it feels like opting into a "workshop mode."

## Why this matters

Today, opening a project shows N screens laid out side by side. New users don't intuit "I built an app" — they see "I generated some screens." Bolt's single-device preview is the dominant mental model for AI app builders. By matching it, Mokkoi feels like an app builder rather than a screen designer. The grid view stays valuable for editing many screens at once, but it's no longer the front door.

## Two modes

### Preview Mode (default after generate; default on project open)

- **Layout:** chat panel on left (unchanged), one big phone frame in the center of the canvas area, no extra chrome on the right.
- **Phone behavior:** active screen renders inside the frame. Tapping a `<button>` whose label matches a `FlowConnection.trigger` for the active screen swaps the rendered screen to `connection.toScreenId`. Bottom-tab buttons navigate the same way (the existing `wirer` already produces these connections).
- **Hamburger menu (top-left, existing):** gains a `SCREENS` section at the top listing entry-point screens (definition below). Clicking one swaps the active screen. The existing project-management items (Home, Pricing, Edit, Export, Share, Delete) stay below a divider.
- **Top toolbar:** unchanged, except a new **[Canvas Editor]** button is added between **Preview** and **Share**. Existing **Preview** button (opens `/preview/:projectId/:screenId` in a new tab) keeps its current behavior — it's a fullscreen / shareable preview, separate from the in-app Preview mode.

### Canvas Editor Mode (opt-in via the new top-bar button)

- **Layout:** the existing canvas grid renders as it does today — all screens visible side by side, current pan/zoom/select behavior intact.
- **Visual signal:** the canvas background gets a darker overlay (`rgba(0,0,0,0.18)` over the existing canvas BG) and a small **EDITOR** badge in the top-right of the canvas area, so the user feels they entered a different mode.
- **The [Canvas Editor] button in the top toolbar** shows an active state (filled indigo background) while in this mode.
- **All editing tools** (Direct Edit, the floating Type/Style/Color/Move/Delete/Ask Mokkoi toolbar, Add Image, Code, Snack share) only work in this mode. In Preview mode, clicking an element does nothing — it's a viewer.
- **Exit:** click [Canvas Editor] again to flip back to Preview Mode. ESC also exits if no popover is open.

## Entry-point screens

The hamburger SCREENS list shouldn't include every screen — Cart, Checkout, Order Tracking are reached by tapping in-app buttons, not by jumping to them directly. Listing every screen reproduces the "segregated screens" feel we're moving away from.

**Definition:** a screen is an entry point if it satisfies ANY of:
1. It is the target of at least one tab-trigger connection, OR
2. It has zero incoming connections, OR
3. It is the project's first screen (defensive: always include screen[0] as an entry point so the user is never stranded).

**Tab-trigger detection:** a `FlowConnection.trigger` is classified as a tab trigger when its lowercased value matches one of: `home`, `menu`, `profile`, `feed`, `discover`, `search`, `cart`, `account`, `settings`, `inbox`, `notifications`, `library`, `tab`, or contains the substring `tab`. (These are the labels the wirer already produces for bottom-tab buttons; we lift them here.) Anything else (e.g. "Checkout", "Place Order", "Add to Cart") is a deep-link trigger.

**Mixed incoming edges:** if a screen receives BOTH a tab-trigger and a deep-link-trigger incoming connection, **the tab classification wins** — it is an entry point. (Reasoning: the tab makes it directly reachable from the app's nav, regardless of any deep-link path that also exists.)

**Implementation:** a single pure helper `getEntryPointScreens(screens, connections)` walks the connection list once, builds a Set of `toScreenId`s reachable from tab triggers, and returns the screens whose ids satisfy any of the three criteria above. Stable order: same as `screens` input array.

**Fallback:** if a project has zero connections (older projects pre-wirer or single-screen apps), all screens are treated as entry points.

## Components & files

### New

- **`src/components/PreviewPhoneFrame.tsx`** — single large phone frame that renders one screen at a time. Wraps the existing tree renderer. Intercepts clicks on `<button>` and tab elements and consults `usePreviewNavigation` to decide whether to navigate.

- **`src/hooks/usePreviewNavigation.ts`** — manages preview-only navigation state: which screen is currently shown, plus a small history stack so back navigation works (future). Exposes `currentScreenId`, `navigateTo(screenId)`, and `handleClick(buttonLabel)` which looks up `FlowConnection`s for the current screen and finds a match.
  **Trigger matching:** `handleClick` normalizes both the button label and `connection.trigger` by lowercasing and collapsing whitespace, then does an exact match. No partial / fuzzy match — too risky given LLM-generated buttons can have similar labels with different destinations ("Buy" vs "Buy Now"). If multiple connections from the current screen match the same normalized label, take the first.

- **`src/utils/entryPointScreens.ts`** — pure function `getEntryPointScreens(screens: GeneratedScreen[], connections: FlowConnection[]): GeneratedScreen[]`. Easily unit-tested against fixtures.

### Modified

- **`src/App.tsx`** — adds `viewMode: 'preview' | 'canvas-editor'` state (default `'preview'`). Conditionally renders `<PreviewPhoneFrame>` or the existing canvas grid based on `viewMode`. Wires the new Canvas Editor button into TopNavbar via a callback.
  **State scope:** the state lives in the project page component. When the user navigates between projects within the SPA, the project page unmounts and remounts → `viewMode` resets to `'preview'` for each project visit. There is no global mode store.

- **`src/components/TopNavbar.tsx`** —
  1. Adds the **[Canvas Editor]** toggle button in the action row (between Preview and Share). Active-state styling when `viewMode === 'canvas-editor'`.
  2. Inserts the `SCREENS` section at the top of the hamburger menu, sourced from `getEntryPointScreens`. Active screen highlighted. Clicking calls `setActiveGeneratedId` (already passed in).

- **Canvas wrapper** (likely the JSX block in `App.tsx` that renders the existing screen grid; if it grows beyond ~30 lines, extract into `src/components/CanvasGridView.tsx`) — accepts a `viewMode` prop and applies the dark overlay + EDITOR badge when in canvas-editor mode. Direct-edit handlers gated on `viewMode === 'canvas-editor'`.

## Data flow

```
User opens project
   ↓
App.tsx: viewMode = 'preview'  (default)
   ↓
useScreenManagement loads screens + connections from Supabase
   ↓
getEntryPointScreens(screens, connections) → entry-point list
   ↓
PreviewPhoneFrame renders activeGenerated.tree
   ↓
User taps a button inside the phone
   ↓
usePreviewNavigation.handleClick(label):
   - Find connection where fromScreenId === currentScreenId AND trigger matches label
   - If found: setActiveGeneratedId(connection.toScreenId)
   - If not: no-op
   ↓
Re-render with new active screen
```

```
User clicks [Canvas Editor] button
   ↓
App.tsx: viewMode = 'canvas-editor'
   ↓
PreviewPhoneFrame unmounts; canvas grid renders with dark overlay + EDITOR badge
   ↓
User clicks element → existing useDirectEdit triggers (now gated on viewMode)
   ↓
User clicks [Canvas Editor] again
   ↓
viewMode = 'preview' → unmount canvas grid, mount PreviewPhoneFrame
```

## Edge cases

- **No connections data (old projects).** `getEntryPointScreens` returns all screens. Bottom-tab navigation in preview becomes no-op (graceful), but the hamburger SCREENS list still works as a manual switcher.
- **Single-screen project.** Only one entry-point. Hamburger SCREENS section still renders for consistency. No tab navigation needed.
- **Active screen is a deep-link screen** (e.g. user was last on Order Tracking before reload). On project load, if `activeGenerated` is not in entry-points, we keep showing it (don't force-jump to Home) — but the hamburger still highlights nothing in SCREENS. User can navigate via hamburger or back-tap.
- **Generation in progress.** While a screen is being generated/regenerated, the phone frame shows a loading indicator over the active screen (reuse existing `isGenerating` state). Tab navigation disabled during generation.
- **Mode persistence.** Always default to Preview on project page mount. We do NOT persist mode in localStorage — every visit starts in Preview, matching "the app comes first." User can flip mode any time.

## Non-goals (explicitly out of scope for this design)

- **Swipe up/down between screens.** The earlier conversation flagged this. Real apps don't have it; tap navigation is sufficient. Defer to a Phase 2 spec if user feedback demands it.
- **Renaming the existing Preview button** to reduce naming overlap with the new Preview *mode*. The button keeps its current behavior (open shareable URL in new tab). If the overlap confuses users, address in a follow-up.
- **Per-project mode persistence.** Always default to Preview.
- **Back button / preview history navigation.** `usePreviewNavigation` exposes the hook for it, but no UI for it in V1. Phase 2.
- **Direct-edit auto-save fix.** Already flagged as a separate task chip. Out of scope here.
- **Phase 2 visual edit controls** (image picker, icon picker, duplicate, reorder). Separate spec.

## Testing

- **`getEntryPointScreens`** — unit tests with fixtures: tab-only navigation, mixed tab + deep-link, no connections, single screen, screens with multiple incoming connections.
- **`usePreviewNavigation`** — unit tests: navigateTo updates current, handleClick finds matching connection, handleClick returns false when no match.
- **`PreviewPhoneFrame`** — RTL component tests: clicking a button with a known trigger calls navigateTo with the right target; clicking a button with no connection is a no-op.
- **TopNavbar** — RTL tests: SCREENS section renders entry-point screens; clicking a screen calls setActiveGeneratedId; Canvas Editor button toggles viewMode via the callback.
- **App.tsx integration** — smoke test: viewMode toggles between rendering PreviewPhoneFrame and the canvas grid.

Existing 93-test suite must still pass.

## Risk: scope creep on `App.tsx`

`App.tsx` is already large. This change adds `viewMode` state and a conditional renderer block. If the canvas grid block currently embedded in `App.tsx` is more than ~50 lines, extract it into `CanvasGridView.tsx` as part of this work — keep `App.tsx` as the orchestrator, push render specifics down. This is targeted refactoring (the file is being touched anyway), not unrelated cleanup.
