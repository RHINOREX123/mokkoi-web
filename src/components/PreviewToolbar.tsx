import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Minus, Plus, RotateCw, Smartphone } from 'lucide-react'
import { DEVICE_PRESETS, getDevicePreset } from '../constants/devices'
import { MIN_ZOOM, MAX_ZOOM } from '../utils/computeFitScale'
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
  /** Open the Expo phone-preview modal (QR + Snack Open in browser). The
   *  inline Snack iframe is the primary preview; this button is the
   *  demoted "test on a real phone" entry point. */
  onTestOnPhone?: () => void
}

const ZOOM_STEP = 0.1

const BASE_BTN_STYLE: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  height: 28, padding: '0 8px', borderRadius: 6,
  background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.08)',
  color: '#334155', fontSize: 12, fontWeight: 500, cursor: 'pointer',
}

/** Custom device dropdown.
 *
 *  Replaces the previous native <select>: native <option> elements can't
 *  right-align dimensions next to the device name. This matches Bolt's
 *  layout — name on the left, "WIDTH×HEIGHT" right-aligned in a muted
 *  color, scrollable list.
 *
 *  Closes on outside click or Escape. */
function DeviceDropdown({
  deviceId, onDeviceChange,
}: {
  deviceId: DeviceId
  onDeviceChange: (deviceId: DeviceId) => void
}) {
  const [open, setOpen] = useState(false)
  const [buttonRect, setButtonRect] = useState<{ top: number; left: number } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const device = getDevicePreset(deviceId)

  // Re-measure the trigger button's screen position when the dropdown opens, and
  // again on scroll/resize while open. The dropdown panel is rendered into a
  // portal (document.body) to escape the toolbar's backdrop-filter stacking
  // context, so we position it via fixed coords from the trigger's rect.
  useEffect(() => {
    if (!open) return
    const measure = () => {
      const r = triggerRef.current?.getBoundingClientRect()
      if (r) setButtonRect({ top: r.bottom + 6, left: r.left })
    }
    measure()
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as Node
      // Dropdown panel lives in a portal, so it's NOT a DOM descendant of
      // wrapRef. Accept clicks inside either the wrapper (trigger button) or
      // the portal'd panel.
      const insideWrap = wrapRef.current?.contains(t) ?? false
      const insidePanel = dropdownRef.current?.contains(t) ?? false
      if (!insideWrap && !insidePanel) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKey)

    // Stop wheel events from bubbling out of the portal'd panel. Defense in
    // depth — the canvas-side wheel listener already exempts
    // `.mokkoi-device-menu`, but the panel is now in document.body so this
    // is also belt-and-braces against any other ancestor wheel handlers.
    // Native scroll on the inner listbox proceeds because we never call
    // preventDefault.
    const dropdown = dropdownRef.current
    const onWheel = (e: WheelEvent) => { e.stopPropagation() }
    if (dropdown) dropdown.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKey)
      if (dropdown) dropdown.removeEventListener('wheel', onWheel)
    }
  }, [open])

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-flex' }}>
      {/* Webkit scrollbar styling for the dropdown. The inline
       *  scrollbarWidth/scrollbarColor on the listbox covers Firefox;
       *  Chrome/Edge/Safari ignore those properties, so we provide
       *  ::-webkit-scrollbar rules here. Without obvious styling, Windows
       *  Chrome hides the scrollbar by default and users can't tell the
       *  list scrolls past the visible window — they'd think iPhone 16
       *  Pro Max was the last device when in fact 7 more (SE, Pixel,
       *  Galaxy, iPad) follow.
       *
       *  Use brand purple (#818CF8) at 0.55 opacity for the thumb so it
       *  reads as a real scrollbar against the white dropdown surface.
       *  A subtle filled track makes the channel obvious even when the
       *  thumb is at the extreme top/bottom. Width: 10px (vs 8) so it's
       *  easy to grab. */}
      <style>{`
        .mokkoi-device-menu::-webkit-scrollbar { width: 10px; }
        .mokkoi-device-menu::-webkit-scrollbar-track { background: rgba(15,23,42,0.05); border-radius: 4px; }
        .mokkoi-device-menu::-webkit-scrollbar-thumb { background: rgba(129,140,248,0.55); border-radius: 4px; border: 2px solid #ffffff; background-clip: padding-box; }
        .mokkoi-device-menu::-webkit-scrollbar-thumb:hover { background: rgba(99,102,241,0.85); border: 2px solid #ffffff; background-clip: padding-box; }
      `}</style>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Device"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(prev => !prev)}
        style={{ ...BASE_BTN_STYLE, paddingRight: 26, position: 'relative', minWidth: 140, justifyContent: 'flex-start', gap: 6 }}
      >
        <span style={{ fontSize: 14, lineHeight: 1 }}>{device.icon}</span>
        <span>{device.name}</span>
        <ChevronDown
          size={14}
          style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b' }}
        />
      </button>
      {open && buttonRect && createPortal(
        // Outer wrapper holds the scrollable list AND a sticky fade-gradient
        // overlay that signals "more below." Without the overlay, users on
        // Windows Chrome who don't notice the scrollbar (even when styled)
        // assume the visible iPhones are the entire list and miss the
        // visually-different devices (Pixel/Galaxy/iPad) below.
        //
        // Rendered via createPortal into document.body. The toolbar has
        // `backdrop-filter: blur(8px)` which forms a stacking context, and
        // App.tsx's preview wrapper (later in DOM, position: relative) painted
        // on top of it — so the in-tree dropdown was visually visible but
        // pointer events at those coordinates went to the preview wrapper
        // instead. Portaling escapes the toolbar's stacking context entirely
        // so the panel sits at the document root with z-index 200 winning
        // unambiguously over everything else.
        <div ref={dropdownRef} style={{
          position: 'fixed',
          top: buttonRect.top,
          left: buttonRect.left,
          minWidth: 240,
          background: '#ffffff',
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: 8,
          boxShadow: '0 12px 32px rgba(15,23,42,0.14)',
          padding: 4,
          zIndex: 200,
          // Reserve a slim strip below the list for the "more devices" hint.
          paddingBottom: 0,
        }}>
        <div
          role="listbox"
          aria-label="Device"
          className="mokkoi-device-menu"
          style={{
            // 240px ≈ 6-7 items. Smaller than 320 so the cropping is OBVIOUS;
            // the user can see they're not at the bottom of the list.
            maxHeight: 240,
            overflowY: 'auto',
            // overscrollBehavior keeps wheel scrolls inside the dropdown so
            // page-level scrolls don't leak through once the user scrolls
            // past the top/bottom of the menu.
            overscrollBehavior: 'contain',
            // Firefox: prominent scrollbar with brand-purple thumb. Webkit
            // overrides come from the <style> block above.
            scrollbarWidth: 'auto',
            scrollbarColor: 'rgba(99,102,241,0.6) rgba(15,23,42,0.05)',
          }}
        >
          {DEVICE_PRESETS.map(d => {
            const isSelected = d.id === deviceId
            return (
              <button
                key={d.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => { onDeviceChange(d.id); setOpen(false) }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 6,
                  background: isSelected ? 'rgba(99,102,241,0.10)' : 'transparent',
                  border: 'none',
                  color: isSelected ? '#4F46E5' : '#334155',
                  fontSize: 13,
                  fontWeight: isSelected ? 600 : 500,
                  cursor: 'pointer',
                  textAlign: 'left' as const,
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(15,23,42,0.05)' }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, lineHeight: 1, width: 18, textAlign: 'center' }}>{d.icon}</span>
                  {d.name}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: isSelected ? '#6366F1' : '#94A3B8',
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: 500,
                    marginLeft: 12,
                  }}
                >
                  {d.width}×{d.height}
                </span>
              </button>
            )
          })}
        </div>
        {/* "More devices below" hint — sits below the scrollable list inside
         *  the dropdown frame. Visible at all times so it's clear the list
         *  is longer than the visible window, even when the user hasn't
         *  scrolled yet. The arrow + text make this far more obvious than
         *  a scrollbar alone (which Windows Chrome users frequently miss). */}
        <div
          aria-hidden="true"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '6px 8px 8px',
            borderTop: '1px solid rgba(15,23,42,0.06)',
            marginTop: 4,
            fontSize: 11, fontWeight: 500, color: '#64748b',
            letterSpacing: 0.2,
            userSelect: 'none' as const,
          }}
        >
          <span>Scroll for Pixel · Galaxy · iPad</span>
          <span style={{ animation: 'mokkoi-bounce-y 1.6s ease-in-out infinite', display: 'inline-block' }}>↓</span>
        </div>
        <style>{`@keyframes mokkoi-bounce-y { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(2px); } }`}</style>
        </div>,
        document.body,
      )}
    </div>
  )
}

