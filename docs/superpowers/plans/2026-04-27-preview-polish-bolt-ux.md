# Preview Polish + Bolt UX Adoption Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three regressions in the freshly-shipped Bolt-style preview/canvas-editor toggle (phone overflows viewport, modes look identical, generation errors leak raw model output) and adopt Bolt's preview chrome (device picker, zoom %, dimensions, actions).

**Architecture:** Replace the rgba(0,0,0,0.18) overlay with mode-specific surface colors (preview = off-white, canvas-editor = indigo-tinted dotted). Add a `PreviewToolbar` component above `PreviewPhoneFrame` matching Bolt's shape. Auto-fit the phone via ResizeObserver + CSS transform with manual zoom override. Harden the streaming generation path so unclosed `<design_brief>` tags or brief-only outputs degrade gracefully, and map the resulting backend error to a friendly chat message client-side.

**Tech Stack:** React 19 + Vite + TypeScript with `verbatimModuleSyntax`, Vitest (`environment: 'node'`), no Tailwind (inline styles), lucide-react icons.

---

## Pre-Flight Checks (do once before Task 1)

- [ ] Confirm tests baseline passes: `npm test -- --run` → expect "Tests  113 passed"
- [ ] Confirm typecheck baseline passes: `npx tsc -b --noEmit` → expect zero errors
- [ ] Confirm we are on `worktree-preview-polish-bolt-ux` branch: `git branch --show-current`

---

## File Structure

| File | Status | Responsibility |
|------|--------|---------------|
| `src/components/PreviewPhoneFrame.tsx` | Modify | Add ResizeObserver + transform scale; drop fixed padding |
| `src/components/PreviewToolbar.tsx` | **Create** | Bolt-style toolbar: device dropdown, zoom %, dimensions, refresh |
| `src/utils/computeFitScale.ts` | **Create** | Pure helper: compute fit-to-container scale (TDD-able) |
| `src/utils/__tests__/computeFitScale.test.ts` | **Create** | Tests for the helper |
| `src/App.tsx` | Modify | Drop overlay tint; mode-specific surface colors; render PreviewToolbar in preview mode |
| `src/hooks/useAIGeneration.ts` | Modify | Map "AI returned invalid JSON" backend error → friendly chat message |
| `api/generate.ts` | Modify | Stream path: handle empty `jsonText` after extracting brief; tolerant fallback when closing tag missing |

**Out-of-scope** for this plan (mention only if user asks):
- The "external", "mirror", "fullscreen", "QR" icon actions Bolt has — we'll add a refresh button only; the rest are stubs for a future plan
- Replacing `#E8E8E8` everywhere — we change it only for canvas-editor mode

---

## Color Decisions (locked)

| Mode | `background` | `backgroundImage` | `backgroundSize` |
|------|-------------|-------------------|------------------|
| `preview` | `#FAFAFA` | `none` | — |
| `canvas-editor` | `#EEF0FA` | `radial-gradient(circle, rgba(99,102,241,0.22) 1px, transparent 1px)` | `20px 20px` |

Brand color `#6366f1` carries through to the canvas-editor dots. Dotted radial-gradient origin tracks `canvas.panOffset` exactly as today (`backgroundPosition: ${panOffset.x}px ${panOffset.y}px`).

---

### Task 1: `computeFitScale` helper (pure, TDD)

**Files:**
- Create: `src/utils/computeFitScale.ts`
- Test: `src/utils/__tests__/computeFitScale.test.ts`

The helper takes the device's intrinsic size, the container's available size, and a manual zoom (or null for auto-fit), and returns the final scale to apply via CSS `transform: scale(...)`. This is the only piece with non-trivial logic — pure helper means we get fast confidence on edge cases (zero container, manual zoom higher than fit).

- [ ] **Step 1: Write failing tests**

