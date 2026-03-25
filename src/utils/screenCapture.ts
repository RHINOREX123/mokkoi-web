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
 *
 * IMPORTANT: Captures at the phone frame's native dimensions (e.g. 430x932),
 * NOT at the expanded content height. This prevents oversized screenshots
 * when the AI generates content taller than the phone viewport.
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

  // Find the actual phone chassis element (the one with explicit width/height
  // matching device dimensions like 430x932). This gives us the native size.
  let phoneWidth = 430  // Default iPhone 15 Pro Max
  let phoneHeight = 932
  const allEls = clone.querySelectorAll('*') as NodeListOf<HTMLElement>
  for (const child of allEls) {
    // Remove any CSS scale transforms (the canvas downscale)
    const transform = child.style.transform || window.getComputedStyle(child).transform
    if (transform && transform !== 'none' && /scale/.test(transform)) {
      child.style.transform = 'none'
    }

    // Detect the phone chassis element by its dimensions
    const w = parseInt(child.style.width)
    const h = parseInt(child.style.height)
    if (w >= 375 && w <= 450 && h >= 700 && h <= 1000) {
      phoneWidth = w
      phoneHeight = h
    }
  }

  // Now set the clone to the phone's native dimensions.
  // DO NOT expand overflow or remove height constraints — we want the
  // screenshot to match exactly what the user sees in the phone frame.
  clone.style.width = phoneWidth + 'px'
  clone.style.height = phoneHeight + 'px'
  clone.style.overflow = 'hidden'

  // Ensure inner containers respect the phone dimensions
  for (const child of allEls) {
    // Only expand overflow on the outermost canvas wrapper (not on screen content)
    const ov = window.getComputedStyle(child).overflow
    if (ov === 'hidden' || ov === 'clip') {
      // Check if this is the canvas scaling wrapper (has transform-related styles)
      // vs the screen content container (which should stay clipped)
      const isCanvasWrapper = child.style.transform !== '' ||
        (window.getComputedStyle(child).transform !== 'none' && window.getComputedStyle(child).transform !== '')
      if (isCanvasWrapper) {
        child.style.overflow = 'visible'
      }
      // Screen content stays clipped to phone dimensions
    }
  }

  sanitizeColors(clone)

  try {
    const canvas = await html2canvas(clone, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      width: phoneWidth,
      height: phoneHeight,
      windowWidth: phoneWidth,
      windowHeight: phoneHeight,
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
