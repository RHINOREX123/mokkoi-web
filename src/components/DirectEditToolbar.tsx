import { useState, useRef, useEffect } from 'react'
import {
  Type, Palette, Minus, Plus, Move, Trash2,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Sparkles,
  Bold, Italic, AlignLeft, AlignCenter, AlignRight,
  SquareDashed, Eye, EyeOff,
} from 'lucide-react'

interface DirectEditToolbarProps {
  target: HTMLElement
  phoneFrameEl: HTMLElement
  onClose: () => void
  onChanged: () => void
  /** Called when user submits a scoped AI prompt for the selected element. */
  onAskAI?: (prompt: string, elementDescription: string) => void
}

/** Build a short human-readable description of an element so the AI knows
 *  which node on the screen to change. Keep it tight — the AI also sees the
 *  full tree, we just need a disambiguating hint. */
function describeElement(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase()
  const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60)
  if (text) return `${tag} containing "${text}"`
  const cls = el.className && typeof el.className === 'string' ? el.className.split(/\s+/)[0] : ''
  if (cls) return `${tag}.${cls}`
  return tag
}

const PRESET_COLORS = [
  '#FFFFFF', '#000000', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899',
]

export function DirectEditToolbar({ target, phoneFrameEl, onClose, onChanged, onAskAI }: DirectEditToolbarProps) {
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showSizePicker, setShowSizePicker] = useState(false)
  const [showMovePicker, setShowMovePicker] = useState(false)
  const [showStylePicker, setShowStylePicker] = useState(false)
  const [showAskAI, setShowAskAI] = useState(false)
  const [askAIValue, setAskAIValue] = useState('')
  const [customColor, setCustomColor] = useState('#3B82F6')
  const toolbarRef = useRef<HTMLDivElement>(null)
  const askAIInputRef = useRef<HTMLInputElement>(null)

  const closeAllPopovers = () => {
    setShowColorPicker(false)
    setShowSizePicker(false)
    setShowMovePicker(false)
    setShowStylePicker(false)
    setShowAskAI(false)
  }

  const submitAskAI = () => {
    const text = askAIValue.trim()
    if (!text || !onAskAI) return
    onAskAI(text, describeElement(target))
    setAskAIValue('')
    setShowAskAI(false)
    // Exit the selection — the AI is taking over this element
    onClose()
  }

  const tagInTextList = ['SPAN', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'A', 'LABEL'].includes(target.tagName)
  const onlyTextChildren = target.childNodes.length > 0 &&
    Array.from(target.childNodes).every(n => n.nodeType === Node.TEXT_NODE)
  const buttonWithTextOnly = target.tagName === 'BUTTON' && onlyTextChildren
  const isTextElement = tagInTextList || onlyTextChildren || buttonWithTextOnly

  // Position the toolbar near the selected element
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    const updatePosition = () => {
      const rect = target.getBoundingClientRect()
      const frameRect = phoneFrameEl.getBoundingClientRect()
      // Position above the element, relative to the phone frame's parent (canvas).
      // If there's no room above (e.g. element is the screen title), flip below.
      // Clamp left so the toolbar (~120px wide w/ translateX(-50%)) stays inside
      // the phone frame.
      const proposedTop = rect.top - frameRect.top - 44
      setPos({
        top: proposedTop < 4 ? rect.bottom - frameRect.top + 8 : proposedTop,
        left: Math.max(60, Math.min(rect.left - frameRect.left + rect.width / 2, frameRect.width - 60)),
      })
    }
    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    return () => window.removeEventListener('scroll', updatePosition, true)
  }, [target, phoneFrameEl])

  const handleEditText = () => {
    target.contentEditable = 'true'
    target.focus()
    target.style.outline = '1px solid #3B82F6'
    target.style.borderRadius = '2px'
    // Select all text
    const range = document.createRange()
    range.selectNodeContents(target)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)

    const handleBlur = () => {
      target.contentEditable = 'false'
      target.style.outline = ''
      target.removeEventListener('blur', handleBlur)
      target.removeEventListener('keydown', handleKeyDown)
      onChanged()
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        target.blur()
      }
      if (e.key === 'Escape') {
        target.blur()
      }
    }
    target.addEventListener('blur', handleBlur)
    target.addEventListener('keydown', handleKeyDown)
  }

  const applyColor = (color: string) => {
    // For text elements, change text color; for others, change background
    if (isTextElement) {
      target.style.color = color
    } else {
      target.style.backgroundColor = color
    }
    onChanged()
    setShowColorPicker(false)
  }

  const changeSize = (delta: number) => {
    const computed = window.getComputedStyle(target)
    if (isTextElement) {
      const currentSize = parseFloat(computed.fontSize) || 14
      target.style.fontSize = `${Math.max(8, currentSize + delta)}px`
    } else {
      // For non-text elements, change padding
      const currentPadding = parseFloat(computed.padding) || 0
      target.style.padding = `${Math.max(0, currentPadding + delta)}px`
    }
    onChanged()
  }

  const nudge = (dx: number, dy: number) => {
    const computed = window.getComputedStyle(target)
    if (computed.position === 'static') {
      target.style.position = 'relative'
    }
    // Constrain to parent so repeated nudges can't push the element off-screen
    // with no way to bring it back. Snap-reject the move when it would leave
    // less than 4px of the element visible inside its parent.
    const parent = target.parentElement
    if (parent) {
      const parentRect = parent.getBoundingClientRect()
      const targetRect = target.getBoundingClientRect()
      const newLeftViewport = targetRect.left + dx
      const newTopViewport = targetRect.top + dy
      if (newLeftViewport + targetRect.width < parentRect.left + 4) return
      if (newLeftViewport > parentRect.right - 4) return
      if (newTopViewport + targetRect.height < parentRect.top + 4) return
      if (newTopViewport > parentRect.bottom - 4) return
    }
    const currentTop = parseFloat(target.style.top) || 0
    const currentLeft = parseFloat(target.style.left) || 0
    target.style.top = `${currentTop + dy}px`
    target.style.left = `${currentLeft + dx}px`
    onChanged()
  }

  const handleDelete = () => {
    target.remove()
    onChanged()
    onClose()
  }

  // ─── Phase 1 visual edits: toggle/cycle helpers ────────────────────────────
  // These all read computed style first so we know what to toggle relative to,
  // even if the property hasn't been set inline yet (default case for fresh
  // generated screens that have no inline overrides).

  const toggleBold = () => {
    const computed = window.getComputedStyle(target)
    const isBold = parseInt(computed.fontWeight, 10) >= 600 || computed.fontWeight === 'bold'
    target.style.fontWeight = isBold ? '400' : '700'
    onChanged()
  }

  const toggleItalic = () => {
    const computed = window.getComputedStyle(target)
    const isItalic = computed.fontStyle === 'italic'
    target.style.fontStyle = isItalic ? 'normal' : 'italic'
    onChanged()
  }

  const setAlign = (align: 'left' | 'center' | 'right') => {
    target.style.textAlign = align
    onChanged()
  }

  const changeRadius = (delta: number) => {
    const computed = window.getComputedStyle(target)
    const current = parseFloat(computed.borderRadius) || 0
    target.style.borderRadius = `${Math.max(0, Math.min(64, current + delta))}px`
    onChanged()
  }

  const toggleBorder = () => {
    const computed = window.getComputedStyle(target)
    const hasBorder = parseFloat(computed.borderTopWidth) > 0
    target.style.border = hasBorder ? 'none' : '1px solid rgba(255,255,255,0.25)'
    onChanged()
  }

  const changeOpacity = (delta: number) => {
    const computed = window.getComputedStyle(target)
    const current = parseFloat(computed.opacity)
    const next = Math.max(0.1, Math.min(1, (isFinite(current) ? current : 1) + delta))
    target.style.opacity = String(Number(next.toFixed(2)))
    onChanged()
  }

  const toggleVisibility = () => {
    // Use visibility (preserves layout) rather than display: none so the user
    // can still see the outline of the hidden element and un-hide it.
    const computed = window.getComputedStyle(target)
    const isHidden = computed.visibility === 'hidden'
    target.style.visibility = isHidden ? 'visible' : 'hidden'
    onChanged()
  }

  // Used by toggle buttons below to render an "active" highlight
  const isBoldActive = () => {
    const c = window.getComputedStyle(target)
    return parseInt(c.fontWeight, 10) >= 600 || c.fontWeight === 'bold'
  }
  const isItalicActive = () => window.getComputedStyle(target).fontStyle === 'italic'
  const currentAlign = (): 'left' | 'center' | 'right' => {
    const a = window.getComputedStyle(target).textAlign
    if (a === 'center' || a === 'right' || a === 'left') return a
    return 'left'
  }
  const isHiddenActive = () => window.getComputedStyle(target).visibility === 'hidden'

  const btnStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
    padding: '4px 8px', borderRadius: 6,
    background: 'transparent', border: 'none',
    color: '#e2e8f0', fontSize: 11, fontWeight: 500,
    cursor: 'pointer', whiteSpace: 'nowrap',
    transition: 'background 0.15s',
  }

  return (
    <div
      ref={toolbarRef}
      style={{
        position: 'absolute',
        top: pos.top,
        left: pos.left,
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: '4px 6px',
        background: '#1A1A1A',
        borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        zIndex: 200,
        whiteSpace: 'nowrap',
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* Edit Text — only for text elements */}
      {isTextElement && (
        <button
          style={btnStyle}
          onClick={handleEditText}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          title="Edit text"
        >
          <Type size={12} />
          Edit
        </button>
      )}

      {/* Color picker */}
      <div style={{ position: 'relative' }}>
        <button
          style={btnStyle}
          onClick={() => { const next = !showColorPicker; closeAllPopovers(); setShowColorPicker(next) }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          title="Change color"
        >
          <Palette size={12} />
          Color
        </button>
        {showColorPicker && (
          <div style={{
            position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
            marginTop: 6,
            background: '#1A1A1A', borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            padding: 8, width: 160,
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, marginBottom: 6 }}>
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => applyColor(c)}
                  style={{
                    width: 28, height: 28, borderRadius: 6,
                    background: c, border: '2px solid rgba(255,255,255,0.15)',
                    cursor: 'pointer', transition: 'transform 0.1s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.15)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
                />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                type="text"
                value={customColor}
                onChange={e => setCustomColor(e.target.value)}
                placeholder="#hex"
                style={{
                  flex: 1, padding: '4px 6px', borderRadius: 6,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#e2e8f0', fontSize: 11, outline: 'none',
                }}
                onKeyDown={e => { if (e.key === 'Enter') applyColor(customColor) }}
              />
              <button
                onClick={() => applyColor(customColor)}
                style={{
                  padding: '4px 8px', borderRadius: 6,
                  background: customColor, border: 'none',
                  color: '#fff', fontSize: 10, fontWeight: 600, cursor: 'pointer',
                }}
              >
                OK
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Size / Type — text-only. Non-text elements use the Style popover for
          radius / border / opacity / visibility instead; the previous "Size"
          variant adjusted padding, which made inner content look smaller when
          users pressed +, opposite of intent. */}
      {isTextElement && (
      <div style={{ position: 'relative' }}>
        <button
          style={btnStyle}
          onClick={() => { const next = !showSizePicker; closeAllPopovers(); setShowSizePicker(next) }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          title="Text formatting"
        >
          <Type size={12} />
          Type
        </button>
        {showSizePicker && (
          <div style={{
            position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
            marginTop: 6,
            background: '#1A1A1A', borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            padding: 6,
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            {/* Size row — text only (parent is gated on isTextElement). */}
            {isTextElement && (
            <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
              <button
                onClick={() => changeSize(-2)}
                style={{ ...btnStyle, padding: '6px 10px' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                title="Smaller text"
              >
                <Minus size={14} />
              </button>
              <button
                onClick={() => changeSize(2)}
                style={{ ...btnStyle, padding: '6px 10px' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                title="Larger text"
              >
                <Plus size={14} />
              </button>
            </div>
            )}

            {/* Text-only controls — bold / italic and alignment.
                Hidden for non-text elements where they'd do nothing useful. */}
            {isTextElement && (
              <>
                <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '2px 0' }} />
                <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                  <button
                    onClick={toggleBold}
                    style={{
                      ...btnStyle, padding: '6px 10px',
                      background: isBoldActive() ? 'rgba(129,140,248,0.2)' : 'transparent',
                      color: isBoldActive() ? '#a5b4fc' : '#e2e8f0',
                    }}
                    onMouseEnter={e => { if (!isBoldActive()) e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = isBoldActive() ? 'rgba(129,140,248,0.2)' : 'transparent' }}
                    title="Bold"
                  >
                    <Bold size={14} />
                  </button>
                  <button
                    onClick={toggleItalic}
                    style={{
                      ...btnStyle, padding: '6px 10px',
                      background: isItalicActive() ? 'rgba(129,140,248,0.2)' : 'transparent',
                      color: isItalicActive() ? '#a5b4fc' : '#e2e8f0',
                    }}
                    onMouseEnter={e => { if (!isItalicActive()) e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = isItalicActive() ? 'rgba(129,140,248,0.2)' : 'transparent' }}
                    title="Italic"
                  >
                    <Italic size={14} />
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                  {(['left', 'center', 'right'] as const).map(a => {
                    const active = currentAlign() === a
                    const Icon = a === 'left' ? AlignLeft : a === 'center' ? AlignCenter : AlignRight
                    return (
                      <button
                        key={a}
                        onClick={() => setAlign(a)}
                        style={{
                          ...btnStyle, padding: '6px 10px',
                          background: active ? 'rgba(129,140,248,0.2)' : 'transparent',
                          color: active ? '#a5b4fc' : '#e2e8f0',
                        }}
                        onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = active ? 'rgba(129,140,248,0.2)' : 'transparent' }}
                        title={`Align ${a}`}
                      >
                        <Icon size={14} />
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>
      )}

      {/* Move */}
      <div style={{ position: 'relative' }}>
        <button
          style={btnStyle}
          onClick={() => { const next = !showMovePicker; closeAllPopovers(); setShowMovePicker(next) }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          title="Move element"
        >
          <Move size={12} />
          Move
        </button>
        {showMovePicker && (
          <div style={{
            position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
            marginTop: 6,
            background: '#1A1A1A', borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            padding: 6, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, width: 100,
          }}>
            <div />
            <button onClick={() => nudge(0, -4)} style={btnStyle} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}><ArrowUp size={14} /></button>
            <div />
            <button onClick={() => nudge(-4, 0)} style={btnStyle} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}><ArrowLeft size={14} /></button>
            <div />
            <button onClick={() => nudge(4, 0)} style={btnStyle} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}><ArrowRight size={14} /></button>
            <div />
            <button onClick={() => nudge(0, 4)} style={btnStyle} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}><ArrowDown size={14} /></button>
            <div />
          </div>
        )}
      </div>

      {/* Style — radius / border / opacity / visibility.
          Grouped together because they're all "tweak the look" controls
          that aren't size or color. Works on any element type. */}
      <div style={{ position: 'relative' }}>
        <button
          style={btnStyle}
          onClick={() => { const next = !showStylePicker; closeAllPopovers(); setShowStylePicker(next) }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          title="Style: radius, border, opacity, visibility"
        >
          <SquareDashed size={12} />
          Style
        </button>
        {showStylePicker && (
          <div style={{
            position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
            marginTop: 6,
            background: '#1A1A1A', borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            padding: 8, width: 180,
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            {/* Radius row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>Radius</span>
              <div style={{ display: 'flex', gap: 2 }}>
                <button
                  onClick={() => changeRadius(-4)}
                  style={{ ...btnStyle, padding: '4px 8px' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  title="Less radius"
                >
                  <Minus size={12} />
                </button>
                <button
                  onClick={() => changeRadius(4)}
                  style={{ ...btnStyle, padding: '4px 8px' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  title="More radius"
                >
                  <Plus size={12} />
                </button>
              </div>
            </div>

            {/* Border toggle row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>Border</span>
              <button
                onClick={toggleBorder}
                style={{ ...btnStyle, padding: '4px 10px', fontSize: 10 }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                title="Toggle border"
              >
                Toggle
              </button>
            </div>

            {/* Opacity row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>Opacity</span>
              <div style={{ display: 'flex', gap: 2 }}>
                <button
                  onClick={() => changeOpacity(-0.1)}
                  style={{ ...btnStyle, padding: '4px 8px' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  title="More transparent"
                >
                  <Minus size={12} />
                </button>
                <button
                  onClick={() => changeOpacity(0.1)}
                  style={{ ...btnStyle, padding: '4px 8px' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  title="More opaque"
                >
                  <Plus size={12} />
                </button>
              </div>
            </div>

            {/* Visibility row — uses visibility:hidden so layout is preserved
                and the user can still find + un-hide the element */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>
                {isHiddenActive() ? 'Hidden' : 'Visible'}
              </span>
              <button
                onClick={toggleVisibility}
                style={{
                  ...btnStyle, padding: '4px 8px',
                  background: isHiddenActive() ? 'rgba(129,140,248,0.2)' : 'transparent',
                  color: isHiddenActive() ? '#a5b4fc' : '#e2e8f0',
                }}
                onMouseEnter={e => { if (!isHiddenActive()) e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                onMouseLeave={e => { e.currentTarget.style.background = isHiddenActive() ? 'rgba(129,140,248,0.2)' : 'transparent' }}
                title={isHiddenActive() ? 'Show element' : 'Hide element'}
              >
                {isHiddenActive() ? <EyeOff size={12} /> : <Eye size={12} />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Ask AI — scoped edit for the selected element */}
      {onAskAI && (
        <div style={{ position: 'relative' }}>
          <button
            style={btnStyle}
            onClick={() => {
              const next = !showAskAI
              closeAllPopovers()
              setShowAskAI(next)
              if (next) setTimeout(() => askAIInputRef.current?.focus(), 0)
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(129,140,248,0.15)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            title="Ask Mokkoi to change this element"
          >
            <Sparkles size={12} color="#a5b4fc" />
            <span style={{ color: '#a5b4fc' }}>Ask Mokkoi</span>
          </button>
          {showAskAI && (
            <div
              style={{
                position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                marginTop: 6,
                background: '#1A1A1A', borderRadius: 10,
                border: '1px solid rgba(129,140,248,0.35)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                padding: 8, width: 260,
                display: 'flex', flexDirection: 'column', gap: 6,
              }}
            >
              <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.4 }}>
                Describe a change to <span style={{ color: '#a5b4fc', fontWeight: 600 }}>{describeElement(target)}</span>
              </div>
              <input
                ref={askAIInputRef}
                type="text"
                value={askAIValue}
                onChange={e => setAskAIValue(e.target.value)}
                placeholder="e.g. make this bolder, change copy to Join Now"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '6px 8px', borderRadius: 6,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#e2e8f0', fontSize: 11, outline: 'none',
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); submitAskAI() }
                  if (e.key === 'Escape') { e.preventDefault(); setShowAskAI(false) }
                }}
              />
              <button
                onClick={submitAskAI}
                disabled={!askAIValue.trim()}
                style={{
                  padding: '5px 10px', borderRadius: 6,
                  background: askAIValue.trim() ? 'linear-gradient(135deg, #6366f1, #818cf8)' : 'rgba(255,255,255,0.06)',
                  border: 'none',
                  color: askAIValue.trim() ? '#fff' : '#64748b',
                  fontSize: 11, fontWeight: 600,
                  cursor: askAIValue.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                Send to Mokkoi
              </button>
            </div>
          )}
        </div>
      )}

      {/* Separator */}
      <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.1)', margin: '0 2px' }} />

      {/* Delete */}
      <button
        style={{ ...btnStyle, color: '#f87171' }}
        onClick={handleDelete}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.1)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        title="Delete element"
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}
