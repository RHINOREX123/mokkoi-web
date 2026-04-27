# Bolt-Style Preview + Canvas Editor Toggle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the project workspace so it defaults to a Bolt-style single-phone preview, with the existing grid view tucked behind a Canvas Editor toggle button.

**Architecture:** Two view modes (`'preview' | 'canvas-editor'`) controlled by App.tsx. Preview mode renders ONE big phone via a new `PreviewPhoneFrame` component, with in-app navigation via existing `FlowConnection`s. Canvas Editor mode renders the existing canvas grid with a darker overlay + EDITOR badge. The top-left hamburger gains a SCREENS section listing entry-point screens. New Canvas Editor button in the top toolbar toggles modes.

**Tech Stack:** React 19, TypeScript, vitest (node env, no RTL), lucide-react, Supabase.

**Spec:** `docs/superpowers/specs/2026-04-27-bolt-preview-canvas-editor-design.md`

---

## File Structure

**New files:**
- `src/utils/entryPointScreens.ts` — pure helper: classify screens as entry points
- `src/utils/__tests__/entryPointScreens.test.ts`
- `src/utils/previewNavigation.ts` — pure helpers: findNavigationTarget, normalizeTrigger
- `src/utils/__tests__/previewNavigation.test.ts`
- `src/hooks/usePreviewNavigation.ts` — thin React wrapper around the pure helpers
- `src/components/PreviewPhoneFrame.tsx` — single-phone Preview-mode component

**Modified files:**
- `src/App.tsx` — add `viewMode` state, conditional render, gate direct-edit on viewMode
- `src/components/TopNavbar.tsx` — add Canvas Editor button + SCREENS section in hamburger

---

## Task 1: Entry-point screen classifier

**Files:**
- Create: `src/utils/entryPointScreens.ts`
- Create: `src/utils/__tests__/entryPointScreens.test.ts`

This is the helper the hamburger SCREENS list will use. Pure function, no React, fully testable in node env.

- [ ] **Step 1: Write failing tests**

```typescript
// src/utils/__tests__/entryPointScreens.test.ts
import { describe, it, expect } from 'vitest'
import { getEntryPointScreens, isTabTrigger } from '../entryPointScreens'
import type { FlowConnection } from '../../components/FlowConnectors'

interface TestScreen { id: string; name: string }

describe('isTabTrigger', () => {
  it('returns true for known tab vocabulary', () => {
    expect(isTabTrigger('Home')).toBe(true)
    expect(isTabTrigger('menu')).toBe(true)
    expect(isTabTrigger('Profile')).toBe(true)
    expect(isTabTrigger('  CART  ')).toBe(true)
    expect(isTabTrigger('Discover')).toBe(true)
  })

  it('returns true for any trigger containing "tab"', () => {
    expect(isTabTrigger('home tab')).toBe(true)
    expect(isTabTrigger('TabBar')).toBe(true)
  })

  it('returns false for deep-link triggers', () => {
    expect(isTabTrigger('Checkout')).toBe(false)
    expect(isTabTrigger('Place Order')).toBe(false)
    expect(isTabTrigger('Add to Cart')).toBe(false)
    expect(isTabTrigger('Buy Now')).toBe(false)
  })

  it('returns false for empty / undefined trigger', () => {
    expect(isTabTrigger(undefined)).toBe(false)
    expect(isTabTrigger('')).toBe(false)
  })
})

describe('getEntryPointScreens', () => {
  const screens: TestScreen[] = [
    { id: 'home', name: 'Home' },
    { id: 'menu', name: 'Menu' },
    { id: 'cart', name: 'Cart' },
    { id: 'checkout', name: 'Checkout' },
    { id: 'tracking', name: 'Order Tracking' },
    { id: 'profile', name: 'Profile' },
  ]

  it('returns tab targets and orphan screens', () => {
    const connections: FlowConnection[] = [
      { fromScreenId: 'home', toScreenId: 'menu', trigger: 'Menu' },
      { fromScreenId: 'home', toScreenId: 'profile', trigger: 'Profile' },
      { fromScreenId: 'menu', toScreenId: 'cart', trigger: 'Add to Cart' },
      { fromScreenId: 'cart', toScreenId: 'checkout', trigger: 'Checkout' },
      { fromScreenId: 'checkout', toScreenId: 'tracking', trigger: 'Place Order' },
    ]
    const result = getEntryPointScreens(screens, connections)
    expect(result.map(s => s.id)).toEqual(['home', 'menu', 'profile'])
  })

  it('always includes the first screen (defensive)', () => {
    // home has only deep-link incoming — but it's screen[0], so include it
    const connections: FlowConnection[] = [
      { fromScreenId: 'menu', toScreenId: 'home', trigger: 'Back' },
    ]
    const result = getEntryPointScreens(screens, connections)
    expect(result.map(s => s.id)).toContain('home')
  })

  it('treats screens with mixed incoming as entry points (tab wins)', () => {
    const connections: FlowConnection[] = [
      { fromScreenId: 'menu', toScreenId: 'cart', trigger: 'Add to Cart' }, // deep-link
      { fromScreenId: 'home', toScreenId: 'cart', trigger: 'Cart' }, // tab — wins
    ]
    const result = getEntryPointScreens(screens, connections)
    expect(result.map(s => s.id)).toContain('cart')
  })

  it('returns all screens when there are no connections', () => {
    const result = getEntryPointScreens(screens, [])
    expect(result.map(s => s.id)).toEqual(['home', 'menu', 'cart', 'checkout', 'tracking', 'profile'])
  })

  it('preserves input order (stable)', () => {
    const connections: FlowConnection[] = [
      { fromScreenId: 'home', toScreenId: 'profile', trigger: 'Profile' },
      { fromScreenId: 'home', toScreenId: 'menu', trigger: 'Menu' },
    ]
    const result = getEntryPointScreens(screens, connections)
    // home is screen[0], menu and profile are tab targets — order matches input
    expect(result.map(s => s.id)).toEqual(['home', 'menu', 'profile'])
  })

  it('returns single screen unchanged for single-screen project', () => {
    const single = [{ id: 'only', name: 'Only Screen' }]
    expect(getEntryPointScreens(single, [])).toEqual(single)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/__tests__/entryPointScreens.test.ts`
