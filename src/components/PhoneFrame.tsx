import type { ComponentNode } from '../types/mokkoi'
import { ScreenRenderer } from './ScreenRenderer'

interface PhoneFrameProps {
  /** Component tree from AI-generated screen */
  generatedTree?: ComponentNode
  /** Whether a screen is currently being generated */
  isGenerating?: boolean
  /** Data URL for uploaded screenshot images */
  imageUrl?: string
}

const PHONE_W = 261
const PHONE_H = 560

function ShimmerSkeleton() {
  return (
    <div style={{ width: '100%', height: '100%', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
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
    </div>
  )
}

export function PhoneFrame({ generatedTree, isGenerating, imageUrl }: PhoneFrameProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Phone chassis */}
      <div
        className="relative rounded-[48px]"
        style={{
          width: PHONE_W, height: PHONE_H,
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
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
            }}
          >
            {isGenerating ? (
              <ShimmerSkeleton />
            ) : imageUrl ? (
              <img
                src={imageUrl}
                alt="Uploaded screenshot"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                draggable={false}
              />
            ) : generatedTree ? (
              <div
                className="phone-screen"
                style={{
                  width: '100%',
                  minHeight: '100%',
                  overflowY: 'auto',
                  WebkitOverflowScrolling: 'touch',
                  scrollbarWidth: 'none',
                }}
              >
                <ScreenRenderer tree={generatedTree} />
              </div>
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
    </div>
  )
}