```ts
// src/utils/__tests__/computeFitScale.test.ts
import { describe, it, expect } from 'vitest'
import { computeFitScale } from '../computeFitScale'

describe('computeFitScale', () => {
  const device = { w: 393, h: 852 }   // iPhone Standard

  describe('auto-fit (manualZoom = null)', () => {
    it('returns 0.92*min(W/dw, H/dh) when container is smaller than device', () => {
      const s = computeFitScale({ container: { w: 600, h: 600 }, device, manualZoom: null })
      // height is the binding axis: 600/852 = 0.704 → * 0.92 = 0.648
      expect(s).toBeCloseTo(0.648, 3)
    })

    it('caps at 1.0 — never upscales past device pixel size', () => {
      const s = computeFitScale({ container: { w: 2000, h: 2000 }, device, manualZoom: null })
      expect(s).toBe(1)
    })

    it('returns 0 when container has zero area (avoids NaN)', () => {
      expect(computeFitScale({ container: { w: 0, h: 600 }, device, manualZoom: null })).toBe(0)
      expect(computeFitScale({ container: { w: 600, h: 0 }, device, manualZoom: null })).toBe(0)
    })
  })

  describe('manual zoom override', () => {
    it('returns manualZoom when set and within bounds', () => {
      const s = computeFitScale({ container: { w: 2000, h: 2000 }, device, manualZoom: 0.5 })
      expect(s).toBe(0.5)
    })

    it('clamps manual zoom to [0.25, 2.0]', () => {
      const lo = computeFitScale({ container: { w: 2000, h: 2000 }, device, manualZoom: 0.1 })
      const hi = computeFitScale({ container: { w: 2000, h: 2000 }, device, manualZoom: 5 })
      expect(lo).toBe(0.25)
      expect(hi).toBe(2)
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/utils/__tests__/computeFitScale.test.ts`
Expected: FAIL with "Cannot find module" or similar.

- [ ] **Step 3: Implement the helper**

```ts
// src/utils/computeFitScale.ts

export interface FitScaleArgs {
  container: { w: number; h: number }
  device: { w: number; h: number }
  /** When non-null, overrides auto-fit. Clamped to [MIN, MAX]. */
  manualZoom: number | null
}

export const FIT_PADDING = 0.92
export const MIN_ZOOM = 0.25
export const MAX_ZOOM = 2

/** Compute the CSS transform scale to apply to the phone frame.
 *  - Auto-fit: 0.92 * min(containerW/deviceW, containerH/deviceH), capped at 1
 *  - Manual:   user-supplied zoom, clamped to [0.25, 2]
 *  - Zero container area returns 0 to avoid NaN/Infinity propagation. */
export function computeFitScale({ container, device, manualZoom }: FitScaleArgs): number {
  if (manualZoom !== null) {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, manualZoom))
  }
  if (container.w <= 0 || container.h <= 0) return 0
  const fit = Math.min(container.w / device.w, container.h / device.h) * FIT_PADDING
  return Math.min(1, fit)
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- --run src/utils/__tests__/computeFitScale.test.ts`
Expected: PASS — all 6 tests green.

- [ ] **Step 5: Run full test suite to confirm no regressions**

Run: `npm test -- --run`
Expected: 122 passed (113 existing + 9 new — split-out clamp tests + bound + zero-zoom + width-axis cases).

- [ ] **Step 6: Commit**

```bash
git add src/utils/computeFitScale.ts src/utils/__tests__/computeFitScale.test.ts
git commit -m "feat(preview): pure computeFitScale helper for phone auto-fit"
```

---

### Task 2: Wire `computeFitScale` into `PreviewPhoneFrame` via ResizeObserver

**Files:**
- Modify: `src/components/PreviewPhoneFrame.tsx`

We add a ResizeObserver that tracks the wrapper's available size, plus a `manualZoom` prop (default null = auto-fit) for the toolbar to drive later. The `<PhoneFrame>` itself remains unchanged — we only wrap it in a transform.

**Important:** the inner div now needs `width: deviceW; height: deviceH` so transform-origin math is predictable. The outer wrapper changes from `padding: 24, overflow: auto` to `overflow: hidden` (no scrollbars; we scale instead).

- [ ] **Step 1: Add manualZoom prop and ResizeObserver state**

Replace the current implementation of `src/components/PreviewPhoneFrame.tsx` lines 9-131 with:

