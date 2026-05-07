import { useCallback, useEffect, useRef, useState } from 'react'

export type VoiceState = 'idle' | 'recording' | 'transcribing'

export interface UseVoiceRecordingResult {
  state: VoiceState
  /** Normalized 0..1 audio level Ã¢â‚¬â€ use to drive UI animation. */
  audioLevel: number
  /** Last error (clears on next start). */
  error: string | null
  start: () => Promise<void>
  /** Manual stop Ã¢â‚¬â€ auto-stop on silence is built in but UI can also force it. */
  stop: () => void
}

export interface UseVoiceRecordingOptions {
  /** Called once transcription returns, with the final text. Empty/whitespace text is suppressed (the hook sets an error instead). */
  onTranscribed: (text: string) => void
  /**
   * Authorization header(s) to send with the POST. Same shape Mokkoi uses
   * elsewhere Ã¢â‚¬â€ the dashboard / chat panel pass through getAuthHeaders().
   */
  getAuthHeaders: () => Promise<Record<string, string>>
  /** Auth/server endpoint. Defaults to /api/transcribe. */
  endpoint?: string
  /** ms of continuous quiet before auto-stop. Default 2000. */
  silenceHoldMs?: number
  /** Normalized [0,1] threshold below which the signal counts as silence. Default 0.012 - low enough to detect quiet speech without false-triggering on ambient noise. */
  silenceThreshold?: number
  /** Hard cap on recording duration. Default 60_000. */
  maxDurationMs?: number
}

const SUPPORTED_MIMES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
]

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  for (const t of SUPPORTED_MIMES) {
    if (MediaRecorder.isTypeSupported(t)) return t
  }
  return ''
}

/**
 * Headless recording state machine. Handles mic acquisition, MediaRecorder
 * lifecycle, real-time level metering for the UI, silence-based auto-stop,
 * and POSTing the captured blob to /api/transcribe. The `audioLevel`
 * 0..1 number can be wired to scale, glow intensity, ring opacity, etc.
 *
 * Failure modes (all surface via `error`):
 * - mic permission denied Ã¢â€ â€™ "permission_denied"
 * - MediaRecorder not supported Ã¢â€ â€™ "unsupported"
 * - transcribe upstream error Ã¢â€ â€™ "transcribe_failed"
 * - empty transcription (silence detected but nothing said) Ã¢â€ â€™ "no_speech"
 * - rate limited Ã¢â€ â€™ "rate_limited"
 *
 * The hook does NOT decide what to do with the transcribed text Ã¢â‚¬â€ the
 * consumer's onTranscribed callback fires it down the prompt pipeline.
 */
