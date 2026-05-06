# Plan Mode — Conversational Engine (Design Spec)

**Date:** 2026-05-07
**Status:** approved (user: Sahil)
**Estimated effort:** 5–6 hours focused (backend + frontend + UI polish)
**Owner:** unassigned (next session picks up)

---

## Summary

Make Plan mode a real engine. Today the Plan toggle is a UI placeholder
(commit `f7306cc`) — selecting it still routes to the build pipeline. This
spec wires Plan to a Haiku-powered conversational planner that talks
through the user's app idea, accumulates context, and emits a rich build
prompt the user can trigger when ready.

This makes Plan mode the **paid-tier differentiator** (Pro/Max only). It
also lays the foundation for a broader "conversational intent" task
(handling chat in Build mode, e.g. greetings) — but that is V2, not this
spec.

---

## Why this exists

### The current bug

Plan toggle visible on dashboard. User flips it on, types prompt, hits
submit. Engine ignores the toggle and routes to `/api/generate-flow`
exactly like Build. App is generated immediately. No planning happens.

### What users expect

A conversational planning experience similar to chatting with a thoughtful
product designer:

| User says | Plan mode should do |
|---|---|
| "I want to build a fitness app" | Reply: *"Fitness app, nice. What's the main thing users will do day-to-day?"* + 2-3 chip suggestions |
| "Track workouts" (chip) | Acknowledge + ask next gap (vibe? screens?) + new chips |
| "Actually I want it dark and minimal" (free text) | Acknowledge, integrate, ask next gap |
| "OK I think we're good" | Mokkoi: *"Great — here's the plan. Building now."* + Build button |

### Why this is the right scope

- **Self-contained shipping unit** — one PR, no dependency on other features
- **Real differentiator** — competitors (Bolt, Lovable, v0, Rocket) all have "type prompt → build". None have planning conversations.
- **Pro-tier hook** — concrete upgrade reason beyond "more credits"
- **Foundation for V2** — same Haiku endpoint can later handle Build-mode chat (greetings, etc.)

---

## Architecture overview

```
┌─────────────────────────────────────────────────────────┐
│ Dashboard (PromptCard)                                  │
│   • User types prompt                                   │
│   • Toggles Plan ON                                     │
│   • Hits submit                                         │
│      │                                                   │
│      ├─ Free user? → open PaywallModal, abort           │
│      └─ Paid user? → continue ↓                         │
└─────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│ ProjectPage opens with mode=plan                        │
│   • Project row created (state: 'planning')             │
│   • Initial prompt stored as user's first message       │
│   • Canvas shows <PlanSummaryCard /> (empty state)      │
│   • POST /api/plan-conversation → first Haiku reply     │
└─────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│ Loop in ChatPanel:                                      │
│   • User taps chip OR types freely                      │
│   • POST /api/plan-conversation with full history       │
│   • Haiku returns: { reply, chips, ready_to_build,     │
│                      summary, extracted }              │
│   • <PlanSummaryCard> updates with extracted info       │
│   • If ready_to_build: card pulses, Build button glows  │
│   • Build button always visible in chat header          │
└─────────────────────────────────────────────────────────┘
       │
       ▼ (User clicks Build)
┌─────────────────────────────────────────────────────────┐
│ Existing /api/generate-flow runs                        │
│   • Prompt = Haiku-generated `summary`                  │
│   • conversationHistory = full Plan-mode chat           │
│   • Project state flips: 'planning' → 'building'        │
│   • <PlanSummaryCard> fades out                         │
│   • Canvas populates with generated screens             │
│   • ChatPanel switches to normal post-build mode        │
└─────────────────────────────────────────────────────────┘
```

---

## API contract

### `POST /api/plan-conversation`

**Auth:** required. Free users get 402 + SSE `paywall` event (reuses existing `useAIGeneration.ts` paywall plumbing at line ~357).

**Request:**
```json
{
  "projectId": "uuid",
  "userMessage": "Track workouts",
  "conversationHistory": [
    { "role": "user", "content": "I want a fitness app" },
    { "role": "assistant", "content": "Fitness app, nice. What's the main thing users will do day-to-day?" }
  ],
  "turnCount": 1
}
```

**Response (Haiku-shaped JSON):**
```json
{
  "reply": "Workout tracking — solid focus. What's the visual mood you're going for?",
  "chips": [
    "Dark and energetic",
    "Light and minimal",
    "Bold and playful"
  ],
  "ready_to_build": false,
  "summary": null,
  "extracted": {
    "domain": "fitness",
    "primary_action": "track workouts",
    "vibe": null,
    "screens": null,
    "brand": null
  }
}
```