```tsx
import { useEffect, useCallback, useRef, useState } from 'react'
import { PhoneFrame } from './PhoneFrame'
import { usePreviewNavigation } from '../hooks/usePreviewNavigation'
import { computeFitScale } from '../utils/computeFitScale'
import { getDevicePreset } from '../constants/devices'
import type { FlowConnection } from './FlowConnectors'
import type { GeneratedScreen } from '../hooks/useScreenManagement'
import type { ComponentNode } from '../types/mokkoi'
import type { DeviceId } from '../constants/devices'

interface PreviewPhoneFrameProps {
  screens: GeneratedScreen[]
  connections: FlowConnection[]
  activeScreenId: string
  onActiveScreenChange: (screenId: string) => void
  projectDeviceId?: DeviceId
  isGenerating?: boolean
  isStreaming?: boolean
  streamingTree?: ComponentNode | null
  /** When non-null, overrides auto-fit. Driven by the PreviewToolbar zoom controls. */
  manualZoom?: number | null
  /** Reports the current effective scale up so the toolbar can show "60%" etc. */
  onScaleChange?: (scale: number) => void
}

/** Single big phone frame for Preview mode. Auto-fits to container size by
 *  default; can be overridden via the manualZoom prop. Renders the active
 *  screen's tree and intercepts button clicks for in-phone navigation. */
export function PreviewPhoneFrame({
  screens,
  connections,
  activeScreenId,
  onActiveScreenChange,
  projectDeviceId,
  isGenerating = false,
  isStreaming = false,
  streamingTree = null,
  manualZoom = null,
  onScaleChange,
}: PreviewPhoneFrameProps) {
  const nav = usePreviewNavigation(activeScreenId, connections)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })

  // Sync external activeScreenId → internal nav state.
  useEffect(() => {
    if (nav.currentScreenId !== activeScreenId) {
      nav.navigateTo(activeScreenId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeScreenId, nav.navigateTo])

  // Sync internal nav state → external (so chat scoping etc. follows
  // when the user navigates by tapping inside the phone).
  useEffect(() => {
    if (nav.currentScreenId !== activeScreenId) {
      onActiveScreenChange(nav.currentScreenId)
    }
  }, [nav.currentScreenId, activeScreenId, onActiveScreenChange])

  // ResizeObserver — track the wrapper's available size for auto-fit.
  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        setContainerSize({ w: width, h: height })
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const activeScreen = screens.find(s => s.id === nav.currentScreenId)
  const deviceId = activeScreen?.deviceId || projectDeviceId
  const device = getDevicePreset(deviceId || 'iphone-standard')
  const scale = computeFitScale({
    container: containerSize,
    device: { w: device.width, h: device.height },
    manualZoom,
  })

  // Report effective scale up so the toolbar can show "60%".
  useEffect(() => {
    onScaleChange?.(scale)
  }, [scale, onScaleChange])

  // Intercept button clicks for in-phone navigation.
  const onClickCapture = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isGenerating) return
      const target = e.target
      if (!(target instanceof Element)) return
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
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '100%', height: '100%', padding: 40,
        color: '#94a3b8', fontSize: 13, textAlign: 'center',
      }}>
        No screen to preview yet — generate one to get started.
      </div>
    )
  }

  const isImage = activeScreen.type === 'image'

  return (
    <div
      ref={wrapperRef}
      onClickCapture={onClickCapture}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '100%', height: '100%', overflow: 'hidden',
      }}
    >
      <div
        data-screen-id={activeScreen.id}
        style={{
          width: device.width,
          height: device.height,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          // While container hasn't been measured yet, hide to avoid a 1.0-flash
          visibility: containerSize.w === 0 ? 'hidden' : 'visible',
          flexShrink: 0,
        }}
      >
        <PhoneFrame
          mode="preview"
          generatedTree={!isImage ? activeScreen.tree : undefined}
          imageUrl={isImage ? activeScreen.imageUrl : undefined}
          isGenerating={isGenerating}
          isStreaming={isStreaming}
          streamingTree={streamingTree}
          deviceId={activeScreen.deviceId || projectDeviceId}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: zero errors.

- [ ] **Step 3: Run full test suite**

Run: `npm test -- --run`
Expected: 122 passed.

- [ ] **Step 4: Manual smoke test in dev**

Run: `npm run dev`, open the preview pane, generate a screen. Verify:
- Phone visibly scales to fit (no overflow)
- Resizing the chat/canvas split via the drag handle re-scales the phone smoothly
- Switching screens from the SCREENS list still works

- [ ] **Step 5: Commit**

```bash
git add src/components/PreviewPhoneFrame.tsx
git commit -m "fix(preview): auto-fit phone to container via ResizeObserver + scale"
```

---

### Task 3: `PreviewToolbar` component (device dropdown + zoom % + dimensions + refresh)

**Files:**
- Create: `src/components/PreviewToolbar.tsx`

This is a presentational component — receives state, renders Bolt-shaped chrome above the phone. State (manualZoom, refreshKey) lives in `App.tsx` so it can be passed down to `PreviewPhoneFrame`.

**Visual shape (matches user's Bolt screenshots):**
```
[ Device ▾ ]   393 × 852   [−] 60% [+]   [↻]
```

- [ ] **Step 1: Create the component**

```tsx
// src/components/PreviewToolbar.tsx
import { ChevronDown, Minus, Plus, RotateCw } from 'lucide-react'
import { DEVICE_PRESETS, getDevicePreset } from '../constants/devices'
import type { DeviceId } from '../constants/devices'

