# Voice prompt — mic next to Camera on prompt card

**Status:** `idea`
**Estimated effort:** 4–6 hours (Web Speech API path) OR 1 day (Whisper path)
**Priority:** Low-medium (nice-to-have; differentiator if done well)
**Owner:** unassigned

## Goal

Add a mic icon next to the Camera button on the dashboard PromptCard. User taps it → speaks → audio is transcribed → text fills the prompt textarea. They can edit before submitting.

## Why

- Some users prefer talking to typing (mobile, accessibility, fast iteration)
- Differentiator: most AI builders are keyboard-only
- Low friction add: live in the same row as Camera, no new screen

## Two implementation paths

### Path 1: Web Speech API (cheap, fast to ship)

```ts
// In PromptCard.tsx
const recognition = new (window as any).webkitSpeechRecognition()
recognition.continuous = false
recognition.interimResults = true
recognition.lang = 'en-US'

recognition.onresult = (event) => {
  const transcript = Array.from(event.results)
    .map(r => r[0].transcript)
    .join('')
  onChange(transcript)
}

recognition.start()
```

- 🟢 **Free** — runs in browser, no API cost
- 🟢 **Fast to ship** — ~4-6 hrs work
- 🟢 **Real-time partial results** — user sees text as they speak
- 🔴 **Chrome / Edge only** — not Safari, not Firefox
- 🔴 **English-only by default** (can pick other langs but quality varies)

### Path 2: Whisper API (better quality, costs $)

```ts
// Record audio with MediaRecorder
// POST audio to /api/transcribe
// Server: Whisper API call → return transcript
```

- 🟢 **Cross-browser** — works on Safari, Firefox, etc.
- 🟢 **Multilingual** — 99 languages supported
- 🟢 **Better accent tolerance**
- 🔴 **$0.006 per minute** — at scale, adds up
- 🔴 **No real-time** — record full audio, then transcribe (~2-3s latency)
- 🔴 **More backend work** — new endpoint, audio handling

## Recommended path

**Start with Path 1 (Web Speech API).** Ship it, see usage. Most users are on Chrome anyway. If we get Safari/Firefox feedback, upgrade to Path 2 with a fallback.

## UI design

```
[ ── prompt textarea ── ]
🎤  📷                         [Build|Plan]  [↑]
└─ mic
   Click → starts recording
   Click again → stops
   While recording: pulsing red dot, "Listening…" placeholder
   Transcript fills textarea live (Path 1) or after stop (Path 2)
```

## Files to touch (Path 1 — Web Speech API)

```
src/components/dashboard/PromptCard.tsx
  - Add mic IconBtn next to Camera (line ~210 area in current code)
  - useState for recording state
  - useEffect to attach SpeechRecognition listeners
  - onResult: call onChange(transcript)
```

That's it. No backend, no new dependencies.

## Files to touch (Path 2 — Whisper)

```
src/components/dashboard/PromptCard.tsx
  - Mic button + MediaRecorder logic
  - POST audio blob to /api/transcribe
api/transcribe.ts                  — NEW
  - Multipart audio handling
  - Whisper API call
  - Return { transcript: string }
```

## Permissions

Both paths require microphone permission. Browser handles the prompt natively. First-use should show a toast: "Mokkoi needs mic access to listen — your browser will ask."

## Out of scope

- Voice replies (Mokkoi speaking back)
- Multi-language UI (English-only for now)
- Voice commands beyond prompt input ("Mokkoi, build me an app" as a wake word — overkill)

## Dependencies

- None hard. Path 1 ships standalone.
- Path 2 needs an OpenAI API key with Whisper access in Vercel env vars.
