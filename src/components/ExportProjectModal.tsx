import { useState, useMemo } from 'react'
import { X, Check, Package, Smartphone } from 'lucide-react'

export interface ExportableScreen {
  id: string
  name: string
  hasTree: boolean
}

interface ExportProjectModalProps {
  open: boolean
  onClose: () => void
  screens: ExportableScreen[]
  projectName: string
  onExport: (selectedIds: string[]) => void
}

export function ExportProjectModal({ open, onClose, screens, projectName, onExport }: ExportProjectModalProps) {
  const validScreens = useMemo(() => screens.filter(s => s.hasTree), [screens])
  const [selected, setSelected] = useState<Set<string>>(() => new Set(validScreens.map(s => s.id)))

  // Reset selection when modal opens with new screens
  const screenKey = validScreens.map(s => s.id).join(',')
  const [lastKey, setLastKey] = useState(screenKey)
  if (screenKey !== lastKey) {
    setSelected(new Set(validScreens.map(s => s.id)))
    setLastKey(screenKey)
  }

  if (!open) return null

  const allSelected = selected.size === validScreens.length
  const noneSelected = selected.size === 0

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(validScreens.map(s => s.id)))
  }

  const handleExport = () => {
    if (noneSelected) return
    onExport(Array.from(selected))
    onClose()
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16, boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          width: 440, maxHeight: '80vh', display: 'flex', flexDirection: 'column',
          animation: 'fadeInScale 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Smartphone size={18} color="#34D399" />
            <span style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9' }}>Export as Expo App</span>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#64748b', cursor: 'pointer',
            padding: 4, borderRadius: 6, display: 'flex',
          }}
            onMouseEnter={e => { e.currentTarget.style.color = '#e2e8f0' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#64748b' }}
          ><X size={18} /></button>
        </div>

        {/* Project info */}
        <div style={{ padding: '12px 20px 8px', fontSize: 12, color: '#64748b' }}>
          <span style={{ color: '#94a3b8', fontWeight: 500 }}>{projectName}</span>
          {' '}&middot; {validScreens.length} screen{validScreens.length !== 1 ? 's' : ''} available
        </div>

        {/* Select all / none */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '4px 20px 8px',
        }}>
          <button onClick={toggleAll} style={{
            background: 'none', border: 'none', fontSize: 12, fontWeight: 500,
            color: '#818cf8', cursor: 'pointer', padding: '4px 0',
          }}>
            {allSelected ? 'Deselect all' : 'Select all'}
          </button>
          <span style={{ fontSize: 12, color: '#64748b' }}>
            {selected.size} selected
          </span>
        </div>

        {/* Screen list */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '0 12px 12px',
          maxHeight: 340,
        }}>
          {validScreens.map(screen => {
            const isSelected = selected.has(screen.id)
            return (
              <button
                key={screen.id}
                onClick={() => toggle(screen.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '10px 8px', borderRadius: 8,
                  background: isSelected ? 'rgba(99,102,241,0.06)' : 'transparent',
                  border: 'none', cursor: 'pointer', transition: 'background 0.15s',
                  textAlign: 'left',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = isSelected ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.04)' }}
                onMouseLeave={e => { e.currentTarget.style.background = isSelected ? 'rgba(99,102,241,0.06)' : 'transparent' }}
              >
                {/* Checkbox */}
                <div style={{
                  width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isSelected ? '#6366f1' : 'transparent',
                  border: isSelected ? 'none' : '1.5px solid rgba(255,255,255,0.2)',
                  transition: 'all 0.15s',
                }}>
                  {isSelected && <Check size={13} color="#fff" strokeWidth={3} />}
                </div>

                {/* Screen name */}
                <span style={{
                  fontSize: 13, fontWeight: 500,
                  color: isSelected ? '#e2e8f0' : '#94a3b8',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{screen.name}</span>
              </button>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.4 }}>
            <Package size={12} style={{ display: 'inline', verticalAlign: -2, marginRight: 4 }} />
            Expo SDK 55 + React Navigation
          </div>
          <button
            onClick={handleExport}
            disabled={noneSelected}
            style={{
              padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: noneSelected ? 'rgba(255,255,255,0.04)' : 'linear-gradient(135deg, #059669, #34D399)',
              color: noneSelected ? '#555' : '#fff',
              border: 'none', cursor: noneSelected ? 'default' : 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Export {selected.size > 1 ? `${selected.size} screens` : selected.size === 1 ? '1 screen' : ''}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
