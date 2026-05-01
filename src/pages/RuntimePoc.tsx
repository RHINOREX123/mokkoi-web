import { useCallback, useEffect, useRef, useState } from 'react'
import { expandComponents } from '../../lib/component-library'
import type { ComponentNode } from '../types/mokkoi'
import type { FlowConnection } from '../components/FlowConnectors'
import { findNavigationTarget } from '../utils/previewNavigation'
import {
  fetchProjectConnections,
  fetchProjectScreens,
  fetchScreenTree,
  fetchUserProjects,
  formatRelativeTime,
  type RuntimeProject,
  type RuntimeScreenSummary,
} from '../lib/runtimeFetch'

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
  return {
    project: sp.get('project') ?? '',
    screen: sp.get('screen') ?? '',
  }
}

function writeUrlParams(projectId: string, screenId: string) {
  const sp = new URLSearchParams(window.location.search)
  if (projectId) sp.set('project', projectId)
  else sp.delete('project')
  if (screenId) sp.set('screen', screenId)
  else sp.delete('screen')
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
        const params = readUrlParams()
        const initialProject = rows.find(p => p.id === params.project)?.id
          ?? rows[0]?.id
          ?? ''
        setProjectId(initialProject)
        if (params.screen) setScreenId(params.screen)
        if (!initialProject) setStatus('idle')
      })
      .catch(err => {
        if (cancelled) return
        console.error('[runtime-poc] fetchUserProjects failed', err)
        setError(err?.message ?? 'Failed to load projects')
        setStatus('error')
      })
    return () => { cancelled = true }
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

  // Handle nav clicks from inside the iframe (BottomNav tabs).
  useEffect(() => {
    function onNavClick(e: MessageEvent) {
      if (e.source !== iframeRef.current?.contentWindow) return
      if (e.data?.type !== 'mokkoi:nav-click') return
      const label = String(e.data.label ?? '')
      if (!label || !screenId) return

      // 1. Canonical: project's flow connections.
      const flowTarget = findNavigationTarget(connections, screenId, label)
      if (flowTarget) {
        console.log(`[runtime-nav] mapping path: flowConnection`)
        console.log(`[runtime-nav] resolved target: ${flowTarget}`)
        if (flowTarget !== screenId) setScreenId(flowTarget)
        return
      }

      // 2. Fallback: fuzzy match against screen names in this project.
      const fuzzy = fuzzyMatchScreen(label, screens)
      if (fuzzy) {
        console.log(`[runtime-nav] mapping path: fuzzyName`)
        console.log(`[runtime-nav] resolved target: ${fuzzy.id}`)
        if (fuzzy.id !== screenId) setScreenId(fuzzy.id)
        return
      }

      console.log(`[runtime-nav] mapping path: none`)
      console.log(`[runtime-nav] resolved target: null`)
      console.warn(`[runtime-nav] no target for tab '${label}' on screen ${screenId}`)
    }
    window.addEventListener('message', onNavClick)
    return () => window.removeEventListener('message', onNavClick)
  }, [connections, screens, screenId])

  // Sync URL params whenever selection changes.
  useEffect(() => {
    if (projectId || screenId) writeUrlParams(projectId, screenId)
  }, [projectId, screenId])

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
    minWidth: 220,
  }

  return (
    <div style={{ minHeight: '100vh', background: '#06080D', color: '#E6EDF3', padding: 24, fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: 18, marginBottom: 8 }}>Mokkoi Runtime POC</h1>
      <p style={{ fontSize: 13, color: '#7D8590', marginBottom: 16 }}>
        Iframe: {iframeReady ? 'ready' : 'waiting'} · {statusLabel[status]}
      </p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
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
      </div>

      {status === 'error' && (
        <div style={{
          padding: 12, marginBottom: 16, borderRadius: 8,
          border: '1px solid #4C1D24', background: '#1C0F12', color: '#FCA5A5', fontSize: 13,
        }}>
          Couldn't load — {error}. Check the project/screen IDs (URL params) or RLS access.
        </div>
      )}

      <div style={{
        width: 390, height: 700, border: '1px solid #1C2333',
        borderRadius: 12, overflow: 'hidden', background: '#0A0A1A',
      }}>
        <iframe
          ref={iframeRef}
          src="/runtime/index.html"
          title="Mokkoi Runtime POC"
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        />
      </div>
    </div>
  )
}
