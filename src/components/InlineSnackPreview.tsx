import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Snack } from 'snack-sdk'
import { buildSnackPayload } from '../utils/snackUrl'
import { computeFitScale } from '../utils/computeFitScale'
import { getDevicePreset, DEFAULT_DEVICE } from '../constants/devices'
import type { GeneratedScreen } from '../hooks/useScreenManagement'
import type { FlowConnection } from './FlowConnectors'
import type { DeviceId } from '../constants/devices'

interface InlineSnackPreviewProps {
  screens: GeneratedScreen[]
  connections: FlowConnection[]
  projectName: string
  /** Same device id as the static PreviewPhoneFrame so the iframe overlays exactly. */
  deviceId?: DeviceId
  /** Manual zoom override (null = auto-fit). Mirrors PreviewPhoneFrame. */
  manualZoom?: number | null
  /** Disable Snack while generation is in progress — the partial code isn't
   *  worth booting Snack for, and it would just churn re-deploys as the tree
   *  streams in. Static fallback handles the streaming UX. */
  disabled?: boolean
}

// Stub App used to construct the Snack instance during the first render
// (before any user payload is available). Replaced via `snack.updateFiles(...)`
// once the real payload arrives. Kept tiny — Snack just needs *some* valid
// content to spin up the runtime.
const STUB_APP = `import React from 'react'
import { View } from 'react-native'
export default function App() { return <View /> }
`

/** Inline Bolt-style preview: overlays the Expo Snack web-player iframe on
 *  top of `<PreviewPhoneFrame>` so the user sees the actual running RN
 *  app rather than a static tree render.
 *
 *  Lifecycle (matches the official snack-sdk example):
 *
 *  1. On first render, lazy-init a single `Snack` instance via
 *     `useState(() => new Snack({...}))`. Created with stub content and
 *     `webPreviewRef` pointing at a stable ref-of-window object.
 *  2. The Snack instance immediately starts its `webplayer` transport,
 *     which adds a `'message'` listener on the parent window — long
 *     before the iframe runtime can broadcast its CONNECT message.
 *     This is the mount-order fix: previously the SDK was created
 *     inside a useEffect (running AFTER iframe commit + ref callback),
 *     so any CONNECT broadcast that fired between the iframe loading
 *     and the SDK's listener attaching would be missed silently.
 *  3. When the real payload arrives or changes (fingerprint), call
 *     `snack.updateFiles`, `snack.setName`, `snack.updateDependencies`
 *     to drive the Snack content reactively. No new Snack instance
 *     created on prop changes.
 *  4. iframe is always rendered; its `src` is `undefined` until the
 *     SDK produces a `webPreviewURL` (also matches the example).
 *  5. On 15s boot timeout, set `snackErrored` so the static fallback
 *     becomes visible. */
