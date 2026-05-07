import { useEffect, useRef, useState } from 'react'
import { Mic } from 'lucide-react'
import { useVoiceRecording, type VoiceState } from '../hooks/useVoiceRecording'

interface VoiceMicButtonProps {
  /** Fired with the final transcribed prompt — consumer wires this to send. */
  onTranscribed: (text: string) => void
  /** Same shape as elsewhere in Mokkoi — bearer header, etc. */
  getAuthHeaders: () => Promise<Record<string, string>>
  /** Disable while another generation is in flight. */
  disabled?: boolean
  /** Compact = 24px button (chat input); regular = 28px (dashboard prompt). */
  size?: 'compact' | 'regular'
  /** Surfaced toast text — consumer can show as it likes. */
  onError?: (message: string) => void
}

const ERROR_TEXT: Record<string, string> = {
  permission_denied: 'Microphone access denied. Allow it in your browser to use voice.',
  unsupported: "Your browser doesn't support voice input. Try Chrome or Safari.",
  rate_limited: "Too many voice prompts in a short window. Wait a minute and try again.",
  transcribe_failed: "Couldn't transcribe that — try again?",
  no_speech: "Didn't catch any speech. Try again.",
}

/**
 * The premium-feeling voice orb. Lives in the dashboard prompt strip and
 * the project chat input. Three render states drive a single button:
 *
 * - idle: small Mic icon, neutral chrome — visually equivalent to other
 *   trailing icons in the input strip. No glow when not in use.
 * - recording: the icon explodes into a glowing orb with audio-reactive
 *   scale + concentric rings that expand on volume. Tap again to stop
 *   early; otherwise the hook auto-stops on 2s silence.
 * - transcribing: orb collapses, spinner ring sweeps, brief "..." beat
 *   before onTranscribed fires. Total perceived latency target ~1.5s.
 *
 * The recording state renders a fixed-position OVERLAY orb instead of
 * inflating in-place — the parent's flexbox would shift other inputs
 * around if we scaled the trigger. Overlay is centered above the trigger
 * via getBoundingClientRect.
 */
export function VoiceMicButton({
  onTranscribed,
  getAuthHeaders,
  disabled = false,
  size = 'compact',
  onError,
}: VoiceMicButtonProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const [overlayPos, setOverlayPos] = useState<{ left: number; top: number } | null>(null)

  const { state, audioLevel, error, start, stop } = useVoiceRecording({
    onTranscribed,
    getAuthHeaders,
  })

  // Surface errors via the consumer's toast handler. The hook clears errors
  // on every fresh start, so this only fires on real failures.
  useEffect(() => {
    if (!error) return
    const msg = ERROR_TEXT[error] || 'Voice input error.'
    onError?.(msg)
  }, [error, onError])

  // When entering recording, capture the trigger's screen position so the
  // overlay orb can center on it. Recompute on resize.
  useEffect(() => {
    if (state !== 'recording' && state !== 'transcribing') {
      setOverlayPos(null)
      return
    }
    const recompute = () => {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      setOverlayPos({ left: rect.left + rect.width / 2, top: rect.top + rect.height / 2 })
    }
    recompute()
    window.addEventListener('resize', recompute)
    window.addEventListener('scroll', recompute, true)
    return () => {
      window.removeEventListener('resize', recompute)
      window.removeEventListener('scroll', recompute, true)
    }
  }, [state])

  const handleClick = () => {
    if (disabled) return
    if (state === 'recording') {
      stop()
    } else if (state === 'idle') {
      void start()
    }
    // 'transcribing' is a transient intermediate — clicks are no-ops.
  }

  const triggerSize = size === 'regular' ? 32 : 28
  const iconSize = size === 'regular' ? 18 : 16

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleClick}
        disabled={disabled || state === 'transcribing'}
        aria-label={state === 'recording' ? 'Stop voice recording' : 'Start voice recording'}
        title={state === 'recording' ? 'Stop recording' : 'Speak to Mokkoi'}
        style={{
          width: triggerSize,
          height: triggerSize,
          borderRadius: 8,
          background: state === 'idle'
            ? 'rgba(255,255,255,0.04)'
            : 'rgba(45, 212, 191, 0.18)',
          border: state === 'idle'
            ? '1px solid rgba(255,255,255,0.08)'
            : '1px solid rgba(45, 212, 191, 0.35)',
          color: state === 'idle' ? '#94a3b8' : '#6ee7d4',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.4 : 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          flexShrink: 0,
          transition: 'background 0.2s ease, border-color 0.2s ease, color 0.2s ease',
        }}
      >
        <Mic size={iconSize} strokeWidth={1.8} />
      </button>

      {/* Overlay orb only renders during recording / transcribing */}
      {overlayPos && (
        <VoiceOrbOverlay
          state={state}
          audioLevel={audioLevel}
          left={overlayPos.left}
          top={overlayPos.top}
        />
      )}
    </>
  )
}

