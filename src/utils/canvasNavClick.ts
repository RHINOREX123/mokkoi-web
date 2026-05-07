/** Canvas-side bottom-nav tab classification.
 *
 *  Mirrors the runtime/main.tsx classifier (isBottomNavRow + label extraction)
 *  but operates directly on a click target — no postMessage hop. Used by the
 *  canvas-editor `handlePhoneClick` to detect bottom-nav tab taps before they
 *  fall through to the existing select-screen behavior.
 *
 *  Intentional duplication of the heuristic from src/runtime/main.tsx:35–42:
 *  the runtime ships as a separate Vite entry that runs in an iframe; sharing
 *  this small heuristic across the boundary would force the runtime to import
 *  from an additional module on its critical path. The signature is the same
 *  on both sides — if it changes, change both. */

/** BottomNav row signature: flexDirection:row + paddingBottom>=24 (safe-area
 *  inset) + borderTopWidth>=1 + ≥2 [role="button"] children. The
 *  paddingBottom>=24 is what distinguishes BottomNav from a generic horizontal
 *  button row. */
function isBottomNavRow(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const s = el.style
  if (s.flexDirection !== 'row') return false
  if (parseFloat(s.paddingBottom || '0') < 24) return false
  if (parseFloat(s.borderTopWidth || '0') < 1) return false
  return el.querySelectorAll(':scope > [role="button"]').length >= 2
}

export interface BottomNavTabClick {
  label: string
  tabIndex: number
}

/** If `target` sits inside a BottomNav row, return the tab's label and index;
 *  otherwise null. Walks up to the nearest [role="button"], confirms its
 *  parent is a BottomNav row, and extracts the visible label (Material Symbols
 *  glyph name as fallback for icon-only tabs).
 *
 *  Returns null for any non-tab click so callers can fall through to their
 *  existing behaviour. */
export function findBottomNavTabFromTarget(
  target: EventTarget | null,
): BottomNavTabClick | null {
  if (!(target instanceof Element)) return null

  let btn: HTMLElement | null = null
  for (let cur: Element | null = target; cur; cur = cur.parentElement) {
    if (cur instanceof HTMLElement && cur.getAttribute('role') === 'button') {
      btn = cur
      break
    }
  }
  if (!btn) return null
  if (!isBottomNavRow(btn.parentElement)) return null

  const clone = btn.cloneNode(true) as HTMLElement
  clone.querySelectorAll('.material-symbols-outlined').forEach(n => n.remove())
  let label = (clone.textContent || '').trim()
  if (!label) {
    const iconSpan = btn.querySelector('.material-symbols-outlined')
    label = (iconSpan?.textContent || '').trim()
  }
  if (!label) return null

  const siblings = Array.from(btn.parentElement!.children).filter(
    c => c.getAttribute('role') === 'button',
  )
  return { label, tabIndex: siblings.indexOf(btn) }
}
