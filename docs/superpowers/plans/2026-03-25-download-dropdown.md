# Download Dropdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "Download as image" item in the "More" dropdown with a "Download" submenu containing 3 options: Screenshot (PNG), Code (TSX), Full Package (ZIP). Fix the screenshot capture to render at full device resolution.

**Architecture:** Add JSZip dependency. Create a `useScreenExport` hook with 3 export methods. Create a `screenCapture` utility for full-res off-screen capture. Modify ScreenContextToolbar to render a nested submenu inside the existing "More" dropdown. Keep "Export code" as-is at the top level.

**Tech Stack:** JSZip (client-side ZIP), html2canvas (existing), React hooks

**Target UX:**
```
··· More
  ├─ Export code          Ctrl+E
  ├─ Download ▸
  │    ├─ Screenshot (PNG)
  │    ├─ Code (TSX)
  │    └─ Full Package (ZIP)
  ├─ Duplicate screen
  ├─ Rename screen
  └─ Delete screen
```

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/utils/screenCapture.ts` | Full-res off-screen capture with html2canvas |
| Create | `src/hooks/useScreenExport.ts` | 3 export methods: downloadPNG, downloadTSX, downloadZIP |
| Modify | `src/components/ScreenContextToolbar.tsx` | Replace "Download as image" with nested "Download ▸" submenu |
| Modify | `src/App.tsx` | Remove `handleDownloadImage`, wire `useScreenExport` hook |
| Modify | `package.json` | Add `jszip` dependency |

---

### Task 1: Add JSZip dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install JSZip**

Run: `npm install jszip`

- [ ] **Step 2: Verify installation**

Run: `npm ls jszip`
Expected: `jszip@3.x.x`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add jszip dependency for ZIP export"
```

---

### Task 2: Create screenCapture utility

**Files:**
- Create: `src/utils/screenCapture.ts`

Extracts the existing CSS color sanitization from App.tsx and adds full-resolution off-screen capture.

- [ ] **Step 1: Create `src/utils/screenCapture.ts`**

```typescript
// Full-resolution screen capture utility.
// Renders the PhoneFrame element at native size in a hidden container,
// sanitizes modern CSS colors, captures with html2canvas.

import html2canvas from 'html2canvas'

/** Sanitize oklab/oklch/color-mix that html2canvas can't parse. */
function sanitizeColors(root: HTMLElement): void {
  const els = [root, ...Array.from(root.querySelectorAll('*'))] as HTMLElement[]
  for (const el of els) {
    const computed = window.getComputedStyle(el)
    for (const prop of ['color', 'backgroundColor', 'borderColor', 'outlineColor'] as const) {
      const val = computed[prop]
      if (val && (val.includes('oklab') || val.includes('oklch') || val.includes('color-mix'))) {
        const c = document.createElement('canvas')
        c.width = 1; c.height = 1
        const ctx = c.getContext('2d')
        if (ctx) { ctx.fillStyle = val; el.style[prop] = ctx.fillStyle }
      }
    }
    if (el.style.cssText && /oklab|oklch|color-mix/.test(el.style.cssText)) {
      el.style.cssText = el.style.cssText
        .replace(/oklab\([^)]*\)/g, '#000')
        .replace(/oklch\([^)]*\)/g, '#000')
        .replace(/color-mix\([^)]*\)/g, '#000')
    }
    el.style.color = computed.color
    el.style.backgroundColor = computed.backgroundColor
    el.style.borderColor = computed.borderColor
  }
}

/**
 * Capture a screen at full device resolution.
 * Clones the PhoneFrame element, removes canvas scaling,
 * renders off-screen at native device dimensions, returns PNG Blob.
 */
export async function captureScreenAtFullRes(
  screenId: string,
  phoneFrameRefs: Map<string, HTMLDivElement>,
): Promise<Blob> {
  const el =
    (document.querySelector(`[data-screen-id="${screenId}"]`) as HTMLElement | null) ??
    phoneFrameRefs.get(screenId) ??
    null
  if (!el) throw new Error('Could not find screen element to capture')

  const clone = el.cloneNode(true) as HTMLElement
  clone.style.transform = 'none'
  clone.style.position = 'fixed'
  clone.style.top = '0'
  clone.style.left = '0'
  clone.style.zIndex = '-9999'
  clone.style.opacity = '1'
  clone.style.pointerEvents = 'none'
  clone.style.boxShadow = 'none'
  document.body.appendChild(clone)

  sanitizeColors(clone)

  try {
    const canvas = await html2canvas(clone, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      width: clone.scrollWidth,
      height: clone.scrollHeight,
      windowWidth: clone.scrollWidth,
      windowHeight: clone.scrollHeight,
    })

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('Failed to generate image')),
        'image/png',
      )
    })
  } finally {
    document.body.removeChild(clone)
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/utils/screenCapture.ts
git commit -m "feat: add full-resolution screen capture utility"
```

