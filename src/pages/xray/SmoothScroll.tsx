import { useEffect } from 'react'

/**
 * Lenis smooth scroll (same setup as the ThriveForge marketing site). Off under
 * prefers-reduced-motion, since hijacked scrolling can trigger vestibular symptoms.
 */
export default function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let lenis: { raf: (t: number) => void; destroy: () => void } | undefined
    let raf = 0
    let cancelled = false

    import('lenis').then(({ default: Lenis }) => {
      if (cancelled) return
      lenis = new Lenis({ duration: 1.05, smoothWheel: true, anchors: true })
      const loop = (time: number) => {
        lenis?.raf(time)
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      lenis?.destroy()
    }
  }, [])

  return null
}
