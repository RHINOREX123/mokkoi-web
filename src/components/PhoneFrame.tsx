import { useState, useEffect } from 'react'
import type { ComponentNode } from '../types/mokkoi'
import { ScreenRenderer } from './ScreenRenderer'

interface PhoneFrameProps {
  /** Component tree from AI-generated screen */
  generatedTree?: ComponentNode
  /** Whether a screen is currently being generated */
  isGenerating?: boolean
  /** Whether the response is actively streaming */
  isStreaming?: boolean
  /** Partial tree during streaming generation */
  streamingTree?: ComponentNode | null
  /** Data URL for uploaded screenshot images */
  imageUrl?: string
  /** Rendering mode: 'canvas' clips content, 'preview' allows scrolling */
  mode?: 'canvas' | 'preview'
}

/** Full device dimensions (iPhone 14/15) */
export const DEVICE_W = 390
export const DEVICE_H = 844

/** Scale factor for canvas display */
export const CANVAS_SCALE = 0.67

/** Visual dimensions on canvas after scaling */
export const CANVAS_W = Math.round(DEVICE_W * CANVAS_SCALE)   // ~261
export const CANVAS_H = Math.round(DEVICE_H * CANVAS_SCALE)   // ~565

const PROGRESS_MESSAGES = [
  { text: 'Analyzing prompt...', icon: '\u{1F9E0}' },
  { text: 'Creating layout...', icon: '\u{1F4D0}' },
  { text: 'Adding components...', icon: '\u{1F9E9}' },
  { text: 'Applying styles...', icon: '\u{1F3A8}' },
  { text: 'Finalizing design...', icon: '\u{2728}' },
]

function ShimmerSkeleton({ isStreaming }: { isStreaming?: boolean }) {
  const [msgIdx, setMsgIdx] = useState(0)

  useEffect(() => {
    setMsgIdx(0)
    const interval = setInterval(() => {
      setMsgIdx(i => (i + 1) % PROGRESS_MESSAGES.length)
    }, 3500)
    return () => clearInterval(interval)
  }, [])

  return (
    <div style={{ width: '100%', height: '100%', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Progress message */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: '10px 0 4px',
      }}>
        <span style={{ fontSize: 16 }}>{PROGRESS_MESSAGES[msgIdx].icon}</span>
        <span style={{
          fontSize: 12, fontWeight: 500, color: '#94A3B8',
          transition: 'opacity 0.3s ease',
        }}>
          {PROGRESS_MESSAGES[msgIdx].text}
        </span>
        {isStreaming && (
          <div style={{
            width: 5, height: 5, borderRadius: '50%', background: '#818CF8',
            animation: 'pulse 1.5s ease-in-out infinite',
          }} />
        )}
      </div>

      {/* Header shimmer */}
      <div className="shimmer-bar" style={{ width: '60%', height: 20, borderRadius: 8 }} />
      <div className="shimmer-bar" style={{ width: '40%', height: 14, borderRadius: 6, opacity: 0.6 }} />

      {/* Card shimmer */}
      <div style={{ marginTop: 8, borderRadius: 12, overflow: 'hidden' }}>
        <div className="shimmer-bar" style={{ width: '100%', height: 120, borderRadius: 12 }} />
      </div>

      {/* List items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
        {[0.9, 0.7, 0.8, 0.5].map((w, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div className="shimmer-bar" style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="shimmer-bar" style={{ width: `${w * 100}%`, height: 12, borderRadius: 6 }} />
              <div className="shimmer-bar" style={{ width: `${w * 60}%`, height: 10, borderRadius: 5, opacity: 0.5 }} />
            </div>
          </div>
        ))}
      </div>

      {/* Bottom bar shimmer */}
      <div style={{ marginTop: 'auto', display: 'flex', gap: 8, justifyContent: 'space-around' }}>
        {[0,1,2,3].map(i => (
          <div key={i} className="shimmer-bar" style={{ width: 32, height: 32, borderRadius: 8 }} />
        ))}
      </div>

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  )
}