/**
 * The big audio-reactive orb that floats above the trigger button while
 * recording. Rendered as a fixed-position element so it can scale beyond
 * the input row without disturbing layout. CSS-only animation for the
 * breathing pulse; JS-driven inline styles for the audio reactivity so
 * we get sub-frame responsiveness from the hook's audioLevel value.
 */
function VoiceOrbOverlay({
  state,
  audioLevel,
  left,
  top,
}: {
  state: VoiceState
  audioLevel: number
  left: number
  top: number
}) {
  const isRecording = state === 'recording'
  const isTranscribing = state === 'transcribing'

  // Scale + glow drive off audioLevel during recording. During transcribing
  // we lock to a calm baseline.
  const orbScale = isRecording ? 1 + audioLevel * 0.35 : 1
  const ringStrength = Math.min(audioLevel * 3, 1)

  const orbSize = isRecording ? 132 : 88

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        left,
        top: top - 80, // float above the trigger so it doesn't cover the input
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    >
      {/* Concentric rings — audio-reactive opacity + scale. */}
      {[0, 1, 2].map(i => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: orbSize * 2,
            height: orbSize * 2,
            marginLeft: -(orbSize),
            marginTop: -(orbSize),
            borderRadius: '50%',
            border: '1px solid rgba(45, 212, 191, 0.45)',
            opacity: isRecording ? Math.max(ringStrength * (0.7 - i * 0.18), 0) : 0,
            transform: `scale(${(0.55 + ringStrength * 0.55 * ((i + 1) / 3) + i * 0.05).toFixed(3)})`,
            transition: 'opacity 0.2s ease, transform 0.2s ease',
          }}
        />
      ))}

      {/* Spinner ring during transcribing. */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: orbSize + 20,
          height: orbSize + 20,
          marginLeft: -(orbSize / 2 + 10),
          marginTop: -(orbSize / 2 + 10),
          borderRadius: '50%',
          border: '2px solid transparent',
          borderTopColor: 'rgba(110, 231, 212, 0.95)',
          borderRightColor: 'rgba(110, 231, 212, 0.45)',
          opacity: isTranscribing ? 1 : 0,
          animation: isTranscribing ? 'mokkoi-voice-spin 0.9s linear infinite' : 'none',
          transition: 'opacity 0.3s ease',
        }}
      />

      {/* Core orb */}
      <div
        style={{
          width: orbSize,
          height: orbSize,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, rgba(110, 231, 212, 0.95), rgba(6, 182, 212, 0.85) 60%, rgba(8, 145, 178, 0.95) 100%)',
          boxShadow: isRecording
            ? '0 0 0 1px rgba(110, 231, 212, 0.7), 0 0 60px rgba(45, 212, 191, 0.55), 0 0 120px rgba(6, 182, 212, 0.35)'
            : '0 0 0 1px rgba(110, 231, 212, 0.35), 0 0 30px rgba(45, 212, 191, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${orbScale.toFixed(3)})`,
          transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1), height 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s ease',
          animation: isRecording ? 'mokkoi-voice-breathe 1.4s ease-in-out infinite' : 'mokkoi-voice-breathe 2.6s ease-in-out infinite',
        }}
      >
        <Mic size={isRecording ? 36 : 28} color="white" strokeWidth={1.8} />
      </div>

      {/* Status label */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '100%',
          marginTop: 16,
          transform: 'translateX(-50%)',
          fontSize: 12,
          letterSpacing: 0.3,
          color: '#6ee7d4',
          whiteSpace: 'nowrap',
          opacity: 0.9,
        }}
      >
        {isRecording ? 'Listening…' : isTranscribing ? 'Transcribing…' : ''}
      </div>

      {/* Inject keyframes once globally — cheaper than a styled-components dep
          and keeps this component self-contained. */}
      <style>{`
        @keyframes mokkoi-voice-spin { to { transform: rotate(360deg); } }
        @keyframes mokkoi-voice-breathe {
          0%, 100% { filter: brightness(1); }
          50%      { filter: brightness(1.15); }
        }
      `}</style>
    </div>
  )
}
