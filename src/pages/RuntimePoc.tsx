import { useCallback, useEffect, useRef, useState } from 'react'
import { expandComponents } from '../../lib/component-library'
import type { ComponentNode } from '../types/mokkoi'
import type { FlowConnection } from '../components/FlowConnectors'
import { findNavigationTarget } from '../utils/previewNavigation'
import { RuntimePhoneFrame } from '../components/RuntimePhoneFrame'
import { DEVICE_PRESETS, DEFAULT_DEVICE, getDevicePreset, resolveDeviceId } from '../constants/devices'
import { MIN_ZOOM, MAX_ZOOM } from '../utils/computeFitScale'
import {
  fetchProjectConnections,
  fetchProjectScreens,
  fetchScreenTree,
  fetchUserProjects,
  formatRelativeTime,
  type RuntimeProject,
  type RuntimeScreenSummary,
} from '../lib/runtimeFetch'

const ZOOM_OPTIONS = [0.5, 0.75, 1.0] as const

/** Pick a sensible default zoom so phones fit on a typical laptop without manual tweaking.
 *  Small phones render at 1.0 (else they'd look tiny); standard phones at 0.75; tablets at 0.5. */
function getDefaultZoom(deviceHeight: number): number {
  if (deviceHeight <= 700) return 1.0
  if (deviceHeight <= 900) return 0.75
  return 0.5
}

function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))
}

/** Fuzzy fallback: match a tab label against a screen name when no FlowConnection exists.
 *  Strips a trailing "Screen" word + normalizes whitespace/case. Tries exact match first,
 *  then substring match in either direction (covers "Profile" tab → "ProfileScreen", and
 *  "Home" tab → "Home"). */
function fuzzyMatchScreen(label: string, screens: RuntimeScreenSummary[]): RuntimeScreenSummary | null {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\s*screen$/, '').trim()
  const target = norm(label)
  if (!target) return null
  for (const s of screens) if (norm(s.name) === target) return s
  for (const s of screens) {
    const n = norm(s.name)
    if (n && (n.includes(target) || target.includes(n))) return s
  }
  return null
}

function readUrlParams() {
  const sp = new URLSearchParams(window.location.search)
  const zoomRaw = parseFloat(sp.get('zoom') ?? '')
  return {
    project: sp.get('project') ?? '',
    screen: sp.get('screen') ?? '',
    device: sp.get('device') ?? '',
    zoom: Number.isFinite(zoomRaw) ? clampZoom(zoomRaw / 100) : null,
  }
}

function writeUrlParams(projectId: string, screenId: string, deviceId: string, zoom: number) {
  const sp = new URLSearchParams(window.location.search)
  if (projectId) sp.set('project', projectId); else sp.delete('project')
  if (screenId) sp.set('screen', screenId); else sp.delete('screen')
  if (deviceId) sp.set('device', deviceId); else sp.delete('device')
  sp.set('zoom', String(Math.round(zoom * 100)))
  const next = `${window.location.pathname}?${sp.toString()}`
  window.history.replaceState(null, '', next)
}

