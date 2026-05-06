# Conversational intent — Haiku-powered chat gating

**Status:** `scoped`
**Estimated effort:** 4–6 hours (prompt engineering + classifier + frontend wiring)
**Priority:** Medium-high (real UX gap; users expect AI to converse, not always build)
**Owner:** unassigned

## The problem

Mokkoi treats every input as a build request. Examples that misfire today:

| User says | Mokkoi does | Should do |
|---|---|---|
| "hey mokkoi how are you doing" | Generates a "chat conversation screen" | Reply: "Doing great! Got an app idea?" |
| "what can you do?" | Tries to build something | Reply explaining capabilities |
| "I want a fitness app but not sure what screens" | Builds something generic | Ask 2-3 clarifying questions before building |
| "build me a fitness app" | Generates app ✓ | Same — actual build intent |

The chat panel UI **already supports conversational messages** — the limitation is on the AI side: the system prompt always assumes "user wants me to build."

## Architecture

Two-stage pipeline using Haiku for classification + Sonnet for generation:

```
User submits message
       │
       ▼
┌──────────────────────────┐
│ Stage 1: Haiku classifier │  ~$0.0008, ~400ms
│ "Is this a build request │
│  or conversation?"        │
└──────┬───────────────────┘
       │
       ├── conversation ──→ Haiku replies in chat (no screens generated)
       │
       └── build ──────────→ Sonnet generates app (existing pipeline)
```

Haiku is the right model for both branches:
- **Classifier:** trivially within Haiku's intelligence
- **Conversational reply:** Haiku is fast enough to feel snappy and natural

Sonnet stays for the heavy lift (actual screen generation).

## Files to touch

```
api/generate.ts                   — add classifier branch at top of handler
                                    new endpoint OR new internal mode flag
api/_lib/intent-classifier.ts     — NEW: Haiku call helpers
src/hooks/useAIGeneration.ts      — handle 'conversation' response path
                                    (don't write screens; just append message)
src/components/ChatPanel.tsx      — already renders chat messages; should
                                    just work once handleSend supports the
                                    conversation path
```

## API design

### New request mode flag (cleanest):

```ts
POST /api/generate
{
  prompt: string,
  images?: Array<{data, mimeType}>,
  projectId: string,
  conversationHistory: ChatMessage[],
  // ... existing fields
}
```

Server side:

```ts
// Step 1: classify intent
const intent = await classifyIntent({
  prompt,
  history: conversationHistory,
  hasImages: images.length > 0,
})
// returns: 'build' | 'conversation' | 'plan_request'

if (intent === 'conversation') {
  // Haiku conversational reply
  const reply = await haikuChat({ prompt, history })
  return streamChatOnly(res, reply)
}

if (intent === 'plan_request') {
  // user is asking clarifying questions or requesting plan-mode
  // route to existing plan-mode flow
}

// intent === 'build' → existing generation pipeline
```

### Classifier prompt (rough)

```
You are an intent classifier for Mokkoi, an AI mobile app builder.

User input: "{prompt}"
Context: user has {N} reference images attached.

Classify the intent as ONE of:
- "build": User is describing an app, screen, feature, or change
  they want generated. Examples: "make a fitness app", "add a login
  screen", "change the color to blue".
- "conversation": Casual chat, greeting, question about Mokkoi's
  capabilities, expressing uncertainty, or anything that doesn't
  describe a build request. Examples: "hey", "what can you do",
  "I'm not sure what to build".
- "plan_request": User explicitly wants to plan / discuss before
  building, OR is asking clarifying questions. Examples: "let's
  plan first", "what should I build", "help me decide between X and Y".

Respond with ONLY the label, no explanation.
```

## Frontend changes

The hard part is API + classifier. Frontend is mostly already there.

`useAIGeneration.handleSend` currently always tries to generate screens. It needs to handle a new server response type: a chat-only message with no screens. The streaming response format is already a server-sent-event stream; just needs a new event type:

```ts
// New event type from server
{ type: 'conversation', text: 'Doing great! Got an app idea?' }
```

`useAIGeneration` listens, appends to messages, doesn't try to update screens.

## Plan-mode integration

When a user explicitly toggles **Plan** in the dashboard prompt card, that already routes to `?mode=plan`. Two compatible paths:

- **Plan toggle = explicit user choice** → Mokkoi always asks clarifying questions first
- **Build toggle + low clarity** → existing auto-suggest modal (Phase A)
- **Build toggle + conversational input** (this task) → Haiku replies, no generation

These don't conflict. Plan mode triggers the discuss-first flow always; conversational classifier only triggers when user is in Build mode but said something non-build.

## Verification

1. Type "hey" → submit → AI replies "Hey! What can I help you build?" — no screens generated
2. Type "what's the weather" → AI replies "I'm focused on building mobile apps. Got an idea?" — no screens
3. Type "build me a fitness app" → AI generates as before
4. Type "I want something for tracking workouts but not sure what" → AI either replies with clarifying questions, OR auto-suggests Plan mode (existing Phase A behavior)
5. Costs: classifier adds ~$0.0008 per first message. Acceptable.

## Out of scope

- Multi-turn back-and-forth conversation logic (Plan mode handles that)
- Voice input (separate roadmap item: voice-prompt.md)
- Memory/personalization across sessions

## Risks

- Misclassification: if Haiku says "conversation" when user meant "build", they get a chat reply instead of an app. Easy to fix by retyping more clearly. Low risk.
- Cost: classifier is cheap but adds up. If 1M users × first message = $800/month. Acceptable for the UX win.
- Latency: ~400ms added to first response. Acceptable.

## Related discussion

This came up in the Phase F session when the user typed "hey mokkoi how are you doing" and Mokkoi generated a chat-conversation-screen instead of having a conversation. Three implementation paths were discussed; this is **Path 2 (two-stage classifier)** which we picked over **Path 1 (system prompt only)** for reliability.
