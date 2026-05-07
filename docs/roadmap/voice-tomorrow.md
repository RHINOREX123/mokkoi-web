# Voice — bugs to fix tomorrow

Two issues from tonight's voice testing. Both happened AFTER shipping
d8ca441 (drop prompt-bias + lower threshold to 0.008).

## Issue 1: Voice-generated app has dead bottom nav

When the user generated an app via voice (prompt: "Sygic Drive"-style
nav app, image attached), the resulting screens showed a 4-tab bottom
nav (Home / Navigate / Explore / Profile) but the tabs are not wired
— tapping them does nothing.

This is NOT a voice bug specifically — it's a generation-quality bug
that may apply to typed prompts too. Worth checking:

- Does `/api/generate-flow` `mode: 'app'` return `connections` for
  the bottom nav?
- Does the `validateBottomNavLabels` step pass when the screens are
  generated from a voice-derived (more terse) prompt?
- Is the issue specific to short / sparse prompts where the planner
  doesn't produce a strong enough nav spec?

Reproduce: generate any 4-screen app, click each bottom tab on the
canvas. If they don't navigate, the bug is in the connections /
homeScreenId wiring, not the rendering.

## Issue 2: Voice tap → orb → no result, no navigation

Flow user reported:
1. Tap mic icon on dashboard
2. Orb appears (green/teal — confirms threshold dropped, mic open)
3. User speaks, taps orb to stop
4. Orb disappears
5. **User stays on dashboard** — no project page, no toast, no error

Likely causes (need to verify):

- **Transcription rejected as hallucination, no toast surfaced.**
  The hallucination filter returns `{ text: '', empty: true,
  hallucinated: true }`. The hook treats empty text as `no_speech`
  error, which the consumer (`onError`) is supposed to toast. But the
  PromptCard's onError might not be wired (only ChatPanel passes one).
- **Whisper returned text but it slipped past the gating in
  handleVoiceSubmit.** Worth logging the transcribed text on the
  client during the catch path so we can see what came back.
- **Audio captured had genuine no-speech (still too quiet).** Even
  0.008 might not be low enough for some setups. Should add a debug
  overlay that shows raw audioLevel during recording so we can SEE
  whether the user's voice is registering at all.

Action items:

1. Wire `onError` in `PromptCard` so dashboard voice failures toast
   visibly (currently only ChatPanel toasts).
2. Log the actual transcribe response on the client so we can see
   "did Whisper return text? was it filtered? did submit fire?"
3. Add a temporary debug peak meter to the orb (numeric audioLevel)
   to verify mic is actually picking up audio. Ship behind a
   `?debug=voice` URL flag so we can ask the user to share a screenshot.
4. Consider: if audioLevel stays under threshold for entire recording,
   surface a SPECIFIC error ("Mic level too low — check Windows audio
   settings") instead of generic "no speech detected".

## Pre-existing mojibake bug (separate roadmap doc)

See `docs/roadmap/fix-utf8-mojibake.md`. Visible in dashboard
placeholder text. Independent of voice work.
