import { useState, useRef, useEffect } from 'react'
import {
  Sparkles, RefreshCw, LayoutGrid, Pencil, MessageSquare, Palette, Moon, Sun,
  Play, ExternalLink, QrCode, Smartphone, MoreHorizontal, Code,
  Download, Copy, Type, Trash2, Star, ThumbsUp, ThumbsDown, ChevronDown, PenTool,
} from 'lucide-react'
import type { ComponentNode } from '../types/mokkoi'
import { DEVICE_PRESETS } from '../constants/devices'
import type { DeviceId } from '../constants/devices'

interface ScreenContextToolbarProps {
  visible: boolean
  screenName: string
  screenTree?: ComponentNode
  screenId: string
  onRegenerate: () => void
  onOpenVariations: () => void
  onEditViaChat: () => void
  onChangeColorScheme: () => void
  onMakeDarker: () => void
  onMakeLighter: () => void
  onPreviewNewTab: () => void
  onShowQrCode: () => void
  onExportCode: () => void
  onDownloadImage: () => void
  onDuplicate: () => void
  onRename: () => void
  onDelete: () => void
  onToast: (msg: string) => void
  onDirectEdit?: () => void
  deviceId: DeviceId
  onDeviceChange: (id: DeviceId) => void
}

const DROPDOWN_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 8px)',
  left: '50%',
  transform: 'translateX(-50%)',
  background: '#1A1A1A',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
  minWidth: 220,
  padding: 4,
  zIndex: 100,
}

const MENU_ITEM_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  width: '100%',
  padding: '8px 12px',
  borderRadius: 8,
  background: 'transparent',
  border: 'none',
  color: '#e2e8f0',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'background 0.15s',
  textAlign: 'left' as const,
}

