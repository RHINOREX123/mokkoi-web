import { useState, useEffect, useRef, useMemo } from 'react'

export interface Command {
  id: string
  label: string
  shortcut?: string
  icon: React.ReactNode
  group: string
  action: () => void
}

interface CommandPaletteProps {
  commands: Command[]
  isOpen: boolean
  onClose: () => void
}

export function CommandPalette({ commands, isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Filter commands by query
  const filtered = useMemo(() => {
    if (!query.trim()) return commands
    const q = query.toLowerCase()
    return commands.filter(c =>
      c.label.toLowerCase().includes(q) || c.group.toLowerCase().includes(q)
    )
  }, [commands, query])

  // Group filtered commands
  const grouped = useMemo(() => {
    const groups: { name: string; items: Command[] }[] = []
    for (const cmd of filtered) {
      const existing = groups.find(g => g.name === cmd.group)
      if (existing) {
        existing.items.push(cmd)
      } else {
        groups.push({ name: cmd.group, items: [cmd] })
      }
    }
    return groups
  }, [filtered])

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Clamp selectedIndex when filtered list changes
  useEffect(() => {
    if (selectedIndex >= filtered.length) {
      setSelectedIndex(Math.max(0, filtered.length - 1))
    }
  }, [filtered.length, selectedIndex])

  // Scroll selected item into view
  useEffect(() => {
    const item = listRef.current?.querySelector(`[data-cmd-index="${selectedIndex}"]`) as HTMLElement
    item?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => (i + 1) % Math.max(1, filtered.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => (i - 1 + filtered.length) % Math.max(1, filtered.length))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action()
        onClose()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  if (!isOpen) return null

  let flatIndex = 0

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 400,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '15vh',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 480, maxHeight: 420,
          background: '#1A1A1A',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          animation: 'cmdPaletteIn 0.15s ease-out',
        }}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0) }}
            placeholder="Type a command..."
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: '#e2e8f0', fontSize: 14, caretColor: '#818cf8',
            }}
          />
          <span style={{
            fontSize: 11, color: '#555', padding: '2px 6px',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4,
          }}>
            ESC
          </span>
        </div>

        {/* Command list */}
        <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '4px 8px 8px' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: '#555', fontSize: 13 }}>
              No matching commands
            </div>
          ) : (
            grouped.map(group => (
              <div key={group.name}>
                <div style={{
                  padding: '8px 8px 4px',
                  fontSize: 11, fontWeight: 600, color: '#555',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  {group.name}
                </div>
                {group.items.map(cmd => {
                  const idx = flatIndex++
                  const isSelected = idx === selectedIndex
                  return (
                    <button
                      key={cmd.id}
                      data-cmd-index={idx}
                      onClick={() => { cmd.action(); onClose() }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        width: '100%', padding: '8px 10px', borderRadius: 8,
                        background: isSelected ? 'rgba(99,102,241,0.12)' : 'transparent',
                        border: 'none', cursor: 'pointer',
                        color: isSelected ? '#c7d2fe' : '#e2e8f0',
                        fontSize: 13, fontWeight: 500,
                        textAlign: 'left',
                        transition: 'background 0.1s',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', color: '#94a3b8', flexShrink: 0 }}>
                        {cmd.icon}
                      </span>
                      <span style={{ flex: 1 }}>{cmd.label}</span>
                      {cmd.shortcut && (
                        <span style={{
                          fontSize: 11, color: '#555',
                          padding: '1px 6px',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 4,
                          fontFamily: 'inherit',
                        }}>
                          {cmd.shortcut}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>
      </div>

      <style>{`
        @keyframes cmdPaletteIn {
          from { opacity: 0; transform: scale(0.97) translateY(-8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}
