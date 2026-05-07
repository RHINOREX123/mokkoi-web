# Voice prompt input (Whisper)

Spec for adding voice-to-prompt to Mokkoi. Self-contained — anyone can pick this up.

## Decisions locked

- **Transcription model:** `gpt-4o-mini-transcribe` (OpenAI). Fast, cheap (~$0.003/min), good quality.
- **Auto-stop:** silence detection at ~2s pause threshold. No manual stop button required (but tapping the orb again should still stop early).
- **Surface:** dashboard prompt input + project-page chat input. NOT edit-screen prompt (skip v1, revisit if usage demands).
- **No live partial transcription** during speech (more complex, deferred).
- **Auto-submit after transcription** — text bypasses the input field; goes straight to the pipeline.

## Open call (decide before building)

Magic vs safety tradeoff for the transcribed text:

- **A. Pure magic.** Whisper text never visible anywhere. Goes straight to `/api/generate-flow` or `/api/plan-conversation`. Best feel, worst recovery.
- **B. Brief flash.** Text appears in input for ~1s then auto-submits.
- **C. 2s undo.** Text appears + 2s countdown + cancel button. Premium AND safe.

Recommended: **C**. Same magic feel, recoverable on misheard prompts.

## Architecture

```
Tap mic → MediaRecorder API → blob → POST /api/transcribe (multipart)
       → server forwards to OpenAI gpt-4o-mini-transcribe
       → text returned to client → fed into existing prompt pipeline
```

No changes to `/api/generate-flow` or `/api/plan-conversation`. Voice is purely an input-method addition.

## UI states

| State | Visual |
|---|---|
| Idle | Lucide `Mic` icon, same weight as Camera button |
| Recording | Pulsing glow orb, audio-reactive subtle waveform ring, dim background tint |
| Transcribing | Orb resolves to small spinner |
| Done (option C) | Text in input + 2s "Cancel" countdown |
| Error (mic denied / no audio / network fail) | Toast with retry |

## Endpoint sketch

`POST /api/transcribe`
- Body: `multipart/form-data` with audio blob
- Auth: same `authenticateRequest` helper
- Forwards to OpenAI API with `OPENAI_API_KEY` env var
- Returns `{ text: string }` on success
- Rate-limit: ~30 transcriptions/hour per user (cheap but spammable otherwise)
- Defensive: reject blobs > 25MB (OpenAI limit) and < 0.5s duration (junk)

## Files to touch

- New: `api/transcribe.ts`
- New: `src/hooks/useVoiceRecording.ts` (MediaRecorder + silence detection state machine)
- New: `src/components/VoiceMicButton.tsx` (the orb + waveform + transitions)
- Modify: dashboard prompt input + ChatPanel input — drop the new button alongside `+` / Camera
- Add: `OPENAI_API_KEY` to Vercel env

## Edge cases to handle

1. Mic permission denied — clear toast, link to browser settings
2. No audio detected (user stays silent for full timeout) — silent abort, no API call
3. Whisper returns empty text — toast "couldn't hear you, try again"
4. Background noise / crosstalk — Whisper handles reasonably; no explicit dedupe
5. User taps mic during in-flight generation — disable button while `isGenerating`
6. User speaks too long (>60s) — hard cap, force stop, transcribe what we have

## Cost ballpark

30s avg recording × $0.003/min = ~$0.0015 per transcription. 1000 free users × 5 prompts = $7.50/mo. Negligible.

## Scope

~4 hours focused work after the open call (A/B/C) is decided.