export function ScreenContextToolbar(props: ScreenContextToolbarProps) {
  const {
    visible, onRegenerate, onOpenVariations, onEditViaChat,
    onChangeColorScheme, onMakeDarker, onMakeLighter,
    onPreviewNewTab, onShowQrCode,
    onExportCode, onDownloadImage, onDuplicate, onRename, onDelete,
    onToast, onDirectEdit, deviceId, onDeviceChange,
  } = props

  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)

  // Close dropdown on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setOpenDropdown(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Close dropdown when toolbar hides
  useEffect(() => {
    if (!visible) setOpenDropdown(null)
  }, [visible])

  const toggleDropdown = (name: string) => {
    setOpenDropdown(prev => prev === name ? null : name)
  }

  const menuItem = (
    icon: React.ReactNode,
    label: string,
    onClick: () => void,
    opts?: { shortcut?: string; danger?: boolean }
  ) => (
    <button
      onClick={() => { onClick(); setOpenDropdown(null) }}
      style={{
        ...MENU_ITEM_STYLE,
        color: opts?.danger ? '#f87171' : '#e2e8f0',
        justifyContent: 'space-between',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = opts?.danger
          ? 'rgba(248,113,113,0.1)' : 'rgba(255,255,255,0.08)'
      }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {icon}
        {label}
      </span>
      {opts?.shortcut && (
        <span style={{ fontSize: 11, color: '#555', fontWeight: 400 }}>{opts.shortcut}</span>
      )}
    </button>
  )

  const divider = <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 8px' }} />

  const toolbarBtnStyle = (isOpen: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    borderRadius: 999,
    background: isOpen ? 'rgba(255,255,255,0.12)' : 'transparent',
    border: 'none',
    color: isOpen ? '#fff' : '#ccc',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
    position: 'relative' as const,
    whiteSpace: 'nowrap' as const,
  })

  const feedbackBtnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 30,
    borderRadius: '50%',
    background: 'transparent',
    border: 'none',
    color: '#888',
    cursor: 'pointer',
    transition: 'all 0.15s',
  }

  return (
    <div
      ref={toolbarRef}
      style={{
        position: 'absolute',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        display: visible ? 'flex' : 'none',
        alignItems: 'center',
        gap: 2,
        padding: '6px 12px',
        background: '#1A1A1A',
        borderRadius: 999,
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        zIndex: 50,
        animation: visible ? 'fadeInToolbar 0.2s ease-out' : undefined,
      }}
    >
      {/* Generate */}
      <div style={{ position: 'relative' }}>
        <button
          style={toolbarBtnStyle(openDropdown === 'generate')}
          onClick={() => toggleDropdown('generate')}
          onMouseEnter={e => { if (openDropdown !== 'generate') e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
          onMouseLeave={e => { if (openDropdown !== 'generate') e.currentTarget.style.background = 'transparent' }}
        >
          <Sparkles size={14} />
          Generate
          <ChevronDown size={12} style={{ opacity: 0.5 }} />
        </button>
        {openDropdown === 'generate' && (
          <div style={DROPDOWN_STYLE}>
            {menuItem(<RefreshCw size={16} color="#94a3b8" />, 'Regenerate', onRegenerate)}
            {menuItem(<LayoutGrid size={16} color="#94a3b8" />, 'Variations', onOpenVariations)}
            {menuItem(<Smartphone size={16} color="#94a3b8" />, 'Mobile App Version', () => onToast('Coming soon'))}
          </div>
        )}
      </div>

      {/* Modify */}
      <div style={{ position: 'relative' }}>
        <button
          style={toolbarBtnStyle(openDropdown === 'modify')}
          onClick={() => toggleDropdown('modify')}
          onMouseEnter={e => { if (openDropdown !== 'modify') e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
          onMouseLeave={e => { if (openDropdown !== 'modify') e.currentTarget.style.background = 'transparent' }}
        >
          <Pencil size={14} />
          Modify
          <ChevronDown size={12} style={{ opacity: 0.5 }} />
        </button>
        {openDropdown === 'modify' && (
          <div style={DROPDOWN_STYLE}>
            {menuItem(<PenTool size={16} color="#94a3b8" />, 'Direct Edit', onDirectEdit ?? (() => onToast('Coming soon')))}
            {menuItem(<MessageSquare size={16} color="#94a3b8" />, 'Edit via chat', onEditViaChat)}
            {menuItem(<Palette size={16} color="#94a3b8" />, 'Change color scheme', onChangeColorScheme)}
            {divider}
            {menuItem(<Moon size={16} color="#94a3b8" />, 'Make it darker', onMakeDarker)}
            {menuItem(<Sun size={16} color="#94a3b8" />, 'Make it lighter', onMakeLighter)}
          </div>
        )}
      </div>

      {/* Preview */}
      <div style={{ position: 'relative' }}>
        <button
          style={toolbarBtnStyle(openDropdown === 'preview')}
          onClick={() => toggleDropdown('preview')}
          onMouseEnter={e => { if (openDropdown !== 'preview') e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
          onMouseLeave={e => { if (openDropdown !== 'preview') e.currentTarget.style.background = 'transparent' }}
        >
          <Play size={14} />
          Preview
          <ChevronDown size={12} style={{ opacity: 0.5 }} />
        </button>
        {openDropdown === 'preview' && (
          <div style={DROPDOWN_STYLE}>
            {menuItem(<ExternalLink size={16} color="#94a3b8" />, 'Preview in new tab', onPreviewNewTab)}
            {menuItem(<QrCode size={16} color="#94a3b8" />, 'Show QR Code', onShowQrCode)}
            {divider}
            <div style={{ padding: '6px 12px 4px', fontSize: 11, fontWeight: 600, color: '#555', letterSpacing: '0.3px' }}>
              Screen Device
            </div>
            {DEVICE_PRESETS.map(preset => {
              const isSelected = deviceId === preset.id
              return (
                <button
                  key={preset.id}
                  onClick={() => { onDeviceChange(preset.id as DeviceId); setOpenDropdown(null) }}
                  style={{
                    ...MENU_ITEM_STYLE,
                    justifyContent: 'space-between',
                    color: isSelected ? '#818CF8' : '#e2e8f0',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 14, width: 20, textAlign: 'center' }}>{preset.icon}</span>
                    {preset.name}
                    <span style={{ fontSize: 11, color: '#555', fontWeight: 400 }}>{preset.width}×{preset.height}</span>
                  </span>
                  {isSelected && <span style={{ color: '#818CF8', fontSize: 14 }}>✓</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* More */}
      <div style={{ position: 'relative' }}>
        <button
          style={toolbarBtnStyle(openDropdown === 'more')}
          onClick={() => toggleDropdown('more')}
          onMouseEnter={e => { if (openDropdown !== 'more') e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
          onMouseLeave={e => { if (openDropdown !== 'more') e.currentTarget.style.background = 'transparent' }}
        >
          <MoreHorizontal size={14} />
          More
          <ChevronDown size={12} style={{ opacity: 0.5 }} />
        </button>
        {openDropdown === 'more' && (
          <div style={DROPDOWN_STYLE}>
            {menuItem(<Code size={16} color="#94a3b8" />, 'Export code', onExportCode, { shortcut: 'Ctrl+E' })}
            {menuItem(<Download size={16} color="#94a3b8" />, 'Download as image', onDownloadImage)}
            {menuItem(<Copy size={16} color="#94a3b8" />, 'Duplicate screen', onDuplicate)}
            {menuItem(<Type size={16} color="#94a3b8" />, 'Rename screen', onRename)}
            {divider}
            {menuItem(<Trash2 size={16} color="#f87171" />, 'Delete screen', onDelete, { danger: true })}
          </div>
        )}
      </div>

      {/* Separator */}
      <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', margin: '0 6px' }} />

      {/* Feedback buttons */}
      <button
        style={feedbackBtnStyle}
        onClick={() => onToast('Added to favorites')}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fbbf24' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#888' }}
        title="Favorite"
      >
        <Star size={14} />
      </button>
      <button
        style={feedbackBtnStyle}
        onClick={() => onToast('Feedback saved')}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#34d399' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#888' }}
        title="Thumbs up"
      >
        <ThumbsUp size={14} />
      </button>
      <button
        style={feedbackBtnStyle}
        onClick={() => onToast('Feedback saved')}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#f87171' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#888' }}
        title="Thumbs down"
      >
        <ThumbsDown size={14} />
      </button>

      {/* Fade-in animation */}
      <style>{`
        @keyframes fadeInToolbar {
          from { opacity: 0; transform: translateX(-50%) translateY(-6px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  )
}