interface PreviewToolbarProps {
  deviceId: DeviceId
  onDeviceChange: (deviceId: DeviceId) => void
  /** Effective scale (0..2) reported by PreviewPhoneFrame after fit. */
  effectiveScale: number
  /** Set to null to return to auto-fit; numeric overrides. */
  onZoomChange: (manualZoom: number | null) => void
  manualZoom: number | null
  onRefresh: () => void
}

const ZOOM_STEP = 0.1

export function PreviewToolbar({
  deviceId, onDeviceChange,
  effectiveScale, manualZoom, onZoomChange,
  onRefresh,
}: PreviewToolbarProps) {
  const device = getDevicePreset(deviceId)
  const pct = Math.round(effectiveScale * 100)

  const baseBtn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    height: 28, padding: '0 8px', borderRadius: 6,
    background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.08)',
    color: '#334155', fontSize: 12, fontWeight: 500, cursor: 'pointer',
  }

  return (
    <div
      role="toolbar"
      aria-label="Preview controls"
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '8px 16px',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        background: 'rgba(255,255,255,0.5)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      {/* Device dropdown */}
      <label style={{ position: 'relative', display: 'inline-flex' }}>
        <span style={{ position: 'absolute', left: -9999 }}>Device</span>
        <select
          value={deviceId}
          onChange={e => onDeviceChange(e.target.value as DeviceId)}
          style={{
            ...baseBtn,
            appearance: 'none', paddingRight: 26, cursor: 'pointer',
          }}
        >
          {DEVICE_PRESETS.map(d => (
            <option key={d.id} value={d.id}>{d.icon} {d.name}</option>
          ))}
        </select>
        <ChevronDown
          size={14}
          style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b' }}
        />
      </label>

      {/* Dimensions */}
      <span style={{ fontSize: 12, color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
        {device.width} × {device.height}
      </span>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Zoom controls */}
      <div role="group" aria-label="Zoom" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => onZoomChange((manualZoom ?? effectiveScale) - ZOOM_STEP)}
          style={{ ...baseBtn, width: 28, padding: 0 }}
        >
          <Minus size={14} />
        </button>
        <button
          type="button"
          aria-label="Reset to auto-fit"
          title="Click to auto-fit"
          onClick={() => onZoomChange(null)}
          style={{ ...baseBtn, minWidth: 56, fontVariantNumeric: 'tabular-nums' }}
        >
          {pct}%
        </button>
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => onZoomChange((manualZoom ?? effectiveScale) + ZOOM_STEP)}
          style={{ ...baseBtn, width: 28, padding: 0 }}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Refresh */}
      <button
        type="button"
        aria-label="Refresh preview"
        onClick={onRefresh}
        style={{ ...baseBtn, width: 28, padding: 0 }}
      >
        <RotateCw size={14} />
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/PreviewToolbar.tsx
git commit -m "feat(preview): PreviewToolbar with device picker, zoom, dimensions"
```

---

### Task 4: Mode-specific surface colors + drop overlay tint + wire toolbar

**Files:**
- Modify: `src/App.tsx` (lines ~509-563 + add toolbar state)

This task does three things together because they all touch the same `<div className="canvas-side">` block:
1. Drop the rgba(0,0,0,0.18) overlay AND the floating EDITOR badge (we already added aria-pressed to the toggle in TopNavbar)
2. Branch background color and pattern by `viewMode`
3. Render `<PreviewToolbar>` above `<PreviewPhoneFrame>` and lift `manualZoom` / `effectiveScale` / `refreshKey` state into App

- [ ] **Step 1: Add new state in App.tsx (above the JSX return)**

Find the existing `viewMode` state declaration (around line 98) and immediately after it, add:

```tsx
const [previewManualZoom, setPreviewManualZoom] = useState<number | null>(null)
const [previewEffectiveScale, setPreviewEffectiveScale] = useState(1)
const [previewRefreshKey, setPreviewRefreshKey] = useState(0)