---

### Task 3: Create useScreenExport hook

**Files:**
- Create: `src/hooks/useScreenExport.ts`

Provides `downloadPNG`, `downloadTSX`, `downloadZIP` methods with toast feedback and analytics tracking.

- [ ] **Step 1: Create `src/hooks/useScreenExport.ts`**

```typescript
import { useCallback } from 'react'
import JSZip from 'jszip'
import { captureScreenAtFullRes } from '../utils/screenCapture'
import { convertTreeToTSX } from '../utils/exportTsx'
import { getDevicePreset } from '../constants/devices'
import { trackEvent } from '../lib/analytics'
import type { ComponentNode } from '../types/mokkoi'

export interface ExportTarget {
  screenId: string
  screenName: string
  tree: ComponentNode
  deviceId: string
  originalPrompt?: string
}

interface UseScreenExportOpts {
  phoneFrameRefs: React.RefObject<Map<string, HTMLDivElement>>
  onToast: (msg: string) => void
}

function safeName(name: string): string {
  return (name || 'Screen').replace(/[^a-zA-Z0-9]/g, '')
}

function generateReadme(target: ExportTarget): string {
  const device = getDevicePreset(target.deviceId)
  const name = safeName(target.screenName)
  return `# ${target.screenName}

Generated by [Mokkoi](https://mokkoi.com)

## Screen Info

- **Name:** ${target.screenName}
- **Device:** ${device.name} (${device.width}x${device.height})
${target.originalPrompt ? `- **Prompt:** ${target.originalPrompt}` : ''}

## Quick Start with Expo

\`\`\`bash
npx create-expo-app my-app --template blank-typescript
cd my-app
\`\`\`

Copy \`${name}.tsx\` into your project, then import it:

\`\`\`tsx
import ${name}Screen from './${name}';

export default function App() {
  return <${name}Screen />;
}
\`\`\`

Run:

\`\`\`bash
npx expo start
\`\`\`

## Files

| File | Description |
|------|-------------|
| \`screen.png\` | High-resolution screenshot (@2x) |
| \`${name}.tsx\` | React Native component |
| \`README.md\` | This file |
`
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function useScreenExport({ phoneFrameRefs, onToast }: UseScreenExportOpts) {
  const downloadPNG = useCallback(async (target: ExportTarget) => {
    onToast('Capturing screenshot...')
    try {
      const blob = await captureScreenAtFullRes(target.screenId, phoneFrameRefs.current!)
      triggerDownload(blob, `${target.screenName || 'screen'}.png`)
      onToast('Screenshot saved!')
      trackEvent('screen_downloaded', { format: 'png' })
    } catch (err) {
      onToast(`Screenshot failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }, [phoneFrameRefs, onToast])

  const downloadTSX = useCallback((target: ExportTarget) => {
    try {
      const code = convertTreeToTSX(target.tree, target.screenName)
      const blob = new Blob([code], { type: 'text/plain' })
      triggerDownload(blob, `${safeName(target.screenName)}.tsx`)
      onToast('Code downloaded!')
      trackEvent('screen_downloaded', { format: 'tsx' })
    } catch (err) {
      onToast(`Download failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }, [onToast])

  const downloadZIP = useCallback(async (target: ExportTarget) => {
    onToast('Preparing package...')
    try {
      const zip = new JSZip()
      const name = safeName(target.screenName)

      // Screenshot
      const pngBlob = await captureScreenAtFullRes(target.screenId, phoneFrameRefs.current!)
      zip.file('screen.png', pngBlob)

      // Code
      zip.file(`${name}.tsx`, convertTreeToTSX(target.tree, target.screenName))

      // README
      zip.file('README.md', generateReadme(target))

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      triggerDownload(zipBlob, `${target.screenName || 'screen'}.zip`)
      onToast('Package downloaded!')
      trackEvent('screen_downloaded', { format: 'zip' })
    } catch (err) {
      onToast(`Package failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }, [phoneFrameRefs, onToast])

  return { downloadPNG, downloadTSX, downloadZIP }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useScreenExport.ts
git commit -m "feat: add useScreenExport hook with PNG, TSX, ZIP methods"
```

---

### Task 4: Add nested Download submenu to ScreenContextToolbar

**Files:**
- Modify: `src/components/ScreenContextToolbar.tsx`

Replace the single "Download as image" menu item with a "Download ▸" item that reveals a nested submenu on hover. Keep "Export code" as the first item in More.

- [ ] **Step 1: Update props interface**

In the interface (~line 11-33), replace:
```typescript
  onDownloadImage: () => void
```
with:
```typescript
  onDownloadPNG: () => void
  onDownloadTSX: () => void
  onDownloadZIP: () => void
```

In the destructuring (~line 67-73), replace:
```typescript
    onDownloadImage,
```
with:
```typescript
    onDownloadPNG, onDownloadTSX, onDownloadZIP,
```

- [ ] **Step 2: Add ImagePlus to lucide imports**

At the top (~line 3), add `ImagePlus` and `FileCode` and `Package` to the import:
```typescript
import {
  Sparkles, RefreshCw, LayoutGrid, Pencil, MessageSquare, Palette, Moon, Sun,
  Play, ExternalLink, QrCode, Smartphone, MoreHorizontal, Code,
  Download, Copy, Type, Trash2, Star, ThumbsUp, ThumbsDown, ChevronDown, PenTool,
  ImagePlus, FileCode, Package, ChevronRight,
} from 'lucide-react'
```

- [ ] **Step 3: Add submenu state**

Inside the component, add a state for the download submenu hover:
```typescript
  const [showDownloadSub, setShowDownloadSub] = useState(false)
```

Also reset it when `openDropdown` changes — add to the `useEffect` that closes dropdowns when toolbar hides (~line 90-92):
```typescript
  useEffect(() => {
    if (!visible) { setOpenDropdown(null); setShowDownloadSub(false) }
  }, [visible])
```

- [ ] **Step 4: Replace "Download as image" with submenu trigger**

In the "More" dropdown content (~line 284-293), replace:
```typescript
            {menuItem(<Download size={16} color="#94a3b8" />, 'Download as image', onDownloadImage)}
```
with the nested submenu:
```tsx
            <div
              style={{ position: 'relative' }}
              onMouseEnter={() => setShowDownloadSub(true)}
              onMouseLeave={() => setShowDownloadSub(false)}
            >
              <button
                style={{
                  ...MENU_ITEM_STYLE,
                  justifyContent: 'space-between',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                onClick={() => setShowDownloadSub(prev => !prev)}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Download size={16} color="#94a3b8" />
                  Download
                </span>
                <ChevronRight size={14} color="#555" />
              </button>
              {showDownloadSub && (
                <div style={{
                  position: 'absolute',
                  left: '100%',
                  top: -4,
                  marginLeft: 4,
                  background: '#1A1A1A',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
                  minWidth: 200,
                  padding: 4,
                  zIndex: 101,
                }}>
                  {menuItem(<ImagePlus size={16} color="#94a3b8" />, 'Screenshot (PNG)', onDownloadPNG)}
                  {menuItem(<FileCode size={16} color="#94a3b8" />, 'Code (TSX)', onDownloadTSX)}
                  {divider}
                  {menuItem(<Package size={16} color="#818CF8" />, 'Full Package (ZIP)', onDownloadZIP)}
                  <div style={{ padding: '2px 12px 6px', fontSize: 10, color: '#555', lineHeight: 1.4 }}>
                    PNG + TSX + README
                  </div>
                </div>
              )}
            </div>
```

- [ ] **Step 5: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: Errors only in App.tsx (not yet updated)

- [ ] **Step 6: Commit**

```bash
git add src/components/ScreenContextToolbar.tsx
git commit -m "feat: add nested Download submenu in More dropdown"
```

---

### Task 5: Wire useScreenExport into App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add import, remove html2canvas**

Add:
```typescript
import { useScreenExport } from './hooks/useScreenExport'
```

Remove:
```typescript
import html2canvas from 'html2canvas'
```

- [ ] **Step 2: Initialize the hook**

After `const phoneFrameRefs = useRef<Map<string, HTMLDivElement>>(new Map())` (~line 46), add:
```typescript
  const screenExport = useScreenExport({
    phoneFrameRefs,
    onToast: setToastMessage,
  })
```

Note: `setToastMessage` is defined later. Move this hook call after `setToastMessage` is declared, or use the pattern already established in the file.

- [ ] **Step 3: Add getExportTarget helper**

Add near the other handler functions:
```typescript
  const getExportTarget = useCallback(() => {
    const screen = screens.activeGenerated
    if (!screen?.tree) return null
    return {
      screenId: screen.id,
      screenName: screen.name,
      tree: screen.tree,
      deviceId: screen.deviceId || screens.projectDeviceId,
      originalPrompt: screen.originalPrompt,
    }
  }, [screens.activeGenerated, screens.projectDeviceId])
```

- [ ] **Step 4: Delete handleDownloadImage**

Remove the entire `handleDownloadImage` callback (lines 271-308).

- [ ] **Step 5: Update ScreenContextToolbar props**

Replace:
```typescript
              onDownloadImage={handleDownloadImage}
```
with:
```typescript
              onDownloadPNG={() => { const t = getExportTarget(); if (t) screenExport.downloadPNG(t) }}
              onDownloadTSX={() => { const t = getExportTarget(); if (t) screenExport.downloadTSX(t) }}
              onDownloadZIP={() => { const t = getExportTarget(); if (t) screenExport.downloadZIP(t) }}
```

Do this for ALL ScreenContextToolbar usages in the file (search for `onDownloadImage`).

- [ ] **Step 6: Verify full build**

Run: `npm run build`
Expected: Clean build, no errors

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire useScreenExport into App, remove old download handler"
```

---

### Task 6: Manual QA

- [ ] **Step 1: Start dev server and test**

Run: `npm run dev`

1. Open a project, select a screen
2. Click "More" → verify "Download ▸" submenu appears on hover
3. Test "Screenshot (PNG)" — verify high-res PNG downloads with phone bezel
4. Test "Code (TSX)" — verify .tsx file downloads
5. Test "Full Package (ZIP)" — extract and verify: screen.png, [Name].tsx, README.md
6. Verify "Export code" (Ctrl+E) still opens CodeExportModal
7. Verify "Duplicate screen" and other More items still work

- [ ] **Step 2: Final commit if any fixes needed**

```bash
git add -A
git commit -m "feat: download dropdown with PNG, TSX, ZIP export"
```
