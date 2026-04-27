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