Expected: FAIL — module `../entryPointScreens` not found.

- [ ] **Step 3: Implement `entryPointScreens.ts`**

```typescript
// src/utils/entryPointScreens.ts
import type { FlowConnection } from '../components/FlowConnectors'

const TAB_VOCABULARY = new Set([
  'home', 'menu', 'profile', 'feed', 'discover', 'search',
  'cart', 'account', 'settings', 'inbox', 'notifications', 'library', 'tab',
])

/** Returns true if the trigger string represents a bottom-tab navigation
 *  (rather than a deep-link button like "Checkout" or "Place Order"). */
export function isTabTrigger(trigger: string | undefined): boolean {
  if (!trigger) return false
  const normalized = trigger.trim().toLowerCase()
  if (!normalized) return false
  if (TAB_VOCABULARY.has(normalized)) return true
  if (normalized.includes('tab')) return true
  return false
}

/** Returns the subset of screens that are "entry points" — top-level
 *  destinations the user should be able to jump to directly via the
 *  hamburger SCREENS list. A screen is an entry point if it satisfies any of:
 *    1. Reachable from at least one tab-trigger connection
 *    2. Has zero incoming connections (orphan / starting screen)
 *    3. Is screens[0] (defensive — never strand the user)
 *
 *  When a screen has BOTH tab and deep-link incoming edges, the tab
 *  classification wins and it is an entry point.
 *
 *  Output preserves the input `screens` order. */
export function getEntryPointScreens<T extends { id: string }>(
  screens: T[],
  connections: FlowConnection[],
): T[] {
  if (screens.length === 0) return []

  const tabTargets = new Set<string>()
  const allTargets = new Set<string>()
  for (const c of connections) {
    allTargets.add(c.toScreenId)
    if (isTabTrigger(c.trigger)) tabTargets.add(c.toScreenId)
  }

  const firstScreenId = screens[0].id
  return screens.filter(s => {
    if (s.id === firstScreenId) return true     // defensive: always include first
    if (!allTargets.has(s.id)) return true       // orphan: include
    if (tabTargets.has(s.id)) return true        // tab target: include
    return false                                  // deep-link only: exclude
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/__tests__/entryPointScreens.test.ts`
Expected: All 9 tests PASS.

- [ ] **Step 5: Run full suite + typecheck**

Run: `npx vitest run && npx tsc -b`
Expected: 93 + 9 = 102 tests pass; typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/utils/entryPointScreens.ts src/utils/__tests__/entryPointScreens.test.ts
git commit -m "feat(preview): add entry-point screen classifier

