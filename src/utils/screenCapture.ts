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
