import { useState, useRef, useEffect } from 'react'
import { Type, Palette, Minus, Plus, Move, Trash2, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react'

interface DirectEditToolbarProps {
  target: HTMLElement
  phoneFrameEl: HTMLElement
  onClose: () => void
  onChanged: () => void
}

const PRESET_COLORS = [
  '#FFFFFF', '#000000', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899',
]

export function DirectEditToolbar({ target, phoneFrameEl, onClose, onChanged }: DirectEditToolbarProps) {
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showSizePicker, setShowSizePicker] = useState(false)
  const [showMovePicker, setShowMovePicker] = useState(false)
  const [customColor, setCustomColor] = useState('#3B82F6')
  const toolbarRef = useRef<HTMLDivElement>(null)

  const isTextElement = ['SPAN', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'A', 'LABEL', 'BUTTON'].includes(target.tagName) ||
    (target.childNodes.length > 0 && Array.from(target.childNodes).every(n => n.nodeType === Node.TEXT_NODE))

  // Position the toolbar near the selected element
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    const updatePosition = () => {
      const rect = target.getBoundingClientRect()
      const frameRect = phoneFrameEl.getBoundingClientRect()
      // Position above the element, relative to the phone frame's parent (canvas)
      setPos({
        top: rect.top - frameRect.top - 44,
        left: rect.left - frameRect.left + rect.width / 2,
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
          onClick={() => { setShowColorPicker(!showColorPicker); setShowSizePicker(false); setShowMovePicker(false) }}
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

      {/* Size */}
      <div style={{ position: 'relative' }}>
        <button
          style={btnStyle}
          onClick={() => { setShowSizePicker(!showSizePicker); setShowColorPicker(false); setShowMovePicker(false) }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          title="Change size"
        >
          <Type size={12} />
          Size
        </button>
        {showSizePicker && (
          <div style={{
            position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
            marginTop: 6, display: 'flex', gap: 4,
            background: '#1A1A1A', borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            padding: 6,
          }}>
            <button
              onClick={() => changeSize(-2)}
              style={{ ...btnStyle, padding: '6px 10px' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <Minus size={14} />
            </button>
            <button
              onClick={() => changeSize(2)}
              style={{ ...btnStyle, padding: '6px 10px' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <Plus size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Move */}
      <div style={{ position: 'relative' }}>
        <button
          style={btnStyle}
          onClick={() => { setShowMovePicker(!showMovePicker); setShowColorPicker(false); setShowSizePicker(false) }}
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