Pure helper that returns the subset of screens that should appear
in the hamburger SCREENS list — i.e. top-level destinations
reachable from bottom tabs, plus orphans and the first screen
defensively. Foundation for the new Bolt-style preview mode."
```

---

## Task 2: Preview navigation pure helpers

**Files:**
- Create: `src/utils/previewNavigation.ts`
- Create: `src/utils/__tests__/previewNavigation.test.ts`

Pure logic that the `usePreviewNavigation` hook will wrap. Keeps testable logic out of React.

- [ ] **Step 1: Write failing tests**

```typescript
// src/utils/__tests__/previewNavigation.test.ts
import { describe, it, expect } from 'vitest'
import { findNavigationTarget, normalizeTrigger } from '../previewNavigation'
import type { FlowConnection } from '../../components/FlowConnectors'

describe('normalizeTrigger', () => {
  it('lowercases and trims', () => {
    expect(normalizeTrigger('Checkout')).toBe('checkout')
    expect(normalizeTrigger('  PLACE ORDER  ')).toBe('place order')
  })

  it('collapses internal whitespace', () => {
    expect(normalizeTrigger('Add  to   Cart')).toBe('add to cart')
  })

  it('handles undefined / empty', () => {
    expect(normalizeTrigger(undefined)).toBe('')
    expect(normalizeTrigger('')).toBe('')
  })
})