**Response when ready to build (~turn 4-5):**
```json
{
  "reply": "Got it — I have a clear picture now.",
  "chips": [],
  "ready_to_build": true,
  "summary": "A fitness app named FitPulse focused on workout tracking. Dark, energetic visual style with bold accents. 6 screens: Home (welcome + today's progress + quick start), Workouts (categorized library + featured), Workout Detail (instructions + equipment), Progress (weekly metrics + body), Nutrition (macros + meals), Profile (goals + achievements).",
  "extracted": {
    "domain": "fitness",
    "primary_action": "track workouts",
    "vibe": "dark, energetic, bold",
    "screens": ["Home", "Workouts", "Workout Detail", "Progress", "Nutrition", "Profile"],
    "brand": "FitPulse"
  }
}
```

**Backend logic:**
- Model: `claude-haiku-4-5-20251001`
- max_tokens: 800
- System prompt: see *Prompt design* section
- Output: JSON parsed with `JSON.parse` + zod validation; on parse error, retry once with `STRICT_JSON_SUFFIX` appended
- Cache the system prompt (`cache_control: ephemeral`) — same pattern as `api/generate.ts`
- Trim conversation history when `turnCount >= 25`: send first user message + last 15 turns + current `extracted` snapshot
- Cost per turn: ~$0.0008. 20-turn session: ~$0.016. Negligible.

---

## Frontend changes

### `src/components/dashboard/PromptCard.tsx` (~493 lines, modify)

- Plan toggle click handler: if `userPlan === 'free'` → `setPaywallOpen(true)`, return early. No state change. **No "Pro" pill on the toggle** — paywall *is* the discoverability signal.
- On submit with Plan ON (paid user):
  - Create project with `state: 'planning'` (new column on `projects` table — see Schema changes)
  - Navigate to `/app/:id?mode=plan&prompt=<encoded>`

### `src/components/ChatPanel.tsx` (~902 lines, modify)