export function PreviewToolbar({
  deviceId, onDeviceChange,
  effectiveScale, manualZoom, onZoomChange,
  onRefresh, onTestOnPhone,
}: PreviewToolbarProps) {
  const device = getDevicePreset(deviceId)
  const pct = Math.round(effectiveScale * 100)

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
      {/* Device dropdown — custom, supports right-aligned dimensions */}
      <DeviceDropdown deviceId={deviceId} onDeviceChange={onDeviceChange} />

      {/* Dimensions of the selected device — shown next to the dropdown for parity with Bolt */}
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
          onClick={() => onZoomChange(Math.max(MIN_ZOOM, (manualZoom ?? effectiveScale) - ZOOM_STEP))}
          style={{ ...BASE_BTN_STYLE, width: 28, padding: 0 }}
        >
          <Minus size={14} />
        </button>
        <button
          type="button"
          aria-label="Reset to auto-fit"
          title="Reset to auto-fit"
          onClick={() => onZoomChange(null)}
          style={{ ...BASE_BTN_STYLE, minWidth: 56, fontVariantNumeric: 'tabular-nums' }}
        >
          {pct}%
        </button>
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => onZoomChange(Math.min(MAX_ZOOM, (manualZoom ?? effectiveScale) + ZOOM_STEP))}
          style={{ ...BASE_BTN_STYLE, width: 28, padding: 0 }}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Refresh */}
      <button
        type="button"
        aria-label="Refresh preview"
        onClick={onRefresh}
        style={{ ...BASE_BTN_STYLE, width: 28, padding: 0 }}
      >
        <RotateCw size={14} />
      </button>

      {/* Test on phone — opens the Expo modal (QR + Snack mobile entry). The
       *  inline Snack iframe in the main pane is the primary preview; this
       *  button is the demoted "scan with Expo Go" path. Only renders when
       *  the parent passes a handler. */}
      {onTestOnPhone && (
        <button
          type="button"
          aria-label="Test on phone"
          title="Test on phone (Expo Go)"
          onClick={onTestOnPhone}
          style={{ ...BASE_BTN_STYLE, gap: 6 }}
        >
          <Smartphone size={14} />
          <span style={{ fontSize: 12 }}>Phone</span>
        </button>
      )}
    </div>
  )
}
