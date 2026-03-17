import { useState } from 'react'
import { X, Minus, Plus } from 'lucide-react'

interface VariationsPanelProps {
  isOpen: boolean
  onClose: () => void
  onGenerate: (settings: VariationSettings) => void
  isGenerating: boolean
}

export interface VariationSettings {
  count: number
  creativeRange: 'refine' | 'explore' | 'reimagine'
  customInstructions: string
  aspects: {
    layout: boolean
    colorScheme: boolean
    images: boolean
    textFont: boolean
    textContent: boolean
  }
}

const CREATIVE_RANGES = [
  { id: 'refine' as const, label: 'Refine', desc: 'Small tweaks' },
  { id: 'explore' as const, label: 'Explore', desc: 'Moderate changes' },
  { id: 'reimagine' as const, label: 'Reimagine', desc: 'Completely different' },
]

const ASPECTS = [
  { key: 'layout' as const, label: 'Layout' },
  { key: 'colorScheme' as const, label: 'Color scheme' },
  { key: 'images' as const, label: 'Images' },
  { key: 'textFont' as const, label: 'Text font' },
  { key: 'textContent' as const, label: 'Text content' },
]

export function VariationsPanel({ isOpen, onClose, onGenerate, isGenerating }: VariationsPanelProps) {
  const [count, setCount] = useState(3)
  const [creativeRange, setCreativeRange] = useState<'refine' | 'explore' | 'reimagine'>('explore')
  const [customInstructions, setCustomInstructions] = useState('')
  const [aspects, setAspects] = useState({
    layout: false,
    colorScheme: false,
    images: false,
    textFont: false,
    textContent: false,
  })

  const toggleAspect = (key: keyof typeof aspects) => {
    setAspects(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleGenerate = () => {
    onGenerate({ count, creativeRange, customInstructions, aspects })
  }

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 40,
            background: 'transparent',
          }}
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 320,
          background: '#1A1A1A',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: isOpen ? '-8px 0 32px rgba(0,0,0,0.4)' : 'none',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>
            Generate variations
          </span>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#94a3b8', cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Number of options */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Number of options
            </label>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              marginTop: 10,
            }}>
              <button
                onClick={() => setCount(c => Math.max(1, c - 1))}
                disabled={count <= 1}
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: count <= 1 ? '#444' : '#e2e8f0',
                  cursor: count <= 1 ? 'default' : 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <Minus size={14} />
              </button>
              <span style={{
                fontSize: 18, fontWeight: 600, color: '#fff',
                minWidth: 24, textAlign: 'center',
              }}>
                {count}
              </span>
              <button
                onClick={() => setCount(c => Math.min(4, c + 1))}
                disabled={count >= 4}
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: count >= 4 ? '#444' : '#e2e8f0',
                  cursor: count >= 4 ? 'default' : 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Creative range */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Creative range
            </label>
            <div style={{
              display: 'flex', gap: 6,
              marginTop: 10,
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 10,
              padding: 3,
            }}>
              {CREATIVE_RANGES.map(range => {
                const isActive = creativeRange === range.id
                return (
                  <button
                    key={range.id}
                    onClick={() => setCreativeRange(range.id)}
                    style={{
                      flex: 1,
                      padding: '8px 4px',
                      borderRadius: 8,
                      border: 'none',
                      background: isActive
                        ? 'linear-gradient(135deg, #6366f1, #818cf8)'
                        : 'transparent',
                      color: isActive ? '#fff' : '#94a3b8',
                      fontSize: 12,
                      fontWeight: isActive ? 600 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {range.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Custom instructions */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Custom instructions
            </label>
            <textarea
              value={customInstructions}
              onChange={e => setCustomInstructions(e.target.value)}
              placeholder="Additional instructions..."
              style={{
                width: '100%',
                minHeight: 80,
                marginTop: 10,
                padding: 12,
                borderRadius: 10,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#e2e8f0',
                fontSize: 13,
                resize: 'vertical',
                outline: 'none',
                fontFamily: 'inherit',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
            />
          </div>

          {/* Aspects to vary */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Aspects to vary
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>
              {ASPECTS.map(aspect => {
                const isOn = aspects[aspect.key]
                return (
                  <button
                    key={aspect.key}
                    onClick={() => toggleAspect(aspect.key)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <span style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500 }}>
                      {aspect.label}
                    </span>
                    {/* Toggle switch */}
                    <div style={{
                      width: 36, height: 20, borderRadius: 10,
                      background: isOn
                        ? 'linear-gradient(135deg, #6366f1, #818cf8)'
                        : 'rgba(255,255,255,0.1)',
                      padding: 2,
                      transition: 'background 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                    }}>
                      <div style={{
                        width: 16, height: 16, borderRadius: 8,
                        background: '#fff',
                        transform: isOn ? 'translateX(16px)' : 'translateX(0)',
                        transition: 'transform 0.2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                      }} />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Generate button */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 10,
              background: isGenerating
                ? 'rgba(99,102,241,0.3)'
                : 'linear-gradient(135deg, #6366f1, #818cf8)',
              border: 'none',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: isGenerating ? 'default' : 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {isGenerating ? (
              <>
                <span className="inline-flex gap-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-[bounce_1.4s_ease-in-out_infinite]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-[bounce_1.4s_ease-in-out_0.2s_infinite]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-[bounce_1.4s_ease-in-out_0.4s_infinite]" />
                </span>
                Generating...
              </>
            ) : (
              'Generate variations'
            )}
          </button>
        </div>
      </div>
    </>
  )
}
