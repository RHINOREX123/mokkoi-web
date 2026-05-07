import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Mic, X } from 'lucide-react'
import { useVoiceRecording, type VoiceState } from '../hooks/useVoiceRecording'

interface VoiceMicButtonProps {
  /** Fired with the final transcribed prompt — consumer wires this to send. */
  onTranscribed: (text: string) => void
  /** Same shape as elsewhere in Mokkoi — bearer header, etc. */
  getAuthHeaders: () => Promise<Record<string, string>>
  /** Disable while another generation is in flight. */
  disabled?: boolean
  /** Compact = 24px button (chat input); regular = 32px (dashboard prompt). */
  size?: 'compact' | 'regular'
  /** Surfaced toast text — consumer can show as it likes. */
  onError?: (message: string) => void
}

const ERROR_TEXT: Record<string, string> = {
  permission_denied: 'Microphone access denied. Allow it in your browser to use voice.',
  unsupported: "Your browser doesn't support voice input. Try Chrome or Safari.",
  rate_limited: 'Too many voice prompts in a short window. Wait a minute and try again.',
  transcribe_failed: "Couldn't transcribe that — try again?",
  no_speech: "Didn't catch any speech. Try again.",
}

/**
 * Premium hero-style voice input. The trigger is small (sits inline with
 * other input chrome) but tapping it opens a fullscreen, centered overlay
 * with a large audio-reactive orb — Siri / ChatGPT voice-mode pattern.
 *
 * The overlay renders via React portal to document.body so it escapes
 * any ancestor stacking context (the dashboard PromptCard has glassmorphic
 * filters that would otherwise trap a position:fixed child).
 *
 * Status copy walks the user through the whole flow so they never wonder
 * what's happening: "Tap to speak" → "Listening…" → "Heard you" →
 * "Transcribing…" → "Sending to Mokkoi" → off.
 */
export function VoiceMicButton({
  onTranscribed,
  getAuthHeaders,
  disabled = false,
  size = 'compact',
  onError,
}: VoiceMicButtonProps) {
  // Defer the onTranscribed call by one tick after teardown so the overlay
  // gets a chance to render its "Sending" frame before this component
  // unmounts during navigation.
  const [pendingSend, setPendingSend] = useState<string | null>(null)
  const handleTranscribed = (text: string) => setPendingSend(text)

  const { state, audioLevel, error, start, stop } = useVoiceRecording({
    onTranscribed: handleTranscribed,
    getAuthHeaders,
  })

  useEffect(() => {
    if (!pendingSend) return
    const t = setTimeout(() => {
      onTranscribed(pendingSend)
      setPendingSend(null)
    }, 500)
    return () => clearTimeout(t)
  }, [pendingSend, onTranscribed])

  // Surface errors via the consumer's toast handler.
  useEffect(() => {
    if (!error) return
    const msg = ERROR_TEXT[error] || 'Voice input error.'
    onError?.(msg)
  }, [error, onError])

  const handleClick = () => {
    if (disabled) return
    if (state === 'recording') {
      stop()
    } else if (state === 'idle' && !pendingSend) {
      void start()
    }
  }

  const triggerSize = size === 'regular' ? 32 : 28
  const iconSize = size === 'regular' ? 18 : 16

  // The overlay shows for any non-idle state, plus the "Sending" beat after
  // the hook returns to idle but before the parent's send fires.
  const overlayActive = state !== 'idle' || pendingSend !== null

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || state === 'transcribing' || pendingSend !== null}
        aria-label={state === 'recording' ? 'Stop voice recording' : 'Start voice recording'}
        title={state === 'recording' ? 'Stop recording' : 'Speak to Mokkoi'}
        style={{
          width: triggerSize,
          height: triggerSize,
          borderRadius: 8,
          background: state === 'idle' && !pendingSend
            ? 'rgba(255,255,255,0.04)'
            : 'rgba(45, 212, 191, 0.18)',
          border: state === 'idle' && !pendingSend
            ? '1px solid rgba(255,255,255,0.08)'
            : '1px solid rgba(45, 212, 191, 0.35)',
          color: state === 'idle' && !pendingSend ? '#94a3b8' : '#6ee7d4',
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

      {overlayActive && createPortal(
        <VoiceOverlay
          state={state}
          audioLevel={audioLevel}
          sending={pendingSend !== null}
          onCancel={() => stop()}
        />,
        document.body,
      )}
    </>
  )
}

/**
 * Fullscreen Siri-style overlay. Renders into a portal at document.body
 * so it sits above every other layer regardless of where the trigger
 * was mounted. Tapping the dim backdrop cancels the recording.
 */