export function InlineSnackPreview({
  screens,
  connections,
  projectName,
  deviceId,
  manualZoom = null,
  disabled = false,
}: InlineSnackPreviewProps) {
  const [snackReady, setSnackReady] = useState(false)
  const [snackErrored, setSnackErrored] = useState(false)
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })
  const [webPreviewURL, setWebPreviewURL] = useState<string | null>(null)

  const iframeRef = useRef<HTMLIFrameElement>(null)
  // The SDK reads `webPreviewRef.current` (a Window) on every postMessage
  // dispatch. SDK's SnackWindowRef type is `{ current: Window | null }`. We
  // keep one stable instance for the SDK and mutate `.current` from the
  // iframe ref callback.
  const webPreviewRefObjRef = useRef<{ current: Window | null }>({ current: null })
  const observerRef = useRef<ResizeObserver | null>(null)

  const device = getDevicePreset(deviceId || DEFAULT_DEVICE)
  const isAndroid = device.category === 'Android'

  // Stable content fingerprint — see the explanation lower in this file.
  // Memoized so the update effect below doesn't refire on every parent render.
  const fingerprint = useMemo(() => {
    if (screens.length === 0) return ''
    const screensKey = screens
      .map(s => `${s.id}:${s.name}:${s.tree ? JSON.stringify(s.tree).length : 0}`)
      .join('|')
    const connKey = connections.map(c => `${c.fromScreenId}>${c.toScreenId}`).join(',')
    return `${projectName}::${screensKey}::${connKey}`
  }, [projectName, screens, connections])

  const payload = useMemo(() => {
    if (!fingerprint) return null
    try {
      return buildSnackPayload({ projectName, screens, connections })
    } catch (err) {
      console.error('[InlineSnackPreview] failed to build snack payload', err)
      return null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint])

  // ─── Lazy-init Snack ONCE on first render. ────────────────────────────────
  // This is the critical lifecycle fix: creating Snack inside `useState`'s
  // initializer runs DURING render, before any effects fire. The SDK's
  // webplayer transport's `start()` method (which adds the 'message'
  // listener on the parent window) executes synchronously inside the Snack
  // constructor. So by the time the iframe is committed to the DOM and the
  // runtime starts loading, our message listener is already attached. The
  // iframe runtime's CONNECT broadcast can't be missed.
  //
  // (Previous approach: `new Snack(...)` inside a useEffect — that runs AFTER
  // commit, after iframe started loading, so a fast runtime CONNECT could
  // beat the listener and we'd never register as a connected client.)
  const [snack] = useState<Snack>(() => new Snack({
    name: 'Mokkoi App',
    files: { 'App.js': { type: 'CODE', contents: STUB_APP } },
    dependencies: { 'expo-status-bar': { version: '~1.11.1' } },
    webPreviewRef: webPreviewRefObjRef.current,
  }))

  // ─── Subscribe to state once on mount. ────────────────────────────────────
  useEffect(() => {
    // Read initial state in case webPreviewURL is already populated.
    const initial = snack.getState()
    if (initial.webPreviewURL) setWebPreviewURL(initial.webPreviewURL)

    const unsubState = snack.addStateListener(state => {
      if (state.webPreviewURL) {
        setWebPreviewURL(prev => prev !== state.webPreviewURL ? (state.webPreviewURL ?? null) : prev)
      }
    })
    return () => { try { unsubState() } catch { /* ignore */ } }
  }, [snack])

  // ─── React to payload changes — update files/name/deps in place. ──────────
  useEffect(() => {
    if (!payload || disabled) return
    try {
      const sdkFiles: Record<string, { type: 'CODE' | 'ASSET'; contents: string }> = {}
      for (const [path, file] of Object.entries(payload.files)) {
        sdkFiles[path] = {
          type: file.type === 'ASSET' ? 'ASSET' : 'CODE',
          contents: file.contents,
        }
      }
      snack.setName(payload.name)
      snack.updateDependencies(payload.dependencies)
      snack.updateFiles(sdkFiles)
    } catch (err) {
      console.error('[InlineSnackPreview] failed to update snack content', err)
      setSnackErrored(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snack, fingerprint, disabled])

  // ─── 15-second boot timeout. ──────────────────────────────────────────────
  useEffect(() => {
    if (!payload || snackReady || snackErrored) return
    const timer = setTimeout(() => {
      if (!snackReady) {
        console.warn('[InlineSnackPreview] Snack did not become ready within 15s — falling back to static')
        setSnackErrored(true)
      }
    }, 15000)
    return () => clearTimeout(timer)
  }, [payload, snackReady, snackErrored])

  // Reset error state when payload changes (e.g. fresh generation after a
  // failure) so we can try Snack again.
  useEffect(() => {
    setSnackErrored(false)
  }, [payload])

  // ResizeObserver — mirrors PreviewPhoneFrame's pattern.
  const setWrapperRef = useCallback((el: HTMLDivElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect()
      observerRef.current = null
    }
    if (el) {
      const ro = new ResizeObserver(entries => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect
          setContainerSize({ w: width, h: height })
        }
      })
      ro.observe(el)
      observerRef.current = ro
    }
  }, [])

  // Wire iframe.contentWindow into webPreviewRef so the SDK can postMessage.
  const setIframeRef = useCallback((el: HTMLIFrameElement | null) => {
    iframeRef.current = el
    webPreviewRefObjRef.current.current = el?.contentWindow ?? null
  }, [])

  // Disabled / errored / no payload yet → render nothing; static fallback shows.
  if (disabled || snackErrored || !payload) return null

  const scale = computeFitScale({
    container: containerSize,
    device: { w: device.width, h: device.height },
    manualZoom,
  })

  return (
    <div
      ref={setWrapperRef}
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        // While Snack is booting, let clicks fall through to the static
        // PreviewPhoneFrame underneath. After ready, take over.
        pointerEvents: snackReady ? 'auto' : 'none',
        opacity: snackReady ? 1 : 0,
        transition: 'opacity 0.25s ease',
      }}
    >
      <div
        style={{
          width: device.width,
          height: device.height,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          borderRadius: isAndroid ? 36 : 48,
          overflow: 'hidden',
          background: '#0A0A1A',
          visibility: containerSize.w === 0 ? 'hidden' : 'visible',
          flexShrink: 0,
        }}
      >
        <iframe
          ref={setIframeRef}
          // src=undefined until the SDK produces a webPreviewURL. Per the
          // Expo snack-sdk example pattern.
          src={webPreviewURL || undefined}
          onLoad={() => { if (webPreviewURL) setSnackReady(true) }}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block',
          }}
          title="Mokkoi Live Preview"
          // No sandbox attribute (matches the example). screen-wake-lock is
          // critical — expo-keep-awake's activateKeepAwake() rejects without
          // it, breaking the runtime's render in componentDidMount.
          allow="geolocation; camera; microphone; screen-wake-lock"
        />
      </div>
    </div>
  )
}
