import type { ReactNode } from 'react'
import { getDevicePreset, DEFAULT_DEVICE } from '../constants/devices'

interface RuntimePhoneFrameProps {
  /** Device id from constants/devices.ts. Falls back to DEFAULT_DEVICE. */
  deviceId?: string
  /** Display zoom (1.0 = device pixel size). Applied via CSS transform. */
  zoom?: number
  /** Screen content — typically an iframe sized to device.width × device.height. */
  children: ReactNode
}

/** Visual phone-frame chrome (bezel, status bar, home indicator) for the runtime POC.
 *
 *  This is intentionally a separate component from PhoneFrame.tsx because PhoneFrame
 *  embeds its own content (ScreenRenderer / image / shimmer) and has no children
 *  slot. Here the content is an iframe owned by the parent — different concern. */
export function RuntimePhoneFrame({ deviceId, zoom = 1, children }: RuntimePhoneFrameProps) {
  const device = getDevicePreset(deviceId || DEFAULT_DEVICE)
  const isAndroid = device.category === 'Android'

  // Bezel padding (the black ring of the inner-bezel div). Matches PhoneFrame's `p-3`.
  const BEZEL = 12
  const STATUS_BAR_H = isAndroid ? 24 : 32
  const HOME_INDICATOR_H = 16
  const chassisW = device.width + BEZEL * 2
  const chassisH = device.height + BEZEL * 2 + STATUS_BAR_H + HOME_INDICATOR_H

  return (
    <div style={{
      width: chassisW * zoom,
      height: chassisH * zoom,
      flexShrink: 0,
    }}>
      <div style={{
        width: chassisW,
        height: chassisH,
        transform: `scale(${zoom})`,
        transformOrigin: 'top left',
        borderRadius: isAndroid ? 36 : 48,
        border: '2px solid rgba(255,255,255,0.15)',
        boxShadow: '0 0 60px rgba(99,102,241,0.06)',
        background: '#000',
        padding: BEZEL,
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
      }}>
        {/* Status bar */}
        {isAndroid ? (
          <div style={{
            height: STATUS_BAR_H, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 16px', flexShrink: 0,
          }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.8)', fontFamily: 'monospace' }}>12:00</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="white" opacity="0.6">
                <rect x="0" y="7" width="2" height="5" rx="0.5" />
                <rect x="3.5" y="4" width="2" height="8" rx="0.5" />
                <rect x="7" y="1" width="2" height="11" rx="0.5" />
              </svg>
              <svg width="14" height="10" viewBox="0 0 14 10" fill="none" stroke="white" strokeWidth="1.2" opacity="0.6">
                <rect x="0.5" y="1" width="11" height="8" rx="1.5" />
                <rect x="12" y="3.5" width="1.5" height="3" rx="0.5" fill="white" />
                <rect x="2" y="2.5" width="7" height="5" rx="0.5" fill="white" opacity="0.6" />
              </svg>
            </div>
          </div>
        ) : (
          <div style={{
            height: STATUS_BAR_H, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 20px', flexShrink: 0,
          }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.8)', fontFamily: 'monospace' }}>9:41</span>
            <div style={{ width: 90, height: 24, borderRadius: 999, background: '#000' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="14" height="12" viewBox="0 0 12 10" fill="white" opacity="0.7">
                <rect x="0" y="6" width="2" height="4" rx="0.5" />
                <rect x="3" y="4" width="2" height="6" rx="0.5" />
                <rect x="6" y="2" width="2" height="8" rx="0.5" />
                <rect x="9" y="0" width="2" height="10" rx="0.5" />
              </svg>
            </div>
          </div>
        )}

        {/* Screen content area — iframe goes here */}
        <div style={{
          width: device.width,
          height: device.height,
          borderRadius: isAndroid ? '0 0 24px 24px' : '0 0 36px 36px',
          overflow: 'hidden',
          background: '#0F172A',
          flexShrink: 0,
        }}>
          {children}
        </div>

        {/* Home indicator */}
        <div style={{
          height: HOME_INDICATOR_H, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <div style={{
            width: isAndroid ? 100 : 120, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.2)',
          }} />
        </div>
      </div>
    </div>
  )
}
