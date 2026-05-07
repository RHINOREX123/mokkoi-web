# Voice error store (architectural debt)

Today's fix wires `onError` callbacks from each `<VoiceMicButton>` call site
(`PromptCard`, `ChatPanel`) up through their parent components (`Dashboard`,
`App`) so voice-flow errors — `no_speech`, `mic_denied`, transcription
failures — surface as toasts. This is a band-aid: the failure mode that
prompted the fix (orb tearing down silently when the hallucination filter
rejected empty audio) was exactly a silent failure caused by one call site
forgetting to pass `onError`. Long-term, `useVoiceRecording` should write
errors to a global toast/notification store (Zustand or a shared context)
and any `<VoiceMicButton>` consumer would inherit error surfacing
automatically. With opt-in callbacks, each new consumer is one missed prop
away from regressing to silent failure. Defense-in-depth empty-text guards
in `handleVoiceSubmit` / `handleVoiceTranscribed` are also part of today's
fix; those should remain even after the store lands, as a final backstop.
