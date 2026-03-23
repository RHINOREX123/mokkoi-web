import { MousePointer2, Hand, ZoomOut, ZoomIn, PenTool, Upload, ImagePlus } from 'lucide-react'

interface CanvasToolbarProps {
  activeTool: 'select' | 'pan'
  zoomLevel: number
  directEditMode: boolean
  setActiveTool: (tool: 'select' | 'pan') => void
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
  enterDirectEdit: () => void
  exitDirectEdit: (save?: boolean) => void
  onScreenshotModal: () => void
  onUploadRef: () => void
}

function ToolbarButton({ icon, tooltip, onClick, isActive }: {
  icon: React.ReactNode
  tooltip: string
  onClick?: () => void
  isActive?: boolean
}) {
  return (
    <button
      title={tooltip}
      onClick={onClick}
      style={{
        width: 32, height: 32, borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
        color: isActive ? '#fff' : '#999',
        border: 'none', cursor: 'pointer',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
    >
      {icon}
    </button>
  )
}

export function CanvasToolbar({
  activeTool, zoomLevel, directEditMode,
  setActiveTool, zoomIn, zoomOut, resetZoom,
  enterDirectEdit, exitDirectEdit,
  onScreenshotModal, onUploadRef,
}: CanvasToolbarProps) {
  return (
    <div style={{
      position: 'absolute',
      bottom: 16,
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      padding: '8px 16px',
      background: '#1A1A1A',
      borderRadius: 14,
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      zIndex: 20,
      transformOrigin: 'unset',
      zoom: 1,
    }}>
      <ToolbarButton icon={<MousePointer2 size={18} />} tooltip="Select" onClick={() => setActiveTool('select')} isActive={activeTool === 'select'} />
      <ToolbarButton icon={<Hand size={18} />} tooltip="Pan" onClick={() => setActiveTool('pan')} isActive={activeTool === 'pan'} />

      <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

      <ToolbarButton icon={<ZoomOut size={18} />} tooltip="Zoom out" onClick={zoomOut} />
      <button
        title="Reset zoom"
        onClick={resetZoom}
        style={{
          fontSize: 12, fontWeight: 600, color: '#999', minWidth: 36, textAlign: 'center',
          userSelect: 'none', background: 'transparent', border: 'none', cursor: 'pointer',
          padding: '4px 2px', borderRadius: 6, transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
        onMouseLeave={e => { e.currentTarget.style.color = '#999'; e.currentTarget.style.background = 'transparent' }}
      >
        {Math.round(zoomLevel)}%
      </button>
      <ToolbarButton icon={<ZoomIn size={18} />} tooltip="Zoom in" onClick={zoomIn} />

      <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

      <button
        title="Direct edit"
        onClick={() => { if (directEditMode) exitDirectEdit(false); else enterDirectEdit() }}
        style={{
          width: 32, height: 32, borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: directEditMode ? 'rgba(59,130,246,0.2)' : 'transparent',
          color: directEditMode ? '#3B82F6' : '#999',
          border: directEditMode ? '1px solid rgba(59,130,246,0.4)' : 'none',
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => { if (!directEditMode) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
        onMouseLeave={e => { if (!directEditMode) e.currentTarget.style.background = directEditMode ? 'rgba(59,130,246,0.2)' : 'transparent' }}
      >
        <PenTool size={18} />
      </button>
      <ToolbarButton icon={<ImagePlus size={18} />} tooltip="Screenshot to Screen" onClick={onScreenshotModal} />
      <ToolbarButton icon={<Upload size={18} />} tooltip="Upload reference image" onClick={onUploadRef} />
    </div>
  )
}