describe('findNavigationTarget', () => {
  const connections: FlowConnection[] = [
    { fromScreenId: 'home', toScreenId: 'menu', trigger: 'Menu' },
    { fromScreenId: 'menu', toScreenId: 'cart', trigger: 'Add to Cart' },
    { fromScreenId: 'cart', toScreenId: 'checkout', trigger: 'Checkout' },
    { fromScreenId: 'home', toScreenId: 'profile', trigger: 'Profile' },
  ]

  it('finds the matching target screen for the current screen', () => {
    expect(findNavigationTarget(connections, 'home', 'Menu')).toBe('menu')
    expect(findNavigationTarget(connections, 'cart', 'Checkout')).toBe('checkout')
  })

  it('returns null when no connection matches the label', () => {
    expect(findNavigationTarget(connections, 'home', 'Settings')).toBeNull()
  })

  it('returns null when no connection exists from the current screen', () => {
    expect(findNavigationTarget(connections, 'tracking', 'Anything')).toBeNull()
  })

  it('matches case-insensitively and ignores whitespace', () => {
    expect(findNavigationTarget(connections, 'menu', 'add  TO  cart')).toBe('cart')
    expect(findNavigationTarget(connections, 'home', '  MENU  ')).toBe('menu')
  })

  it('returns the first match when multiple connections share a normalized label', () => {
    const ambiguous: FlowConnection[] = [
      { fromScreenId: 'a', toScreenId: 'b', trigger: 'Go' },
      { fromScreenId: 'a', toScreenId: 'c', trigger: 'GO' },
    ]
    expect(findNavigationTarget(ambiguous, 'a', 'go')).toBe('b')
  })

  it('returns null for empty / undefined label', () => {
    expect(findNavigationTarget(connections, 'home', '')).toBeNull()
    expect(findNavigationTarget(connections, 'home', undefined)).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/__tests__/previewNavigation.test.ts`
Expected: FAIL — module `../previewNavigation` not found.

- [ ] **Step 3: Implement `previewNavigation.ts`**

```typescript
// src/utils/previewNavigation.ts
import type { FlowConnection } from '../components/FlowConnectors'

/** Normalize a trigger / button label for comparison: lowercase, trim,
 *  collapse internal whitespace. Keeps matching strict (exact after
 *  normalization) so we don't conflate "Buy" and "Buy Now". */
export function normalizeTrigger(s: string | undefined): string {
  if (!s) return ''
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Given the project's connections, the current screen, and a button
 *  label that was just clicked in the preview, return the target screen
 *  id if there's a matching connection — null otherwise.
 *
 *  Matching: normalize both sides, exact compare. First match wins on
 *  duplicates (rare; ambiguous LLM output). */
export function findNavigationTarget(
  connections: FlowConnection[],
  currentScreenId: string,
  label: string | undefined,
): string | null {
  const target = normalizeTrigger(label)
  if (!target) return null
  for (const c of connections) {
    if (c.fromScreenId !== currentScreenId) continue
    if (normalizeTrigger(c.trigger) === target) return c.toScreenId
  }
  return null
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/__tests__/previewNavigation.test.ts`
Expected: All 11 tests PASS.

- [ ] **Step 5: Run full suite + typecheck**

Run: `npx vitest run && npx tsc -b`
Expected: 102 + 11 = 113 tests pass; typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/utils/previewNavigation.ts src/utils/__tests__/previewNavigation.test.ts
git commit -m "feat(preview): add navigation matching helpers

Pure helpers (normalizeTrigger, findNavigationTarget) that the
preview hook will use to map an in-phone button click to the right
target screen via the existing FlowConnection wirer output."
```

---

## Task 3: usePreviewNavigation hook

**Files:**
- Create: `src/hooks/usePreviewNavigation.ts`

Thin React wrapper around the pure helpers. No tests — logic is in the helpers (already tested), wrapper is plumbing. Manual verification at integration time.

- [ ] **Step 1: Implement the hook**

```typescript
// src/hooks/usePreviewNavigation.ts
import { useState, useCallback } from 'react'
import { findNavigationTarget } from '../utils/previewNavigation'
import type { FlowConnection } from '../components/FlowConnectors'

export interface PreviewNavigation {
  currentScreenId: string
  navigateTo: (screenId: string) => void
  /** Called when the user taps a button inside the preview phone.
   *  Returns true if a navigation occurred (so the caller can suppress
   *  the original click side-effects), false otherwise. */
  handleClick: (label: string | undefined) => boolean
}

/** Manages which screen is currently shown in the Preview-mode phone
 *  frame, and turns in-phone button clicks into screen swaps via the
 *  project's FlowConnection list. */
export function usePreviewNavigation(
  initialScreenId: string,
  connections: FlowConnection[],
): PreviewNavigation {
  const [currentScreenId, setCurrentScreenId] = useState(initialScreenId)

  const navigateTo = useCallback((screenId: string) => {
    setCurrentScreenId(screenId)
  }, [])

  const handleClick = useCallback(
    (label: string | undefined): boolean => {
      const target = findNavigationTarget(connections, currentScreenId, label)
      if (target) {
        setCurrentScreenId(target)
        return true
      }
      return false
    },
    [connections, currentScreenId],
  )

  return { currentScreenId, navigateTo, handleClick }
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc -b`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/usePreviewNavigation.ts
git commit -m "feat(preview): add usePreviewNavigation hook

Thin React wrapper around findNavigationTarget. Tracks the active
screen in Preview mode and turns button-click labels into screen
swaps via the project's FlowConnection list."
```

---

## Task 4: PreviewPhoneFrame component

**Files:**
- Create: `src/components/PreviewPhoneFrame.tsx`

Renders ONE big phone frame in the center of the canvas area. Uses the existing screen-rendering plumbing (the same renderer the canvas grid already uses) but only for the active screen. Intercepts `<button>` and tab-element clicks to call `usePreviewNavigation.handleClick`.

**Locating the existing renderer:** before writing, the implementer should grep for the phone frame currently in use. Likely candidates:
- A component referenced via `phoneFrameRefs` in `useDirectEdit.ts`
- The element with class `phone-screen` (also referenced in useDirectEdit)
- Some `PhoneFrame` or `ScreenRenderer` component used inside the canvas grid in App.tsx

The implementer should reuse it (don't duplicate the device-frame styling, status bar, etc.). PreviewPhoneFrame composes that existing component, but at a larger scale and with a click interceptor.

- [ ] **Step 1: Locate the existing phone-frame component**

Run: `grep -rn "phone-screen\|PhoneFrame\|phoneFrameRefs" src/components/ src/App.tsx | head -20`
Note the component name and props. Report findings before continuing.

- [ ] **Step 2: Implement PreviewPhoneFrame**

```typescript
// src/components/PreviewPhoneFrame.tsx
import { useRef, useEffect, useCallback } from 'react'
import type { FlowConnection } from './FlowConnectors'
import { usePreviewNavigation } from '../hooks/usePreviewNavigation'
// Adjust import to match the existing phone-frame component:
// import { PhoneFrame } from './PhoneFrame'

interface GeneratedScreen {
  id: string
  name: string
  tree: unknown
  deviceId?: string
}

interface PreviewPhoneFrameProps {
  screens: GeneratedScreen[]
  connections: FlowConnection[]
  /** The screen the user is currently viewing in preview. Controlled by App.tsx. */
  activeScreenId: string
  /** Called when in-phone navigation swaps the active screen, so App.tsx can
   *  update its activeGeneratedId for chat-scoping etc. */
  onActiveScreenChange: (screenId: string) => void
  /** When a screen is being generated/regenerated, tab + button navigation
   *  is disabled and a loading indicator overlays the phone. Spec: edge cases. */
  isGenerating?: boolean
}

/** Single big phone frame for Preview mode. Renders the active screen's
 *  tree and intercepts button clicks to perform in-phone navigation via
 *  the project's FlowConnections. */
export function PreviewPhoneFrame({
  screens,
  connections,
  activeScreenId,
  onActiveScreenChange,
  isGenerating = false,
}: PreviewPhoneFrameProps) {
  const nav = usePreviewNavigation(activeScreenId, connections)
  const containerRef = useRef<HTMLDivElement>(null)

  // Sync external activeScreenId → internal nav state if it changes
  // (e.g. user clicks SCREENS in hamburger)
  useEffect(() => {
    if (nav.currentScreenId !== activeScreenId) {
      nav.navigateTo(activeScreenId)
    }
  }, [activeScreenId, nav])

  // Sync internal nav state → external (so chat scoping etc. follows)
  useEffect(() => {
    if (nav.currentScreenId !== activeScreenId) {
      onActiveScreenChange(nav.currentScreenId)
    }
  }, [nav.currentScreenId, activeScreenId, onActiveScreenChange])

  const activeScreen = screens.find(s => s.id === nav.currentScreenId)

  // Intercept button clicks anywhere inside the phone frame.
  // Disabled while a generation is in progress (spec edge case).
  const onClickCapture = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isGenerating) return
      const target = e.target as HTMLElement
      const button = target.closest('button, [role="button"], [data-tab]')
      if (!button) return
      const label = (button.textContent || '').trim()
      const navigated = nav.handleClick(label)
      if (navigated) {
        e.preventDefault()
        e.stopPropagation()
      }
    },
    [nav, isGenerating],
  )

  if (!activeScreen) {
    return (
      <div style={{ padding: 40, color: '#94a3b8', textAlign: 'center' }}>
        No screen to preview yet — generate one to get started.
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      onClickCapture={onClickCapture}
      style={{
        position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '100%', height: '100%', padding: 24,
      }}
    >
      {/* Reuse the existing phone-frame component here. Substitute the import
          and JSX based on what Step 1 reveals. Example shape: */}
      {/* <PhoneFrame
            tree={activeScreen.tree}
            deviceId={activeScreen.deviceId}
            scale={1.4}
          /> */}

      {/* Loading overlay during generation. Sits above the rendered tree
          and blocks tab navigation visually (clicks are also gated above). */}
      {isGenerating && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(2px)',
          color: '#e2e8f0', fontSize: 13, fontWeight: 500,
          zIndex: 10,
        }}>
          Generating…
        </div>
      )}
    </div>
  )
}
```

The implementer should slot in the actual existing PhoneFrame / ScreenRenderer reference. If the existing component is tightly coupled to the canvas grid (e.g. it has positioning props for the grid layout), extract a smaller "render just the screen content into a phone shell" primitive — but only if necessary; reuse whenever possible.

- [ ] **Step 3: Verify typecheck (no runtime test yet — manual verification at Task 5)**

Run: `npx tsc -b`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/PreviewPhoneFrame.tsx
git commit -m "feat(preview): add PreviewPhoneFrame component

Renders one big phone in Preview mode, reusing the existing screen
renderer. onClickCapture intercepts button clicks and uses
usePreviewNavigation to swap screens when the click matches a
FlowConnection trigger."
```

---

## Task 5: viewMode state in App.tsx

**Files:**
- Modify: `src/App.tsx`

Add the mode switch and conditional render. After this task, the new Preview Mode is visible (default) but there's no way to toggle to Canvas Editor yet — that's Task 6. To verify intermediate progress, the implementer can temporarily hard-code `viewMode = 'canvas-editor'` to confirm the existing canvas grid still renders, then revert.

- [ ] **Step 1: Read App.tsx to locate the canvas-grid render block**

Read the project page section of App.tsx. Find the JSX block that renders the canvas with all phone frames (search for `phoneFrameRefs`, `generatedScreens.map`, or similar). Note its current structure and surrounding state.

- [ ] **Step 2: Add viewMode state**

Near the other useState declarations in the project page component:

```typescript
// 'preview' = single Bolt-style phone (default).
// 'canvas-editor' = existing grid-of-phones view, dark overlay + EDITOR badge.
const [viewMode, setViewMode] = useState<'preview' | 'canvas-editor'>('preview')
const toggleViewMode = useCallback(() => {
  setViewMode(m => m === 'preview' ? 'canvas-editor' : 'preview')
}, [])
```

- [ ] **Step 3: Add conditional render**

Wrap the existing canvas-grid JSX block in a `{viewMode === 'canvas-editor' && ( ... )}` conditional. Add the Preview render alongside:

```tsx
{viewMode === 'preview' && (
  <PreviewPhoneFrame
    screens={screens.generatedScreens.filter(s => s.tree)}
    connections={screens.connections}
    activeScreenId={screens.activeGeneratedId || ''}
    onActiveScreenChange={screens.setActiveGeneratedId}
    isGenerating={screens.isGenerating /* or whatever the existing flag is named */}
  />
)}
{viewMode === 'canvas-editor' && (
  <>
    {/* existing canvas-grid JSX unchanged */}
  </>
)}
```

If the canvas grid block exceeds ~50 lines after this change, extract it to `src/components/CanvasGridView.tsx` with a clear interface (props for screens, refs, handlers). Do this as part of this task; don't leave a 200-line ternary in App.tsx.

- [ ] **Step 4: Add the import**

```typescript
import { PreviewPhoneFrame } from './components/PreviewPhoneFrame'
```

- [ ] **Step 5: Verify typecheck + tests**

Run: `npx tsc -b && npx vitest run`
Expected: clean; 113 tests pass.

- [ ] **Step 6: Manual smoke test**

Start dev server (`npm run dev`), open a project, confirm:
- Default view is the new PreviewPhoneFrame (one big phone)
- Temporarily hard-code `viewMode = 'canvas-editor'` to confirm grid still renders correctly
- Revert to default `'preview'`

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx [src/components/CanvasGridView.tsx if extracted]
git commit -m "feat(preview): wire viewMode state + conditional render

Project page now defaults to Preview mode showing PreviewPhoneFrame.
Canvas-editor mode renders the existing grid (no toggle UI yet —
Task 6). Extracted CanvasGridView to keep App.tsx readable [if done]."
```

---

## Task 6: Canvas Editor toggle button in TopNavbar

**Files:**
- Modify: `src/components/TopNavbar.tsx`
- Modify: `src/App.tsx` (pass viewMode + toggleViewMode props)

- [ ] **Step 1: Add props to TopNavbar interface**

Find the TopNavbar props interface and add:

```typescript
viewMode: 'preview' | 'canvas-editor'
onToggleViewMode: () => void
```

- [ ] **Step 2: Add Canvas Editor button in the action row**

Locate the action button row in TopNavbar.tsx (where Export, Preview, Share live). Insert between Preview and Share:

```tsx
import { Layers } from 'lucide-react'  // add to existing lucide-react import

<button
  onClick={onToggleViewMode}
  title={viewMode === 'canvas-editor' ? 'Back to preview' : 'Open canvas editor'}
  style={{
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '7px 12px', borderRadius: 8,
    background: viewMode === 'canvas-editor'
      ? 'linear-gradient(135deg, #6366f1, #818cf8)'
      : 'transparent',
    border: viewMode === 'canvas-editor' ? 'none' : '1px solid rgba(255,255,255,0.12)',
    color: viewMode === 'canvas-editor' ? '#fff' : '#e2e8f0',
    fontSize: 13, fontWeight: 500, cursor: 'pointer',
    transition: 'background 0.15s',
  }}
>
  <Layers size={14} />
  Canvas Editor
</button>
```

- [ ] **Step 3: Wire it up in App.tsx**

Pass the new props down to TopNavbar:

```tsx
<TopNavbar
  /* existing props */
  viewMode={viewMode}
  onToggleViewMode={toggleViewMode}
/>
```

- [ ] **Step 4: Add ESC-to-exit-canvas-editor handler**

Per the spec: "ESC also exits if no popover is open." In App.tsx, add an effect that listens for Escape and flips back to preview — but ONLY when in canvas-editor mode and nothing in `useDirectEdit` would consume the Escape itself (i.e. `directEdit.directEditMode` is false). The direct-edit hook already owns Escape while editing; we don't want to fight it.

```tsx
useEffect(() => {
  if (viewMode !== 'canvas-editor') return
  // If direct-edit is active, useDirectEdit handles Escape itself
  // (deselect → exit edit mode). Don't double-handle.
  if (directEdit.directEditMode) return
  const handler = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return
    const active = document.activeElement as HTMLElement | null
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return
    setViewMode('preview')
  }
  document.addEventListener('keydown', handler)
  return () => document.removeEventListener('keydown', handler)
}, [viewMode, directEdit.directEditMode])
```

- [ ] **Step 5: Verify typecheck + tests**

Run: `npx tsc -b && npx vitest run`
Expected: clean; 113 tests pass.

- [ ] **Step 6: Manual smoke test**

In dev: click [Canvas Editor] in the top bar. Verify view flips to grid. Click again. Verify it flips back to single phone. Active state styling visible only in canvas-editor mode. Press ESC while in canvas-editor mode (with no element selected and no input focused) — should flip back to preview.

- [ ] **Step 7: Commit**

```bash
git add src/components/TopNavbar.tsx src/App.tsx
git commit -m "feat(preview): add Canvas Editor toggle button to top bar