export function PhoneFrame({ generatedTree, isGenerating, isStreaming, streamingTree, imageUrl, mode = 'canvas' }: PhoneFrameProps) {
  const isCanvas = mode === 'canvas'

  const phoneChassisEl = (
    <div
      className="relative rounded-[48px]"
      style={{
        width: DEVICE_W, height: DEVICE_H,
        border: '2px solid rgba(255,255,255,0.15)',
        boxShadow: '0 0 60px rgba(99,102,241,0.06)',
      }}
    >
      {/* Inner bezel */}
      <div className="w-full h-full rounded-[46px] bg-black p-3 flex flex-col overflow-hidden">
        {/* Status bar */}
        <div className="flex items-center justify-between px-5 pt-1 pb-2 shrink-0">
          <span className="text-[11px] font-semibold text-white/80 font-mono">9:41</span>
          <div className="w-[90px] h-[28px] rounded-full bg-black" />
          <div className="flex items-center gap-1">
            <svg width="14" height="12" viewBox="0 0 12 10" fill="white" opacity="0.7">
              <rect x="0" y="6" width="2" height="4" rx="0.5"/>
              <rect x="3" y="4" width="2" height="6" rx="0.5"/>
              <rect x="6" y="2" width="2" height="8" rx="0.5"/>
              <rect x="9" y="0" width="2" height="10" rx="0.5"/>
            </svg>
          </div>
        </div>

        {/* Screen content area */}
        <style>{`.phone-screen::-webkit-scrollbar { display: none; }`}</style>
        <div
          className="flex-1 rounded-b-[36px] overflow-hidden phone-screen"
          style={{
            backgroundColor: '#0F172A',
            overflowX: 'hidden',
            overflowY: isCanvas ? 'hidden' : 'auto',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
          }}
        >
          {isGenerating && isStreaming && streamingTree ? (
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
              {/* Streaming progress indicator */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
                height: 2, background: 'rgba(129,140,248,0.15)', overflow: 'hidden',
              }}>
                <div style={{
                  width: '40%', height: '100%',
                  background: 'linear-gradient(90deg, transparent, #818CF8, transparent)',
                  animation: 'mokkoi-stream-progress 1.5s ease-in-out infinite',
                }} />
              </div>
              {/* "Generating..." badge */}
              <div style={{
                position: 'absolute', top: 6, right: 6, zIndex: 10,
                padding: '2px 8px', borderRadius: 8,
                background: 'rgba(129,140,248,0.15)',
                border: '1px solid rgba(129,140,248,0.25)',
                fontSize: 9, fontWeight: 600, color: '#818CF8',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <div style={{
                  width: 4, height: 4, borderRadius: '50%', background: '#818CF8',
                  animation: 'pulse 1.5s ease-in-out infinite',
                }} />
                Generating...
              </div>
              {/* Render partial tree */}
              <ScreenRenderer tree={streamingTree} />
              <style>{`
                @keyframes mokkoi-stream-progress {
                  0% { transform: translateX(-100%); }
                  100% { transform: translateX(350%); }
                }
              `}</style>
            </div>
          ) : isGenerating ? (
            <ShimmerSkeleton isStreaming={isStreaming} />
          ) : imageUrl ? (
            <img
              src={imageUrl}
              alt="Uploaded screenshot"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              draggable={false}
            />
          ) : generatedTree ? (
            <ScreenRenderer tree={generatedTree} />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 px-6">
              <div className="w-10 h-10 rounded-xl bg-mokkoi-accent/10 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#818CF8" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M4 10h12M10 4v12" />
                </svg>
              </div>
              <div className="text-center">
                <div className="text-[12px] text-mokkoi-text-dim leading-relaxed">
                  Describe a screen below<br />to get started
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Home indicator */}
        <div className="flex justify-center pt-2 pb-1 shrink-0">
          <div className="w-[120px] h-[4px] rounded-full bg-white/20" />
        </div>
      </div>
    </div>
  )

  if (isCanvas) {
    // Canvas mode: scale down to fit canvas layout, clip content
    return (
      <div style={{
        width: CANVAS_W,
        height: CANVAS_H,
        overflow: 'hidden',
      }}>
        <div style={{
          transform: `scale(${CANVAS_SCALE})`,
          transformOrigin: 'top left',
        }}>
          {phoneChassisEl}
        </div>
      </div>
    )
  }

  // Preview mode: full size, scroll enabled
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {phoneChassisEl}
    </div>
  )
}