export default function RuntimePoc() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [iframeReady, setIframeReady] = useState(false)

  const [projects, setProjects] = useState<RuntimeProject[]>([])
  const [screens, setScreens] = useState<RuntimeScreenSummary[]>([])
  const [connections, setConnections] = useState<FlowConnection[]>([])
  const [projectId, setProjectId] = useState<string>('')
  const [screenId, setScreenId] = useState<string>('')

  const initialUrl = useRef(readUrlParams()).current
  const [deviceId, setDeviceId] = useState<string>(() => {
    const fromUrl = initialUrl.device
    if (fromUrl && DEVICE_PRESETS.some(d => d.id === resolveDeviceId(fromUrl))) {
      return resolveDeviceId(fromUrl)
    }
    return DEFAULT_DEVICE
  })
  const [zoom, setZoom] = useState<number>(() => {
    if (initialUrl.zoom != null) return initialUrl.zoom
    const dev = getDevicePreset(deviceId)
    return getDefaultZoom(dev.height)
  })
  // Tracks whether the user has manually picked a zoom; if so, we stop auto-resetting it
  // when the device changes. Initial URL with explicit zoom counts as manual.
  const userChoseZoomRef = useRef<boolean>(initialUrl.zoom != null)

  const [status, setStatus] = useState<'idle' | 'loading-projects' | 'loading-screens' | 'loading-tree' | 'ready' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [activeTreeName, setActiveTreeName] = useState<string>('')

  // Iframe handshake.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== iframeRef.current?.contentWindow) return
      if (e.data?.type === 'mokkoi:runtime-ready') {
        console.log('[parent] runtime ready')
        setIframeReady(true)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // Load projects on mount; resolve initial project/screen from URL params.
  useEffect(() => {
    let cancelled = false
    setStatus('loading-projects')
    fetchUserProjects(20)
      .then(rows => {
        if (cancelled) return
        setProjects(rows)
        const initialProject = rows.find(p => p.id === initialUrl.project)?.id
          ?? rows[0]?.id
          ?? ''
        setProjectId(initialProject)
        if (initialUrl.screen) setScreenId(initialUrl.screen)
        if (!initialProject) setStatus('idle')
      })
      .catch(err => {
        if (cancelled) return
        console.error('[runtime-poc] fetchUserProjects failed', err)
        setError(err?.message ?? 'Failed to load projects')
        setStatus('error')
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load screens whenever projectId changes.
  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    setStatus('loading-screens')
    setScreens([])
    setConnections([])
    Promise.all([
      fetchProjectScreens(projectId),
      fetchProjectConnections(projectId).catch(err => {
        // Connections is non-fatal — fuzzy fallback still works without it.
        console.warn('[runtime-poc] fetchProjectConnections failed (non-fatal)', err)
        return [] as FlowConnection[]
      }),
    ])
      .then(([rows, conns]) => {
        if (cancelled) return
        setScreens(rows)
        setConnections(conns)
        const stillValid = rows.find(s => s.id === screenId)
        const next = stillValid?.id ?? rows[0]?.id ?? ''
        setScreenId(next)
        if (!next) setStatus('idle')
      })
      .catch(err => {
        if (cancelled) return
        console.error('[runtime-poc] fetchProjectScreens failed', err)
        setError(err?.message ?? 'Failed to load screens')
        setStatus('error')
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  // Handle clicks from inside the iframe. Generic mokkoi:click protocol with an
  // elementKind discriminator — Week 3 Day 1 generalisation of the BottomNav-only
  // mokkoi:nav-click. Routing for every kind reuses the same hierarchy:
  //   1. FlowConnection (canonical, planner-provided trigger)
  //   2. Fuzzy screen-name match
  //   3. Nothing → echo mokkoi:click-unresolved back so the iframe can toast.
  useEffect(() => {
    function onClick(e: MessageEvent) {
      if (e.source !== iframeRef.current?.contentWindow) return
      if (e.data?.type !== 'mokkoi:click') return
      const kind = String(e.data.elementKind ?? '')
      const label = String(e.data.label ?? '')
      if (!screenId) return

      // Structured one-line resolution log per click. Same prefix + field shape
      // for success and failure — `tried=` shows the resolution path attempted,
      // `matched=` is `<source>:<id>` on success or `none` on failure. Makes
      // patterns like "flowConnection always misses because no triggers exist"
      // visible at log-scrub time.
      const tried: string[] = []

      if (!label) {
        console.warn(`[mokkoi-click] parent → kind=${kind} label='' tried= matched=none reason=empty-label`)
        e.source?.postMessage({ type: 'mokkoi:click-unresolved', label: '', kind }, '*')
        return
      }

      tried.push('flowConnection')
      const flowTarget = findNavigationTarget(connections, screenId, label)
      if (flowTarget) {
        console.log(`[mokkoi-click] parent → kind=${kind} label='${label}' tried=${tried.join(',')} matched=flowConnection:${flowTarget}`)
        if (flowTarget !== screenId) setScreenId(flowTarget)
        return
      }

      tried.push('fuzzyName')
      const fuzzy = fuzzyMatchScreen(label, screens)
      if (fuzzy) {
        console.log(`[mokkoi-click] parent → kind=${kind} label='${label}' tried=${tried.join(',')} matched=fuzzyName:${fuzzy.id}`)
        if (fuzzy.id !== screenId) setScreenId(fuzzy.id)
        return
      }

      console.warn(`[mokkoi-click] parent → kind=${kind} label='${label}' tried=${tried.join(',')} matched=none`)
      e.source?.postMessage({ type: 'mokkoi:click-unresolved', label, kind }, '*')
    }
    window.addEventListener('message', onClick)
    return () => window.removeEventListener('message', onClick)
  }, [connections, screens, screenId])

  // Sync URL params whenever any test-rig dimension changes.
  useEffect(() => {
    if (projectId || screenId) writeUrlParams(projectId, screenId, deviceId, zoom)
  }, [projectId, screenId, deviceId, zoom])

  const postTree = useCallback((tree: ComponentNode) => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'mokkoi:render-tree', tree },
      '*',
    )
  }, [])

  // Fetch + post tree whenever project, screen, and iframe are all ready.
  useEffect(() => {
    if (!projectId || !screenId || !iframeReady) return
    let cancelled = false
    setStatus('loading-tree')
    setError(null)
    fetchScreenTree(projectId, screenId)
      .then(screen => {
        if (cancelled) return
        const expanded = expandComponents(screen.tree) as ComponentNode
        postTree(expanded)
        setActiveTreeName(screen.name || screen.id)
        setStatus('ready')
      })
      .catch(err => {
        if (cancelled) return
        console.error('[runtime-poc] fetchScreenTree failed', err)
        setError(err?.message ?? 'Failed to load screen tree')
        setStatus('error')
      })
    return () => { cancelled = true }
  }, [projectId, screenId, iframeReady, postTree])

  const onDeviceChange = (next: string) => {
    setDeviceId(next)
    if (!userChoseZoomRef.current) {
      const dev = getDevicePreset(next)
      setZoom(getDefaultZoom(dev.height))
    }
  }

  const onZoomChange = (next: number) => {
    userChoseZoomRef.current = true
    setZoom(clampZoom(next))
  }

  const statusLabel: Record<typeof status, string> = {
    'idle': 'idle',
    'loading-projects': 'Loading projects…',
    'loading-screens': 'Loading screens…',
    'loading-tree': 'Fetching screen…',
    'ready': `Rendering: ${activeTreeName}`,
    'error': `Error: ${error ?? 'unknown'}`,
  }

  const selectStyle: React.CSSProperties = {
    padding: '6px 10px',
    borderRadius: 6,
    border: '1px solid #1C2333',
    background: '#0E1320',
    color: '#E6EDF3',
    fontSize: 13,
    minWidth: 180,
  }

  const device = getDevicePreset(deviceId)

  return (
    <div style={{ minHeight: '100vh', background: '#06080D', color: '#E6EDF3', padding: 24, fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: 18, marginBottom: 8 }}>Mokkoi Runtime POC</h1>
      <p style={{ fontSize: 13, color: '#7D8590', marginBottom: 16 }}>
        Iframe: {iframeReady ? 'ready' : 'waiting'} · {statusLabel[status]}
      </p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: '#7D8590' }}>
          Project
          <select
            value={projectId}
            onChange={e => { setProjectId(e.target.value); setScreenId('') }}
            style={selectStyle}
            disabled={projects.length === 0}
          >
            {projects.length === 0 && <option value="">(no projects)</option>}
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.name || '(untitled)'} · {formatRelativeTime(p.updated_at)}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: '#7D8590' }}>
          Screen
          <select
            value={screenId}
            onChange={e => setScreenId(e.target.value)}
            style={selectStyle}
            disabled={screens.length === 0}
          >
            {screens.length === 0 && <option value="">(no screens)</option>}
            {screens.map(s => (
              <option key={s.id} value={s.id}>{s.name || s.id.slice(0, 8)}</option>
            ))}
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: '#7D8590' }}>
          Device
          <select
            value={deviceId}
            onChange={e => onDeviceChange(e.target.value)}
            style={selectStyle}
          >
            {DEVICE_PRESETS.map(d => (
              <option key={d.id} value={d.id}>
                {d.icon} {d.name} · {d.width}×{d.height}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: '#7D8590' }}>
          Zoom
          <select
            value={zoom}
            onChange={e => onZoomChange(parseFloat(e.target.value))}
            style={{ ...selectStyle, minWidth: 100 }}
          >
            {ZOOM_OPTIONS.map(z => (
              <option key={z} value={z}>{Math.round(z * 100)}%</option>
            ))}
          </select>
        </label>
      </div>

      {status === 'error' && (
        <div style={{
          padding: 12, marginBottom: 16, borderRadius: 8,
          border: '1px solid #4C1D24', background: '#1C0F12', color: '#FCA5A5', fontSize: 13,
        }}>
          Couldn't load — {error}. Check the project/screen IDs (URL params) or RLS access.
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <RuntimePhoneFrame deviceId={deviceId} zoom={zoom}>
          <iframe
            ref={iframeRef}
            src="/runtime/index.html"
            title="Mokkoi Runtime POC"
            style={{
              width: device.width,
              height: device.height,
              border: 'none',
              display: 'block',
              background: '#0F172A',
            }}
          />
        </RuntimePhoneFrame>
      </div>
    </div>
  )
}