New button between Preview and Share. Click toggles viewMode
between preview and canvas-editor, with active-state styling
when in canvas-editor mode. ESC also exits canvas-editor mode
(yields to direct-edit hook when an element is being edited)."
```

---

## Task 7: SCREENS section in hamburger menu

**Files:**
- Modify: `src/components/TopNavbar.tsx`
- Modify: `src/App.tsx` (pass screens + active id + setter)

- [ ] **Step 1: Add props for screens**

In TopNavbar props interface:

```typescript
entryPointScreens: Array<{ id: string; name: string }>
activeScreenId: string | null
onSelectScreen: (screenId: string) => void
```

- [ ] **Step 2: Render SCREENS section at top of hamburger dropdown**

In TopNavbar.tsx, locate the hamburger dropdown JSX (the block guarded by `showHamburgerMenu`). Insert AT THE TOP of the dropdown content, before the existing "Home" button:

```tsx
{entryPointScreens.length > 0 && (
  <>
    <div style={{
      padding: '8px 12px 4px',
      fontSize: 10, fontWeight: 700, letterSpacing: 0.6,
      color: '#94a3b8', textTransform: 'uppercase',
    }}>
      Screens
    </div>
    {entryPointScreens.map(s => {
      const isActive = s.id === activeScreenId
      return (
        <button
          key={s.id}
          onClick={() => { onSelectScreen(s.id); setShowHamburgerMenu(false) }}
          style={{
            ...hamburgerItemStyle,
            background: isActive ? 'rgba(129,140,248,0.15)' : undefined,
            color: isActive ? '#a5b4fc' : '#e2e8f0',
            fontWeight: isActive ? 600 : 500,
          }}
        >
          {isActive && <span style={{ marginRight: 6 }}>►</span>}
          {s.name}
        </button>
      )
    })}
    <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '6px 8px' }} />
  </>
)}
```

- [ ] **Step 3: Wire it up in App.tsx**

```tsx
import { getEntryPointScreens } from './utils/entryPointScreens'

