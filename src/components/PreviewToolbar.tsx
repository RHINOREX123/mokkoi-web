import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Minus, Plus, RotateCw } from 'lucide-react'
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
  const wrapRef = useRef<HTMLDivElement>(null)
  const device = getDevicePreset(deviceId)

  useEffect(() => {
    if (!open) return
    const onDocMouseDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
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
      {open && (
        <div
          role="listbox"
          aria-label="Device"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            minWidth: 240,
            maxHeight: 360,
            overflowY: 'auto',
            background: '#ffffff',
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 8,
            boxShadow: '0 12px 32px rgba(15,23,42,0.14)',
            padding: 4,
            zIndex: 200,
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
      )}
    </div>
  )
}

export function PreviewToolbar({
  deviceId, onDeviceChange,
  effectiveScale, manualZoom, onZoomChange,
  onRefresh,
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
    </div>
  )
}