// When the user changes the device from PreviewToolbar, write to project-level
// device id so the next generation uses it too.
const handlePreviewDeviceChange = useCallback((deviceId: DeviceId) => {
  screens.setProjectDeviceId(deviceId)
  setPreviewManualZoom(null) // re-fit on device swap
}, [screens])
```

Make sure `useCallback` and `DeviceId` are imported (`DeviceId` from `./constants/devices`).

- [ ] **Step 2: Replace the `<div className="canvas-side">` style block (line 510-515)**

Find:
```tsx
style={{
  width: `${(1 - splitRatio) * 100}%`, position: 'relative', overflow: 'hidden',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  backgroundColor: '#E8E8E8', backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.15) 1px, transparent 1px)',
  backgroundSize: '24px 24px', backgroundPosition: `${canvas.panOffset.x}px ${canvas.panOffset.y}px`,
  cursor: canvas.canvasCursor,
}}>
```

Replace with:
```tsx
style={{
  width: `${(1 - splitRatio) * 100}%`, position: 'relative', overflow: 'hidden',
  display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start',
  backgroundColor: viewMode === 'preview' ? '#FAFAFA' : '#EEF0FA',
  backgroundImage: viewMode === 'preview'
    ? 'none'
    : 'radial-gradient(circle, rgba(99,102,241,0.22) 1px, transparent 1px)',
  backgroundSize: '20px 20px',
  backgroundPosition: viewMode === 'preview' ? '0 0' : `${canvas.panOffset.x}px ${canvas.panOffset.y}px`,
  cursor: canvas.canvasCursor,
}}>
```

Note: `flexDirection: 'column'` so the toolbar stacks above the phone area. `alignItems: 'stretch'` so the toolbar is full-width.

- [ ] **Step 3: Replace the preview-mode branch (lines ~530-541)**

Find:
```tsx
{viewMode === 'preview' && (
  <PreviewPhoneFrame
    screens={screens.generatedScreens.filter(s => s.tree || s.imageUrl)}
    connections={screens.connections}
    activeScreenId={screens.activeGeneratedId || ''}
    onActiveScreenChange={screens.setActiveGeneratedId}
    projectDeviceId={screens.projectDeviceId}
    isGenerating={ai.isGenerating}
    isStreaming={ai.isStreaming}
    streamingTree={ai.partialTree}
  />
)}
```

Replace with:
```tsx
{viewMode === 'preview' && (
  <>
    <PreviewToolbar
      deviceId={screens.projectDeviceId}
      onDeviceChange={handlePreviewDeviceChange}
      effectiveScale={previewEffectiveScale}
      manualZoom={previewManualZoom}
      onZoomChange={setPreviewManualZoom}
      onRefresh={() => setPreviewRefreshKey(k => k + 1)}
    />
    <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
      <PreviewPhoneFrame
        key={previewRefreshKey}
        screens={screens.generatedScreens.filter(s => s.tree || s.imageUrl)}
        connections={screens.connections}
        activeScreenId={screens.activeGeneratedId || ''}
        onActiveScreenChange={screens.setActiveGeneratedId}
        projectDeviceId={screens.projectDeviceId}
        isGenerating={ai.isGenerating}
        isStreaming={ai.isStreaming}
        streamingTree={ai.partialTree}
        manualZoom={previewManualZoom}
        onScaleChange={setPreviewEffectiveScale}
      />
    </div>
  </>
)}
```

- [ ] **Step 4: Replace the canvas-editor branch (lines ~542-563) — strip overlay + badge**

Find the canvas-editor wrapper that contains the `rgba(0,0,0,0.18)` overlay and the EDITOR badge divs. Remove ONLY the overlay div and the EDITOR badge div. Keep the inner `<div data-canvas-bg="true">` exactly as it is.

The structure changes from:
```tsx
{viewMode === 'canvas-editor' && (
  <div style={{ position: 'relative', width: '100%', height: '100%' }}>
    <div style={{ /* rgba overlay */ }} />
    <div style={{ /* EDITOR badge */ }}>Editor</div>
    <div data-canvas-bg="true" style={{...}}>
      {/* screens map */}
    </div>
  </div>
)}
```
to:
```tsx
{viewMode === 'canvas-editor' && (
  <div data-canvas-bg="true" style={{
    position: 'relative',
    minWidth: 1, minHeight: 1,
    transform: `translate(${canvas.panOffset.x}px, ${canvas.panOffset.y}px) scale(${canvas.zoomLevel / 100})`,
    transformOrigin: 'center center',
    transition: (canvas.isPanning.current || isDraggingScreen.current || canvas.isZooming.current) ? 'none' : 'transform 0.15s ease-out',
    cursor: canvas.panActive ? 'inherit' : 'default',
  }}>
    {/* screens map — unchanged */}
  </div>
)}
```

(The wrapper div, overlay div, and badge div are deleted. The data-canvas-bg div absorbs the position: relative.)

- [ ] **Step 5: Imports**

Add to the imports at top of `App.tsx`:
```tsx
import { PreviewToolbar } from './components/PreviewToolbar'
```

If `useCallback` isn't already imported from `'react'`, add it.
If `DeviceId` isn't already imported from `'./constants/devices'`, add it.

- [ ] **Step 6: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: zero errors.

- [ ] **Step 7: Run full test suite**

Run: `npm test -- --run`
Expected: 122 passed.

- [ ] **Step 8: Manual smoke test**

Run `npm run dev` and verify in order:
- Default view (preview): off-white background, no dots, single centered phone, toolbar above with device dropdown / dims / zoom / refresh
- Toggle to canvas-editor: indigo-tinted background with indigo dots, multi-screen grid, no toolbar, EDITOR pill in TopNavbar lit (`aria-pressed=true`)
- Change device in PreviewToolbar dropdown: dimensions update, phone re-fits
- Click `−` then `+` in zoom controls: scale changes, % updates
- Click `60%` text: returns to auto-fit
- Click refresh icon: phone re-mounts (visual flash)

- [ ] **Step 9: Commit**

```bash
git add src/App.tsx
git commit -m "feat(preview): mode-specific colors + PreviewToolbar; drop overlay tint"
```

---

### Task 5: Backend hardening for `<design_brief>` parsing edge cases

**Files:**
- Modify: `api/generate.ts` (`extractDesignBrief` function around line 1666 + streaming completion handler around line 2522)

Two backend bugs surface as "Raw start: <design_brief>" errors:
1. **Unclosed brief tag** — model truncates mid-brief; `briefMatch` is null; `jsonText` returns the full raw text including the open tag
2. **Brief-only output** — model emits brief then stops; `jsonText` is empty after stripping; fallback `jsonText || fullText` re-includes the brief

Fix `extractDesignBrief` to be more permissive (find the first `{` after any brief content), and surface a typed error from the streaming handler when no JSON-shaped content remains.

- [ ] **Step 1: Update `extractDesignBrief` to be more tolerant**

Find the current definition (around line 1666):
```ts
function extractDesignBrief(raw: string): { brief: string | null; jsonText: string } {
  const briefMatch = raw.match(/<design_brief>([\s\S]*?)<\/design_brief>/)
  const brief = briefMatch ? briefMatch[1].trim() : null
  const jsonText = raw.replace(/<design_brief>[\s\S]*?<\/design_brief>/, '').trim()
  return { brief, jsonText }
}
```

Replace with:
```ts
function extractDesignBrief(raw: string): { brief: string | null; jsonText: string } {
  // Happy path: properly closed <design_brief>...</design_brief>
  const closed = raw.match(/<design_brief>([\s\S]*?)<\/design_brief>/)
  if (closed) {
    const brief = closed[1].trim()
    const jsonText = raw.replace(/<design_brief>[\s\S]*?<\/design_brief>/, '').trim()
    return { brief, jsonText }
  }

  // Tolerant fallback: model opened <design_brief> but never closed it.
  // Slice everything up to the first '{' as the brief, then take from '{' on
  // as the JSON candidate. If there's no '{' at all, jsonText is empty (caller
  // will surface a typed BRIEF_ONLY error).
  if (raw.includes('<design_brief>')) {
    const firstBrace = raw.indexOf('{')
    if (firstBrace >= 0) {
      const briefSection = raw.slice(0, firstBrace).replace(/<design_brief>/, '').trim()
      const jsonText = raw.slice(firstBrace).trim()
      return { brief: briefSection || null, jsonText }
    }
    return { brief: raw.replace(/<design_brief>/, '').trim() || null, jsonText: '' }
  }

  // No brief tags at all — assume the model returned raw JSON.
  return { brief: null, jsonText: raw.trim() }
}
```

- [ ] **Step 2: Update the streaming completion handler to handle empty jsonText explicitly**

Find lines around 2522-2525:
```ts
try {
  const { brief: designBrief, jsonText } = extractDesignBrief(fullText)
  let tree = repairJSON(jsonText || fullText)
```

Replace the try block opener with:
```ts
try {
  const { brief: designBrief, jsonText } = extractDesignBrief(fullText)
  if (!jsonText) {
    // Model emitted only the brief and never started the JSON. Surface a
    // typed error so the client can show a friendly retry message.
    throw new Error('AI_BRIEF_ONLY_NO_JSON')
  }
  let tree = repairJSON(jsonText)
```

(Note: dropped the `|| fullText` fallback. If we got here with no jsonText, that fallback was guaranteed to fail because fullText still contained the brief.)

- [ ] **Step 3: Update non-streaming path the same way (line ~2611)**

Find:
```ts
const { brief: designBrief, jsonText } = extractDesignBrief(text)

let tree: any
try {
  tree = repairJSON(jsonText || text)
```

Replace with:
```ts
const { brief: designBrief, jsonText } = extractDesignBrief(text)

let tree: any
try {
  if (!jsonText) throw new Error('AI_BRIEF_ONLY_NO_JSON')
  tree = repairJSON(jsonText)
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: zero errors.

- [ ] **Step 5: Run full test suite (just to make sure nothing in api/ broke type-wise)**

Run: `npm test -- --run`
Expected: 122 passed.

- [ ] **Step 6: Commit**

```bash
git add api/generate.ts
git commit -m "fix(api): tolerant <design_brief> parsing + typed BRIEF_ONLY error"
```

---

### Task 6: Frontend friendly error mapping for invalid JSON cases

**Files:**
- Modify: `src/hooks/useAIGeneration.ts` (`getUserFriendlyError` around line 76)

The chat panel should never show "Raw start: <design_brief>..." to a user. Map both the new typed error and the older "AI returned invalid JSON" string to a friendly retry-style message.

- [ ] **Step 1: Add the two new pattern matches**

Find `getUserFriendlyError` at line 76. Just before the line `// Show the actual error for debugging — don't hide behind generic messages` (around line 98), add:

```ts
  if (message.includes('AI_BRIEF_ONLY_NO_JSON') || message.includes('AI returned invalid JSON'))
    return 'The AI got stuck mid-response. Please try regenerating.'
```

(Insert this between the existing `'Missing or invalid prompt'` mapping and the `'abort'` mapping.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: zero errors.

- [ ] **Step 3: Run full test suite**

Run: `npm test -- --run`
Expected: 122 passed.

- [ ] **Step 4: Manual smoke test for full error path**

Run `npm run dev`. The fix is hard to trigger artificially without mocking the API, so this is a code review check rather than a real reproduction:
- Open `src/hooks/useAIGeneration.ts` in editor
- Confirm `getUserFriendlyError('AI_BRIEF_ONLY_NO_JSON: extra detail')` would return `'The AI got stuck mid-response. Please try regenerating.'`
- Confirm `getUserFriendlyError('AI returned invalid JSON. Raw start: <design_brief>...')` returns the same friendly message

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAIGeneration.ts
git commit -m "fix(ui): friendly retry message for AI invalid-JSON errors"
```

---

## Final Validation (after all 6 tasks)

- [ ] Full test suite green: `npm test -- --run` → 122 passed
- [ ] Typecheck clean: `npx tsc -b --noEmit` → zero errors
- [ ] Build succeeds: `npm run build` → no warnings beyond existing baseline
- [ ] Manual end-to-end smoke:
  - Generate a fresh app from prompt → screens render in canvas-editor mode (indigo dots)
  - Toggle to preview mode → off-white background, single phone fits viewport
  - Resize chat/canvas split → phone scales smoothly
  - Change device in PreviewToolbar → dims update, phone re-fits
  - Manual zoom in/out → percentage updates
  - Click `60%` text → returns to auto-fit
  - Refresh button → phone re-mounts

## Out-of-Scope (explicit non-goals for this plan)

- External-link / mirror / fullscreen / QR icon actions in the toolbar
- Per-screen device override picker in PreviewToolbar (today's behavior — uses screen.deviceId || projectDeviceId — is preserved)
- Animations between modes (Bolt uses Framer Motion; we ship without for now)
- Restyling chat-side, modals, or other surfaces