// Inside the component, near other derived values:
const entryPointScreens = useMemo(
  () => getEntryPointScreens(
    screens.generatedScreens.filter(s => s.tree),
    screens.connections,
  ),
  [screens.generatedScreens, screens.connections],
)

// Pass to TopNavbar:
<TopNavbar
  /* existing props */
  entryPointScreens={entryPointScreens.map(s => ({ id: s.id, name: s.name }))}
  activeScreenId={screens.activeGeneratedId}
  onSelectScreen={screens.setActiveGeneratedId}
/>
```

- [ ] **Step 4: Verify typecheck + tests**

Run: `npx tsc -b && npx vitest run`
Expected: clean; 113 tests pass.

- [ ] **Step 5: Manual smoke test**

Open hamburger menu. Verify SCREENS section at top with entry-point screens listed. Click one — preview swaps. Active screen shows ► marker. Cart, Checkout, Tracking should NOT be in the list (they're deep-link).

- [ ] **Step 6: Commit**

```bash
git add src/components/TopNavbar.tsx src/App.tsx
git commit -m "feat(preview): add SCREENS section to hamburger menu

Top of the existing hamburger now shows entry-point screens
(Home/Menu/Profile-style top-level destinations only — Cart,
Checkout, Tracking reached by tapping in-app). Active screen
highlighted; click swaps the preview."
```

---

## Task 8: Dark overlay + EDITOR badge in canvas-editor mode

**Files:**
- Modify: `src/App.tsx` (or `CanvasGridView.tsx` if extracted in Task 5)

- [ ] **Step 1: Wrap the canvas-editor grid in a tinted container**

In the `viewMode === 'canvas-editor'` render block, wrap the canvas grid in a positioned container:

```tsx
{viewMode === 'canvas-editor' && (
  <div style={{ position: 'relative', width: '100%', height: '100%' }}>
    {/* Dark overlay tint — non-interactive (pointer-events: none) so it
        doesn't block canvas interactions underneath */}
    <div style={{
      position: 'absolute', inset: 0,
      background: 'rgba(0,0,0,0.18)',
      pointerEvents: 'none',
      zIndex: 1,
    }} />
    {/* EDITOR badge — top right corner of canvas area */}
    <div style={{
      position: 'absolute', top: 16, right: 16,
      padding: '4px 10px', borderRadius: 6,
      background: 'linear-gradient(135deg, #6366f1, #818cf8)',
      color: '#fff', fontSize: 10, fontWeight: 700,
      letterSpacing: 0.8, textTransform: 'uppercase',
      boxShadow: '0 4px 12px rgba(99,102,241,0.4)',
      zIndex: 2,
    }}>
      Editor
    </div>
    {/* existing canvas grid JSX */}
  </div>
)}
```

- [ ] **Step 2: Verify typecheck + tests**

Run: `npx tsc -b && npx vitest run`
Expected: clean; 113 tests pass.

- [ ] **Step 3: Manual smoke test**

Toggle to Canvas Editor mode. Verify dark tint visible over canvas, EDITOR badge in top-right corner. Click an element — direct edit toolbar still appears (overlay shouldn't block clicks).

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(preview): visual signal for canvas-editor mode

Adds rgba(0,0,0,0.18) overlay + EDITOR badge in the top-right of
the canvas area when in canvas-editor mode. Non-interactive overlay
so editor tools still work."
```

