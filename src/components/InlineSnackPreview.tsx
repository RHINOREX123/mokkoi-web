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

/** Inline Bolt-style preview: overlays the rendered Expo Snack web-player
 *  iframe on top of `<PreviewPhoneFrame>` so the user sees the actual
 *  running RN app instead of a static tree render.
 *
 *  Architecture:
 *  - This component is `position: absolute; inset: 0` over the same container
 *    that holds `<PreviewPhoneFrame>`. Static stays mounted underneath.
 *  - Uses the official `snack-sdk` package. We construct a `Snack` instance
 *    with our generated files+dependencies and pass an `iframe.contentWindow`
 *    reference via `webPreviewRef`. The SDK handles the socket.io transport
 *    and exposes `state.webPreviewURL` — the chrome-free web-player URL we
 *    set as the iframe's src.
 *  - The previous home-rolled `/embedded` postMessage approach put us on
 *    Snack's IDE view (code editor visible). The SDK's web player URL is
 *    a separate runtime endpoint that renders only the running app.
 *  - While Snack boots (~5–10s) the iframe is opacity:0 / pointerEvents:none,
 *    so the static phone underneath is fully visible/interactive.
 *  - On 15s timeout or build error, we keep the iframe hidden and the
 *    static fallback remains visible.
 *
 *  `<ExpoPreviewModal>` is unchanged — it still uses the manual postMessage
 *  protocol for its mobile/QR flow. The SDK is only used here in the inline
 *  web preview where its web-player URL is what we need. */
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
  // dispatch. The SDK's SnackWindowRef type is `{ current: Window | null }`
  // (NOT a React RefObject of that — directly the object). We keep one
  // stable instance for the SDK and mutate `.current` when the iframe mounts.
  const webPreviewRefObjRef = useRef<{ current: Window | null }>({ current: null })
  const observerRef = useRef<ResizeObserver | null>(null)

  const device = getDevicePreset(deviceId || DEFAULT_DEVICE)
  const isAndroid = device.category === 'Android'

  // Stable content fingerprint. The parent passes `screens` and `connections`
  // as freshly-allocated arrays on every render (App.tsx does `.filter(...)`
  // inline). If we keyed the payload memo on those arrays directly, every
  // parent render would recompute the payload AND retrigger the SDK init
  // effect — resetting snackReady to false in a tight loop, so the iframe
  // never finished its 0→1 opacity transition. Hash the inputs to a stable
  // string and key both memos off of that.
  const fingerprint = useMemo(() => {
    if (screens.length === 0) return ''
    const screensKey = screens
      .map(s => `${s.id}:${s.name}:${s.tree ? JSON.stringify(s.tree).length : 0}`)
      .join('|')
    const connKey = connections.map(c => `${c.fromScreenId}>${c.toScreenId}`).join(',')
    return `${projectName}::${screensKey}::${connKey}`
  }, [projectName, screens, connections])

  // Build the same files+dependencies payload the modal uses. Memoized on the
  // fingerprint so identity stays stable across re-renders when content is
  // unchanged.
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

  const shouldRunSnack = !disabled && payload !== null && !snackErrored

  // ResizeObserver — mirrors PreviewPhoneFrame's pattern (callback ref so we
  // (re-)attach on every wrapper mount, not just first paint).
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

  // Snack SDK lifecycle. One Snack instance per payload. The SDK will:
  //   1. Connect to Snack's runtime endpoint (socket.io).
  //   2. Build the project and produce a `webPreviewURL`.
  //   3. Use `webPreviewRef.current` to postMessage the iframe contentWindow.
  // We treat a non-null webPreviewURL as the readiness signal.
  useEffect(() => {
    if (!shouldRunSnack || !payload) return

    setSnackReady(false)
    setWebPreviewURL(null)

    // Convert `buildSnackPayload`'s file shape (`{type, contents}`) to the
    // SDK's expected SnackFiles type, which requires `type: 'CODE' | 'ASSET'`.
    const sdkFiles: Record<string, { type: 'CODE' | 'ASSET'; contents: string }> = {}
    for (const [path, file] of Object.entries(payload.files)) {
      sdkFiles[path] = {
        type: file.type === 'ASSET' ? 'ASSET' : 'CODE',
        contents: file.contents,
      }
    }

    let unsub: (() => void) | undefined
    let snack: Snack | undefined
    try {
      snack = new Snack({
        name: payload.name,
        files: sdkFiles,
        dependencies: payload.dependencies,
        webPreviewRef: webPreviewRefObjRef.current,
        online: true,
        // Default SDK version for new snacks (lines up with what the modal
        // payload assumes — RN core only, no expo-router).
      })

      // Pull the URL out of the initial state and subscribe to changes —
      // the URL becomes available after the first Snack server roundtrip.
      const initial = snack.getState()
      if (initial.webPreviewURL) setWebPreviewURL(initial.webPreviewURL)

      unsub = snack.addStateListener(state => {
        if (state.webPreviewURL && state.webPreviewURL !== webPreviewURL) {
          setWebPreviewURL(state.webPreviewURL)
        }
      })
    } catch (err) {
      console.error('[InlineSnackPreview] Snack SDK init failed', err)
      setSnackErrored(true)
    }

    return () => {
      try { unsub?.() } catch { /* ignore */ }
      try { snack?.setOnline?.(false) } catch { /* ignore */ }
    }
  }, [shouldRunSnack, payload])

  // 15-second boot timeout — same threshold as ExpoPreviewModal. If the
  // iframe never loads / Snack never produces content, fall back to static.
  useEffect(() => {
    if (!shouldRunSnack) return
    const timer = setTimeout(() => {
      if (!snackReady) {
        console.warn('[InlineSnackPreview] Snack did not become ready within 15s — falling back to static')
        setSnackErrored(true)
      }
    }, 15000)
    return () => clearTimeout(timer)
  }, [shouldRunSnack, snackReady])

  // Reset error state when payload changes (e.g. new generation) so we can
  // try Snack again after a successful regen following a failed attempt.
  useEffect(() => {
    setSnackErrored(false)
  }, [payload])

  // Wire the iframe.contentWindow into webPreviewRef so the SDK can postMessage
  // into it. The SDK handles the rest of the protocol.
  const setIframeRef = useCallback((el: HTMLIFrameElement | null) => {
    iframeRef.current = el
    webPreviewRefObjRef.current.current = el?.contentWindow ?? null
  }, [])

  // No payload, disabled, or errored → render nothing; static fallback shows.
  if (!shouldRunSnack || !payload) return null

  const scale = computeFitScale({
    container: containerSize,
    device: { w: device.width, h: device.height },
    manualZoom,
  })

  // CRITICAL: always render the iframe element (with `src=undefined` until
  // webPreviewURL arrives), so `contentWindow` is wired into webPreviewRef
  // BEFORE the SDK starts trying to postMessage into it. Conditionally
  // rendering the iframe (only after the URL is set) creates a race —
  // the SDK can call its update method on the same render that the iframe
  // first mounts, see webPreviewRef.current === null, and never retry,
  // leaving the iframe stuck on "Connecting..." indefinitely. The iframe
  // gets `src=undefined` initially (renders an empty document with a live
  // contentWindow), then `src=webPreviewURL` once the URL is available.
  // This matches the official Expo snack-sdk example pattern.
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
          // Match PhoneFrame's chassis radius so the iframe corners align
          // with the static phone underneath while it's fading in.
          borderRadius: isAndroid ? 36 : 48,
          overflow: 'hidden',
          background: '#0A0A1A',
          // Don't render until the wrapper has been measured — avoids a
          // 1.0-scale flash on first frame.
          visibility: containerSize.w === 0 ? 'hidden' : 'visible',
          flexShrink: 0,
        }}
      >
        <iframe
          ref={setIframeRef}
          // src is undefined until the SDK produces a webPreviewURL. Without
          // this gate the iframe loads about:blank then tries to navigate,
          // breaking the contentWindow reference the SDK is holding. Per
          // Expo snack-sdk's official example.
          src={webPreviewURL || undefined}
          onLoad={() => { if (webPreviewURL) setSnackReady(true) }}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block',
          }}
          title="Mokkoi Live Preview"
          allow="accelerometer; encrypted-media; gyroscope; payment"
          sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
        />
      </div>
    </div>
  )
}
