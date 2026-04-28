import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
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

/** Inline Bolt-style preview: overlays the rendered Expo Snack web iframe
 *  on top of `<PreviewPhoneFrame>` so the user sees the actual running RN
 *  app instead of a static tree render.
 *
 *  Architecture:
 *  - This component is `position: absolute; inset: 0` over the same container
 *    that holds `<PreviewPhoneFrame>`. Static stays mounted underneath.
 *  - We embed `snack.expo.dev/embedded?platform=web&...` (the same URL the
 *    `<ExpoPreviewModal>` already uses — web platform is supported out of
 *    the box). The handshake is the same `expoFrameLoaded` / `expoDataEvent`
 *    postMessage protocol — see ExpoPreviewModal.tsx for the original.
 *  - While Snack boots (~5–10s) the iframe is opacity:0 / pointerEvents:none,
 *    so the static phone underneath is fully visible/interactive.
 *  - On `expoFrameLoaded`, we send the payload, mark ready, and fade in.
 *  - On 15s timeout or build error, we keep the iframe hidden and the
 *    static fallback remains visible.
 *
 *  No SDK package — uses raw postMessage. Generated code uses a state-based
 *  tab switcher (no React Navigation), all RN core imports — works on
 *  react-native-web inside Snack with no compatibility shims. */
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

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const iframeIdRef = useRef(`mokkoi-inline-${Date.now()}`)
  const payloadSentRef = useRef(false)
  const observerRef = useRef<ResizeObserver | null>(null)

  const device = getDevicePreset(deviceId || DEFAULT_DEVICE)
  const isAndroid = device.category === 'Android'

  // Build payload once — same call the modal uses.
  const payload = useMemo(() => {
    if (screens.length === 0) return null
    try {
      return buildSnackPayload({ projectName, screens, connections })
    } catch (err) {
      console.error('[InlineSnackPreview] failed to build snack payload', err)
      return null
    }
  }, [projectName, screens, connections])

  const shouldRunSnack = !disabled && payload !== null && !snackErrored

  // ResizeObserver — measure the available container so we can scale the
  // phone-shaped wrapper to fit. Mirrors PreviewPhoneFrame's pattern (callback
  // ref so we (re-)attach on every wrapper mount, not just first paint).
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

  // postMessage handshake. Identical to ExpoPreviewModal's protocol:
  //   1. Snack iframe sends ['expoFrameLoaded', { iframeId }]
  //   2. We reply with ['expoDataEvent', { iframeId, files, dependencies }]
  //   3. Snack builds + renders the code on web
  useEffect(() => {
    if (!shouldRunSnack || !payload) return
    const iframeId = iframeIdRef.current

    function handleMessage(event: MessageEvent) {
      if (!Array.isArray(event.data) || event.data.length < 2) return
      const [eventName, data] = event.data
      if (eventName === 'expoFrameLoaded' && data?.iframeId === iframeId) {
        // Convert dependencies map → "pkg@x,pkg2@y" string format Snack expects.
        const depsString = Object.entries(payload!.dependencies)
          .map(([name, val]) => {
            const v = (val as { version: string }).version
            return v && v !== '*' ? `${name}@${v}` : name
          })
          .join(',')

        iframeRef.current?.contentWindow?.postMessage(
          ['expoDataEvent', {
            iframeId,
            files: JSON.stringify(payload!.files),
            dependencies: depsString,
          }],
          '*',
        )
        payloadSentRef.current = true
        setSnackReady(true)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [shouldRunSnack, payload])

  // 15-second boot timeout. If Snack hasn't acknowledged by then, fall back
  // to static (set errored flag → component returns null → static visible).
  // Same threshold as ExpoPreviewModal.
  useEffect(() => {
    if (!shouldRunSnack) return
    payloadSentRef.current = false
    setSnackReady(false)
    const timer = setTimeout(() => {
      if (!payloadSentRef.current) {
        console.warn('[InlineSnackPreview] Snack did not respond within 15s — falling back to static')
        setSnackErrored(true)
      }
    }, 15000)
    return () => clearTimeout(timer)
  }, [shouldRunSnack])

  // Reset error state when payload changes (e.g. new generation) so we can
  // try Snack again after a successful regen following a failed attempt.
  useEffect(() => {
    setSnackErrored(false)
  }, [payload])

  // No payload, disabled, or errored → render nothing; static fallback shows.
  if (!shouldRunSnack || !payload) return null

  const scale = computeFitScale({
    container: containerSize,
    device: { w: device.width, h: device.height },
    manualZoom,
  })

  const iframeId = iframeIdRef.current
  const iframeSrc = `https://snack.expo.dev/embedded?iframeId=${iframeId}&preview=true&platform=web&supportedPlatforms=mydevice,ios,android&theme=dark&waitForData=true`

  return (
    <div
      ref={setWrapperRef}
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        // While Snack is booting, let clicks fall through to the static
        // PreviewPhoneFrame underneath (so the user can still scroll, tap,
        // navigate via the in-static button capture). After ready, take
        // over so taps go to the running app.
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
          ref={iframeRef}
          src={iframeSrc}
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