---

## Task 9: Gate direct-edit on viewMode

**Files:**
- Modify: `src/App.tsx`

In Preview mode, clicking elements should do nothing (it's a viewer). Direct-edit click handlers must be gated.

- [ ] **Step 1: Identify direct-edit handler attachment points**

In App.tsx, find where `useDirectEdit` is consumed and where its handlers (`handleDirectEditClick`, `handleDirectEditHover`, `handleDirectEditHoverOut`) are attached to phone frames. They're likely passed as `onClick`/`onMouseOver` to the canvas-grid JSX.

- [ ] **Step 2: Gate the handlers**

Wrap the handler calls so they only fire in canvas-editor mode:

```tsx
onClick={(e) => {
  if (viewMode !== 'canvas-editor') return
  directEdit.handleDirectEditClick(e, screen.id)
}}
```

Apply the same `viewMode` check to hover handlers too.

Alternatively: only attach the handlers conditionally:

```tsx
{...(viewMode === 'canvas-editor' && {
  onClick: (e) => directEdit.handleDirectEditClick(e, screen.id),
  onMouseOver: directEdit.handleDirectEditHover,
  onMouseOut: directEdit.handleDirectEditHoverOut,
})}
```

Pick whichever is cleaner with the existing handler shape. The first approach is safer if the handlers are referenced in multiple places.

- [ ] **Step 3: Also gate enterDirectEdit availability**

If there's a "Direct Edit" button in the canvas bottom toolbar, hide it (or disable it) when `viewMode === 'preview'`:

```tsx
{viewMode === 'canvas-editor' && (
  <button onClick={directEdit.enterDirectEdit}>Direct Edit</button>
)}
```

- [ ] **Step 4: Verify typecheck + tests**

Run: `npx tsc -b && npx vitest run`
Expected: clean; 113 tests pass.

- [ ] **Step 5: Manual smoke test**

In Preview mode: click any element on the phone — nothing should happen except in-app navigation if it matched a connection. No toolbar appears.

In Canvas Editor mode: click any element — direct-edit toolbar appears as before. Type/Style/Color/Move/Delete/Ask Mokkoi all work.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat(preview): gate direct-edit on canvas-editor mode

Direct-edit click + hover handlers only fire when viewMode is
canvas-editor. Preview mode is read-only — clicks only trigger
in-app navigation, never the editor toolbar."
```

---

## Final Step: Merge to main

After all 9 tasks pass:

- [ ] Run full suite + typecheck once more: `npx vitest run && npx tsc -b`
- [ ] Take screenshots of both modes for the commit log / future reference
- [ ] Merge feature branch to main with `--no-ff` and a summary message:

```bash
git checkout main
git merge <feature-branch> --no-ff -m "Merge: Bolt-style preview + Canvas Editor toggle

Default project view is now a single big phone simulating the app
(Preview mode). The existing grid-of-screens lives behind a Canvas
Editor toggle button with dark overlay + EDITOR badge. Hamburger
menu gained a SCREENS section listing entry-point screens. All
direct-edit and visual editing tools gated to canvas-editor mode.

Spec: docs/superpowers/specs/2026-04-27-bolt-preview-canvas-editor-design.md"

git push origin main
```

- [ ] Verify Vercel deploy succeeds.
- [ ] Sahil-test: open an existing project, generate a new one, exercise both modes.

---

## Remember
- DRY, YAGNI, TDD where the test infra supports it (helpers), manual verification where it doesn't (components).
- Frequent commits — one per task.
- If a task balloons in scope mid-implementation, stop and surface to the controller; don't quietly expand.
- The existing 93 tests must keep passing after every task.
