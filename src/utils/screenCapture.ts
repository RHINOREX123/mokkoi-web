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

  // Remove canvas scaling and expand clipped containers for full-res capture.
  // PhoneFrame canvas mode wraps the phone chassis in:
  //   <div style="width:261px; height:...; overflow:hidden">
  //     <div style="transform:scale(0.6); transformOrigin:top left">
  //       <div class="relative" style="width:430; height:932"> ← actual phone
  // We need to: remove the scale transform, expand overflow, and let the
  // outer container size to the native phone dimensions.
  const allEls = clone.querySelectorAll('*') as NodeListOf<HTMLElement>
  for (const child of allEls) {
    // Remove any CSS scale transforms (the canvas downscale)
    const transform = child.style.transform || window.getComputedStyle(child).transform
    if (transform && transform !== 'none' && /scale/.test(transform)) {
      child.style.transform = 'none'
    }
    // Expand overflow-hidden containers
    const ov = window.getComputedStyle(child).overflow
    if (ov === 'hidden' || ov === 'clip') {
      child.style.overflow = 'visible'
    }
    const ovY = window.getComputedStyle(child).overflowY
    if (ovY === 'hidden' || ovY === 'clip') {
      child.style.overflowY = 'visible'
    }
    // Remove height constraints that prevent full-content capture
    // (ScreenRenderer wrapper uses height:100% to clip in canvas mode)
    const h = child.style.height
    if (h === '100%') {
      child.style.height = 'auto'
      child.style.minHeight = '100%'
    }
  }
  // Remove fixed canvas dimensions on the outer wrapper so it expands to content
  clone.style.width = 'auto'
  clone.style.height = 'auto'

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