function VoiceOverlay({
  state,
  audioLevel,
  sending,
  onCancel,
}: {
  state: VoiceState
  audioLevel: number
  sending: boolean
  onCancel: () => void
}) {
  const isRecording = state === 'recording'
  const isTranscribing = state === 'transcribing'

  // Status walk: idle UI never reaches the overlay (gated above).
  // recording with no speech yet → "Tap and speak"
  // recording with speech → "Listening…"
  // transcribing → "Heard you · transcribing…"
  // sending (post-hook idle, pre-parent send) → "Sending to Mokkoi"
  const showHeardYet = isRecording && audioLevel >= 0.012
  const status = sending
    ? 'Sending to Mokkoi'
    : isTranscribing
      ? 'Heard you · transcribing…'
      : showHeardYet
        ? 'Listening…'
        : 'Speak now'

  const orbScale = isRecording ? 1 + audioLevel * 0.45 : 1
  const ringStrength = Math.min(audioLevel * 3, 1)
  const orbSize = isRecording ? 200 : 140

  return (
    <div
      role="dialog"
      aria-label="Voice input"
      onClick={isRecording ? onCancel : undefined}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483647,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 36,
        background: 'rgba(5, 8, 14, 0.78)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        animation: 'mokkoi-voice-fade-in 0.25s ease-out',
      }}
    >
      {/* Orb stack — clicking the orb itself stops, clicking backdrop also stops */}
      <div
        style={{ position: 'relative', width: 360, height: 360, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Concentric rings — audio-reactive */}
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: orbSize * 2.4,
              height: orbSize * 2.4,
              borderRadius: '50%',
              border: '1px solid rgba(110, 231, 212, 0.5)',
              opacity: isRecording ? Math.max(ringStrength * (0.7 - i * 0.15), 0) : 0,
              transform: `scale(${(0.4 + ringStrength * 0.55 * ((i + 1) / 4) + i * 0.07).toFixed(3)})`,
              transition: 'opacity 0.2s ease, transform 0.2s ease',
              pointerEvents: 'none',
            }}
          />
        ))}

        {/* Spinner ring during transcribing/sending */}
        <div
          style={{
            position: 'absolute',
            width: orbSize + 28,
            height: orbSize + 28,
            borderRadius: '50%',
            border: '2px solid transparent',
            borderTopColor: 'rgba(110, 231, 212, 0.95)',
            borderRightColor: 'rgba(110, 231, 212, 0.45)',
            opacity: isTranscribing || sending ? 1 : 0,
            animation: (isTranscribing || sending) ? 'mokkoi-voice-spin 0.9s linear infinite' : 'none',
            transition: 'opacity 0.3s ease',
            pointerEvents: 'none',
          }}
        />

        {/* Core orb */}
        <button
          type="button"
          onClick={isRecording ? onCancel : undefined}
          aria-label={isRecording ? 'Stop' : status}
          style={{
            width: orbSize,
            height: orbSize,
            borderRadius: '50%',
            border: 'none',
            padding: 0,
            background: 'radial-gradient(circle at 35% 35%, rgba(110, 231, 212, 0.95), rgba(6, 182, 212, 0.85) 60%, rgba(8, 145, 178, 0.95) 100%)',
            boxShadow: isRecording
              ? '0 0 0 1px rgba(110, 231, 212, 0.7), 0 0 100px rgba(45, 212, 191, 0.7), 0 0 200px rgba(6, 182, 212, 0.4)'
              : '0 0 0 1px rgba(110, 231, 212, 0.5), 0 0 60px rgba(45, 212, 191, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: `scale(${orbScale.toFixed(3)})`,
            transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1), height 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s ease',
            animation: isRecording
              ? 'mokkoi-voice-breathe 1.4s ease-in-out infinite'
              : 'mokkoi-voice-breathe 2.6s ease-in-out infinite',
            cursor: isRecording ? 'pointer' : 'default',
            color: 'white',
          }}
        >
          <Mic size={isRecording ? 56 : 44} strokeWidth={1.8} />
        </button>
      </div>

      {/* Status text */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            fontSize: 18,
            fontWeight: 500,
            letterSpacing: 0.2,
            color: '#e2e8f0',
            textAlign: 'center',
          }}
        >
          {status}
        </div>
        {isRecording && (
          <div
            style={{
              fontSize: 12,
              color: '#64748b',
              letterSpacing: 0.4,
              opacity: 0.8,
            }}
          >
            Pause to send · tap orb or backdrop to cancel
          </div>
        )}
      </div>

      {/* Cancel button — top-right, simple and discoverable */}
      {isRecording && (
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel voice input"
          style={{
            position: 'fixed',
            top: 24,
            right: 24,
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#cbd5e1',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={18} />
        </button>
      )}

      {/* Inject keyframes once. */}
      <style>{`
        @keyframes mokkoi-voice-spin { to { transform: rotate(360deg); } }
        @keyframes mokkoi-voice-breathe {
          0%, 100% { filter: brightness(1); }
          50%      { filter: brightness(1.2); }
        }
        @keyframes mokkoi-voice-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