export function useVoiceRecording(opts: UseVoiceRecordingOptions): UseVoiceRecordingResult {
  const {
    onTranscribed,
    getAuthHeaders,
    endpoint = '/api/transcribe',
    silenceHoldMs = 2000,
    silenceThreshold = 0.012,
    maxDurationMs = 60_000,
  } = opts

  const [state, setState] = useState<VoiceState>('idle')
  const [audioLevel, setAudioLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const mediaStreamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const silenceStartRef = useRef<number>(0)
  /** Flips true on the first frame above threshold. Auto-stop only fires
   *  after this â€” otherwise a quiet room kills recording before speech. */
  const hasSpeechDetectedRef = useRef<boolean>(false)
  const startedAtRef = useRef<number>(0)
  const chunksRef = useRef<Blob[]>([])
  const mimeTypeRef = useRef<string>('')
  // We reference these from event handlers Ã¢â‚¬â€ keep them in refs so the closure
  // sees the latest opts values without re-binding the recorder each render.
  const onTranscribedRef = useRef(onTranscribed)
  const getAuthHeadersRef = useRef(getAuthHeaders)
  useEffect(() => { onTranscribedRef.current = onTranscribed }, [onTranscribed])
  useEffect(() => { getAuthHeadersRef.current = getAuthHeaders }, [getAuthHeaders])

  const cleanupAudioGraph = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    analyserRef.current = null
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {})
      audioCtxRef.current = null
    }
    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) track.stop()
      mediaStreamRef.current = null
    }
  }, [])

  // Always tear down on unmount so a user navigating away mid-record
  // doesn't leak a hot mic.
  useEffect(() => {
    return () => {
      cleanupAudioGraph()
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try { recorderRef.current.stop() } catch {}
      }
      recorderRef.current = null
    }
  }, [cleanupAudioGraph])

  const stop = useCallback(() => {
    // Cancelling the metering loop here means the orb stops reacting the
    // moment the user (or auto-silence) ends recording. The recorder's
    // onstop fires asynchronously and drives the transcribe POST.
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    setAudioLevel(0)
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      try { recorderRef.current.stop() } catch {}
    }
  }, [])

  const start = useCallback(async () => {
    setError(null)
    if (state !== 'idle') return

    if (typeof MediaRecorder === 'undefined' || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('unsupported')
      return
    }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setError('permission_denied')
      return
    }
    mediaStreamRef.current = stream

    const mimeType = pickMimeType()
    mimeTypeRef.current = mimeType
    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    } catch (err) {
      cleanupAudioGraph()
      console.error('[useVoiceRecording] MediaRecorder construct failed:', err)
      setError('unsupported')
      return
    }
    recorderRef.current = recorder
    chunksRef.current = []

    recorder.ondataavailable = e => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = async () => {
      cleanupAudioGraph()
      const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current || 'audio/webm' })
      chunksRef.current = []
      // Sub-second clips are usually accidental taps; bail out without
      // hitting the API.
      if (blob.size < 1024) {
        setState('idle')
        setError('no_speech')
        return
      }
      setState('transcribing')
      try {
        const headers = await getAuthHeadersRef.current()
        // Don't let getAuthHeaders set a Content-Type Ã¢â‚¬â€ we need the audio mime.
        const cleanHeaders: Record<string, string> = {}
        for (const [k, v] of Object.entries(headers)) {
          if (k.toLowerCase() !== 'content-type') cleanHeaders[k] = v
        }
        cleanHeaders['Content-Type'] = blob.type || 'audio/webm'
        const resp = await fetch(endpoint, {
          method: 'POST',
          headers: cleanHeaders,
          body: blob,
        })
        if (resp.status === 429) {
          setError('rate_limited')
          setState('idle')
          return
        }
        if (!resp.ok) {
          setError('transcribe_failed')
          setState('idle')
          return
        }
        const data = await resp.json()
        const text = typeof data?.text === 'string' ? data.text.trim() : ''
        if (!text) {
          setError('no_speech')
          setState('idle')
          return
        }
        setState('idle')
        onTranscribedRef.current(text)
      } catch (err) {
        console.error('[useVoiceRecording] transcribe failed:', err)
        setError('transcribe_failed')
        setState('idle')
      }
    }

    // Audio metering for the UI. AnalyserNode runs cheap; we only sample
    // 30Hz via rAF, which is more than enough to drive a smooth orb.
    const Ctor: typeof AudioContext = (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext || window.AudioContext
    const ctx = new Ctor()
    audioCtxRef.current = ctx
    const src = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    analyser.smoothingTimeConstant = 0.82
    src.connect(analyser)
    analyserRef.current = analyser
    const data = new Uint8Array(analyser.frequencyBinCount)

    silenceStartRef.current = 0
    hasSpeechDetectedRef.current = false
    startedAtRef.current = performance.now()
    setState('recording')
    recorder.start()

    const tick = () => {
      if (!analyserRef.current || !recorderRef.current || recorderRef.current.state !== 'recording') {
        return
      }
      analyserRef.current.getByteFrequencyData(data)
      let sum = 0
      for (let i = 0; i < data.length; i++) sum += data[i]
      const avg = (sum / data.length) / 255
      setAudioLevel(avg)

      const now = performance.now()
      // Hard cap so a forgotten recording doesn't run forever.
      if (now - startedAtRef.current > maxDurationMs) {
        stop()
        return
      }

      if (avg >= silenceThreshold) {
        hasSpeechDetectedRef.current = true
        silenceStartRef.current = 0
      } else if (hasSpeechDetectedRef.current) {
        if (silenceStartRef.current === 0) silenceStartRef.current = now
        if (now - silenceStartRef.current > silenceHoldMs) {
          stop()
          return
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [state, endpoint, silenceHoldMs, silenceThreshold, maxDurationMs, cleanupAudioGraph, stop])

  return { state, audioLevel, error, start, stop }
}