- Detect `mode=plan` in URL OR `project.state === 'planning'` → render in **planning mode**
- New subcomponent `<ChipRow chips={[...]} onTap={fn} />`:
  - Renders 2-3 buttons under each Mokkoi message that has chips
  - Tap = sends chip text as user message via `sendPlanMessage()`
  - Chips disappear after that turn (don't accumulate)
  - Visual: rounded pill buttons, subtle hover, tap-and-fade animation
- New "Build my app" button persistent in chat header:
  - Always visible during planning
  - Disabled until at least one user message exists
  - On click: triggers existing `handleApp()` with the latest `summary` as prompt
- When `ready_to_build: true` arrives from API:
  - Render summary as a **special "plan summary" message bubble** (distinct styling — gradient border, slightly larger)
  - Show a featured **Build button below the summary** (different from header button — bigger, glowing)
  - The `<PlanSummaryCard>` on canvas pulses to draw attention
- Free text input always works — chips are *suggestions*, not constraints

### `src/components/canvas/PlanSummaryCard.tsx` (NEW)

The premium UX moment. Lives in the canvas area during `state: 'planning'`.

```
┌─────────────────────────────────────┐
│  📋 Plan in progress                │
│                                      │
│  Domain          Fitness     ✓      │
│  Main action     Track workouts ✓   │
│  Visual vibe     Dark, energetic ✓  │
│  Screens         Home, Workouts,    │
│                  Workout Detail,    │
│                  Progress, Profile  │
│                  (5 screens) ✓      │
│  Brand           FitPulse           │
│                                      │
│  ●●●●○ 4 of 5 categories captured   │
└─────────────────────────────────────┘
```

**Behavior:**
- Reads `extracted` from the latest API response (held in `planContext` state)
- Each category row animates in (slide + fade) when first populated
- Empty categories show grey "—" placeholder
- Progress dots fill in as categories are captured
- When `ready_to_build: true`: card border pulses (CSS animation, 2s), bottom shows "Ready to build"
- When user clicks Build: card fades out, canvas populates with generated screens

### `src/hooks/useAIGeneration.ts` (~700+ lines, modify)

- New function `sendPlanMessage(projectId, userMessage)`:
  - POST `/api/plan-conversation` with full history
  - Append user message + Haiku reply to project messages
  - Update `planContext` state with `extracted` and `summary`
  - Handle paywall event if it fires (existing handler)
- Modify `handleApp()`:
  - If called from Plan mode (detected via `mode` arg or `planContext.summary` present):
    - Use `planContext.summary` as the prompt (not the original user prompt)
    - Pass full plan-mode `conversationHistory` through
- New state: `planContext: { extracted, summary, ready_to_build }` synced from API responses

### `src/pages/Dashboard.tsx` (modify)

- When user submits with Plan toggle ON:
  - Create project with `state: 'planning'`
  - Navigate with `?mode=plan&prompt=<encoded>`
  - Project page reads URL → ChatPanel enters planning mode → fires first `/api/plan-conversation` call

---

## Schema changes

### `projects` table — add column

```sql
ALTER TABLE projects ADD COLUMN state TEXT DEFAULT 'built'
  CHECK (state IN ('planning', 'building', 'built'));
```

- `'built'` = default, all existing projects (no migration of existing rows needed since DEFAULT applies)
- `'planning'` = Plan-mode active, no screens yet
- `'building'` = post-Build click, generation in progress (transient, ~30s)

### `project_messages` — already exists

The plan-mode conversation reuses the existing message storage. No new schema needed. Mokkoi messages with `chips` and `extracted` fields are stored as JSON in the `metadata` column (assuming it exists; verify during implementation).

---

## Prompt design (Haiku system prompt)

```
You are Mokkoi's planning assistant. The user wants help thinking
through their mobile app idea before generating it.

Your job: have a focused conversation to extract enough info that
Mokkoi can build a great multi-screen app.

INFO YOU MUST GATHER (categories, not literal questions):
  - DOMAIN: what kind of app (fitness, finance, social, productivity, etc.)
  - PRIMARY_ACTION: what users will do day-to-day in the app
  - VIBE: visual mood — dark/light, minimal/dense, calm/energetic
  - SCREENS: rough list of ~5-6 screens
  - BRAND (optional): name, color preferences, references

EACH TURN YOU MUST:
1. Reply conversationally to the user's last message in 1-2 sentences.
   Warm but concise. Match the tone of a thoughtful product designer
   talking with a founder. Avoid corporate fluff.
2. Ask ONE clear question to fill the most-important still-missing
   category. If the user already mentioned info for a category, do
   NOT ask about it again.
3. Propose 2-3 short answer chips (3-5 words each) representing
   common answers. The user can also type freely — chips are
   suggestions.
4. Track what you've extracted in the `extracted` field.
5. Decide if you have enough info to build. You DO when at least
   DOMAIN + PRIMARY_ACTION + VIBE + SCREENS are filled. BRAND is
   optional.

WHEN READY:
- Set ready_to_build: true
- Emit a `summary` field — a 2-3 sentence build prompt that captures
  domain, primary action, vibe, and screen list. This summary will be
  used as the actual prompt fed to the build pipeline.

ADAPTATION RULES:
- If user is vague, ask narrower questions
- If user is specific, ask broader (next category)
- If user asks YOU a question instead of answering, answer it
  briefly then re-ask your question
- If conversation goes 20+ turns and ready_to_build is true, gently
  nudge: "Ready to build whenever you are — you can always refine
  after"

OUTPUT FORMAT:
Return ONLY a JSON object — no markdown, no preamble.
Schema:
{
  "reply": string,
  "chips": [string, string, string?],
  "ready_to_build": boolean,
  "summary": string | null,
  "extracted": {
    "domain": string | null,
    "primary_action": string | null,
    "vibe": string | null,
    "screens": string[] | null,
    "brand": string | null
  }
}

EXAMPLE TURN (turn 1):
User: "I want to build a fitness app"
You: {
  "reply": "Fitness app, nice. What's the main thing users will do day-to-day?",
  "chips": ["Track workouts", "Count calories", "Mix of both"],
  "ready_to_build": false,
  "summary": null,
  "extracted": {
    "domain": "fitness",
    "primary_action": null,
    "vibe": null,
    "screens": null,
    "brand": null
  }
}

EXAMPLE TURN (final, turn 4):
User: "Yeah dark theme, energetic"
You: {
  "reply": "Got it — I have a clear picture now.",
  "chips": [],
  "ready_to_build": true,
  "summary": "A fitness app focused on workout tracking. Dark, energetic visual style. 5 screens: Home (today's progress + quick start), Workouts (library), Workout Detail, Progress (metrics), Profile.",
  "extracted": {
    "domain": "fitness",
    "primary_action": "track workouts",
    "vibe": "dark, energetic",
    "screens": ["Home", "Workouts", "Workout Detail", "Progress", "Profile"],
    "brand": null
  }
}
```

---

## Edge cases

| Case | Behavior |
|---|---|
| Free user clicks Plan toggle | PaywallModal opens immediately, no state change |
| Free user navigates direct to `?mode=plan` URL | Backend rejects (402 + paywall event); frontend redirects to dashboard with paywall modal |
| User refreshes mid-planning | `project.state === 'planning'` + messages restored from DB; ChatPanel resumes |
| User abandons (closes tab) | Project lingers in dashboard with "Planning..." badge; tap to resume |
| User clicks Build before `ready_to_build` fires | Use full conversation as build prompt instead of summary |
| Haiku JSON parse fails | Retry once with `STRICT_JSON_SUFFIX` appended to system prompt |
| User taps chip while previous reply still streaming | Chip disabled until reply lands |
| User has 20+ turns | Haiku keeps replying; conversation trimmed at 25+ (first turn + last 15) |
| `ready_to_build` already emitted, user keeps chatting | Haiku continues; refines `summary` each turn; Build button stays |
| Plan toggle on existing built project | Plan toggle hidden once `project.state === 'built'`; V1 doesn't support replan |
| Plan-mode project with no messages (created but never replied) | Resume by calling `/api/plan-conversation` with empty history; Haiku asks the first question |

---

## Out of scope for V1 (V2 candidates)

- **Build-mode conversational intent** — handling greetings ("hey mokkoi") and meta questions ("what can you do?") in Build mode. V2.
- **Voice input in Plan mode** — separate Whisper task tomorrow.
- **Re-planning an already-built project** — V1 hides Plan toggle once project is built.
- **Plan templates / reusable plans** — V2.
- **Multi-language Plan mode** — V1 is English-only.
- **Image references in Plan mode** — Plan is text-only V1. User can attach images during Build (existing flow).
- **Editing the summary before Build** — V1 trusts Haiku's summary. V2 may add an "Edit plan" affordance.

---

## Verification plan

After implementation:

1. `npx tsc -b` clean
2. `npm run build` clean
3. Smoke tests on Vercel preview:
   - **Free user**: dashboard → tap Plan toggle → expect PaywallModal opens, toggle stays off
   - **Paid user, full happy path**: dashboard → Plan ON → type "I want a fitness app" → submit → project page opens → chat shows Mokkoi's first question + 3 chips → tap a chip → reply + new chips → 4-5 turns → `ready_to_build` fires → click featured Build button → screens generate
   - **Paid user, free chat**: same as above but ignore chips, type freely → Mokkoi adapts
   - **Paid user, skip ahead**: 1 turn in, click header Build button → generates with thin context (acceptable, expected behavior)
   - **Long conversation**: 25+ turns → Haiku still responds correctly, history trimmed properly
   - **Refresh mid-plan**: refresh browser → conversation resumes
   - **Cost telemetry**: log Haiku calls per session → confirm <$0.02 per session
4. Cost guardrails verified: 20-turn session at ~$0.016. Acceptable.

---

## File-by-file change list

| File | Change | Lines (est.) |
|---|---|---|
| `api/plan-conversation.ts` | NEW endpoint | ~150 |
| `api/_lib/plan-prompt.ts` | NEW system prompt + extraction logic | ~80 |
| `src/components/dashboard/PromptCard.tsx` | Plan-toggle gating + submit branch | ~30 |
| `src/components/ChatPanel.tsx` | Plan-mode rendering, ChipRow, Build button | ~150 |
| `src/components/ChipRow.tsx` | NEW subcomponent | ~40 |
| `src/components/canvas/PlanSummaryCard.tsx` | NEW component | ~120 |
| `src/hooks/useAIGeneration.ts` | `sendPlanMessage`, `planContext`, modify `handleApp` | ~80 |
| `src/pages/Dashboard.tsx` | Plan-mode submit branch | ~20 |
| `supabase/migrations/<timestamp>_add_project_state.sql` | NEW migration | ~10 |
| `docs/roadmap/conversational-intent.md` | Update status — partially shipped | ~5 |
| Total | | ~685 lines |

---

## Open questions for implementation

(Things that came up during design but can be decided at code-time without reopening the design.)

1. Existing `project_messages.metadata` column type — JSONB? Verify before storing chips/extracted there.
2. Naming: "Plan mode" vs "Brainstorm mode" vs "Discuss mode" — current design uses "Plan" matching `f7306cc` placeholder. Keep.
3. Animation library for `PlanSummaryCard` — Framer Motion already in deps? Use that. Else CSS transitions.
4. Telemetry events: `plan_started`, `plan_chip_tapped`, `plan_built`, `plan_abandoned` — define exact payloads at impl time.

---

## Approval

- [x] Architecture approved (user)
- [x] Free-user gating (block on tap, no Pro pill) approved (user)
- [x] Build button: always visible + featured at ready (user)
- [x] Dynamic Haiku planner (user picked over fixed library)
- [x] Long conversations supported (no cap, trim at 25+) (user)
- [x] UI option B: live PlanSummaryCard (user)
- [ ] Final spec review (next step — spec-document-reviewer or skip-to-impl)
