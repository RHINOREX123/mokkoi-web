# Canvas UX Proposals — Read Tomorrow With Coffee

> Saved 2026-04-24 for review 2026-04-25.
> **Do NOT start implementing anything here tonight.** Tonight = crash fix only.
> Decision gate: after you've tested the crash fix in Expo Go and slept on it,
> compare Mokkoi vs Bolt preview with a clear head, then pick A / B / C.

---

## Problem Framing

After shipping the three prod fixes (intent-detection regex, loremflickr images,
always-render tab bar), you compared the 8-screen food delivery app in Mokkoi's
canvas against the same kind of app built in Bolt and noticed:

- **Bolt's preview** is a single centered phone running the real app. You tap
  buttons and it navigates. It looks like a finished product.
- **Mokkoi's canvas** is 8 static screen tiles in a grid with connection lines.
  It looks like wireframes / a designer's storyboard.

Your question: should Mokkoi show the app the way Bolt does instead of (or in
addition to) the 8-tile canvas?

## Honest Take

Both views serve different users:

| View | Best for | Mokkoi has? | Bolt has? |
|---|---|---|---|
| Canvas (8 tiles) | Overview, flow review, bulk edits, designer thinking | ✅ | ❌ |
| Single-phone running preview | "Does it actually work?" gut check, sharing, demo | ✅ via Expo Go (broken now — being fixed tonight) | ✅ in-browser |

Canvas is actually a **differentiator** against Bolt. Don't throw it away.
What's missing is the **in-browser** single-phone preview. Expo Go fills that
role on a real device, but it's a separate step with a QR code.

Building a true in-browser React-Native-Web preview = 2–3 weeks of work. Not
feasible before 2026-05-04. That's a post-YC project.

So the realistic question is: **how do we combine the canvas strength with a
Bolt-style "play the app" moment inside the existing Mokkoi workspace?**

---

## Three Design Options

### Option A — Expand-to-Play (minimal UX change)

Canvas stays exactly as it is today. Each tile gets a small `▶` button on
hover. Clicking `▶` (or the whole tile) expands that screen into a centered
full-size phone with working navigation. `Esc` or a close button returns to
the grid.

- **Eng cost:** ~6–8 hours
- **Lands before YC deadline:** yes, comfortably
- **Demo story:** "Here's the whole app at a glance → here's a single screen
  running live → here's me editing it with AI."
- **Risk:** Low. Reuses existing `ScreenRenderer` and `FlowConnections`.
- **Downside:** Still a mode switch — you can't see the running phone and the
  overview at the same time.

### Option B — Split View (Canvas + persistent live phone)

Canvas takes 60% of the workspace. Right 40% is a persistent Bolt-style phone
that always shows whichever screen you last clicked on the canvas. Tap buttons
on that phone and it navigates, updating the highlighted tile on the canvas
automatically.

- **Eng cost:** ~2–3 days
- **Lands before YC deadline:** tight but doable
- **Demo story:** "Here's your app running next to every screen — click any
  tile and the phone jumps. Tap any button on the phone and the canvas shows
  where you landed."
- **Risk:** Medium. Horizontal real estate gets tight on 13" laptops. Needs
  collapse/resize affordance.
- **Downside:** Canvas tiles get smaller; chat panel may need to become a
  collapsible drawer.

### Option C — Mode Toggle (Canvas / Preview / Code)

Top-right toggle: `[Canvas] [Preview] [Code]`. Canvas = current 8-tile view.
Preview = single phone running the full app (Bolt-style). Code = the generated
TSX.

- **Eng cost:** ~1–1.5 days
- **Lands before YC deadline:** yes
- **Demo story:** "Three views, one click apart — design, run, copy the code."
- **Risk:** Low.
- **Downside:** Users lose the canvas overview while in Preview. Every
  edit-and-check round means a mode switch. This is the pattern Figma and
  Framer use; familiar but not particularly innovative.

---

## Recommendation

**Ship Option A before YC. Layer Option B on top if Option A feels limiting
after user feedback.**

Reasoning:
1. Option A delivers the "the app actually runs" demo moment with 1/4 the
   engineering of B.
2. It preserves the canvas (your unique feature vs Bolt) without contesting
   it for screen real estate.
3. If Option A feels too modal after real usage, Option B becomes an additive
   enhancement — the canvas + preview components already exist; you just
   arrange them side-by-side instead of overlaid.
4. Option C feels like copying Figma and also makes the canvas a second-class
   citizen.

---

## Visual Mockups (ASCII)

### State 1 — Canvas (today's view, + new ▶ affordance per tile)

```
┌───────────────────────────────────────────────────────────────────┐
│ ☰  Build a food delivery app         [+ New] [Export] [Preview]  │
├─────────┬─────────────────────────────────────────────────────────┤
│ Chat    │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                       │
│         │  │📱 ▶│→│📱 ▶│→│📱 ▶│→│📱 ▶│                        │
│ user:   │  │Home │ │Browse│ │Menu │ │Cart │                       │
│ Build   │  └─────┘ └─────┘ └─────┘ └─────┘                       │
│ food    │                                                         │
│ app     │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                       │
│         │  │📱 ▶│ │📱 ▶│ │📱 ▶│ │📱 ▶│                        │
│ AI: 8   │  │Check│ │Track│ │Ordrs│ │Profl│                       │
│ screens │  └─────┘ └─────┘ └─────┘ └─────┘                       │
│ done.   │                                                         │
│         │  Zoom: 57%   [▶ Play full app]                          │
└─────────┴─────────────────────────────────────────────────────────┘
     ↑ each tile gets a small ▶ that launches State 2
```

### State 2 — Expanded phone (after clicking ▶ or a tile)

```
┌───────────────────────────────────────────────────────────────────┐
│ ← Back to canvas        Home  •  1 of 8                    [✕]   │
├───────────────────────────────────────────────────────────────────┤
│                                                                    │
│                    ╔══════════════════╗                            │
│                    ║ 📍 San Francisco ║                            │
│                    ║                  ║                            │
│                    ║ What would you   ║                            │
│                    ║ like to eat?     ║  ← tap text to edit       │
│                    ║                  ║                            │
│                    ║ 🔍 Search...     ║                            │
│                    ║                  ║                            │
│                    ║ ┌──────────────┐ ║                            │
│                    ║ │ LIMITED OFFER│ ║                            │
│                    ║ │ 30% off      │ ║                            │
│                    ║ │ [Order Now]──╬─╬──→ navigates to Browse    │
│                    ║ └──────────────┘ ║                            │
│                    ║                  ║                            │
│                    ║ 🏠  🛒  📍  👤  ║  ← tab bar works          │
│                    ╚══════════════════╝                            │
│                                                                    │
│    [✏️ Edit]  [◀ Prev]  [Next ▶]       Share [🔗]                │
└───────────────────────────────────────────────────────────────────┘
```

### State 3 — Inline editing (click any element in State 1 or 2)

```
┌───────────────────────────────────────────────────────────────────┐
│                                                                    │
│       ╔══════════════════╗      ┌─────────────────────────┐       │
│       ║ What would you   ║◀──── │ Edit "What would you..."│       │
│       ║ like to eat?     ║      │                          │       │
│       ║ ━━━━━━━━━━━━━━  ║      │ Text:  [What would you..]│      │
│       ║  selected        ║      │ Size:  [24 ▼]            │      │
│       ║                  ║      │ Color: [#FFFFFF ▓]       │      │
│       ║                  ║      │ Bold:  [✓]               │      │
│       ╚══════════════════╝      │ ─────────────────────    │      │
│                                 │ Or ask AI:               │       │
│                                 │ ┌──────────────────────┐ │       │
│                                 │ │ make this bigger and │ │       │
│                                 │ │ give it a gradient   │ │       │
│                                 │ └──────────────────────┘ │       │
│                                 │                [Apply]   │       │
│                                 └─────────────────────────┘       │
└───────────────────────────────────────────────────────────────────┘
```

The right panel reuses the existing AI-edit flow — it just gets scoped to the
selected element instead of the whole screen.

---

## What Option A Would Actually Cost

1. Add `▶` icon on each canvas tile (hover state) — 30 min
2. New `<PhonePreview>` component — takes `screenId`, renders full-size using
   existing `ScreenRenderer`, overlays nav controls — 2 hr
3. Click a tile / ▶ / "Preview" → opens `PhonePreview` in a modal over canvas
   — 1 hr
4. Inside the preview: tap any `TouchableOpacity` → use existing
   `FlowConnections` to navigate to the target screen, animated slide
   transition — 2 hr
5. Existing "Modify" chat scopes to the currently-viewed screen automatically
   — 30 min (wire-up)
6. Keyboard shortcuts: `Esc` closes, `←/→` prev/next screen — 30 min
7. Tests + polish — 1 hr

**Total ~6–8 hours.** Comfortable slack against the YC deadline.

---

## Decision Framing for Tomorrow

When you sit down with coffee:

1. Open Mokkoi, open Bolt, side by side.
2. Ask: "If I were a first-time user and I saw this, which one makes me
   believe an app was built for me?"
3. Then ask: "If I were editing the app, which view helps me more — the
   overview of all screens, or a single running screen?"
4. If the answer to question 2 is "overview" → **Option A** (keep canvas
   primary, add on-demand play).
5. If the answer is "both, at the same time" → **Option B** (split view).
6. If the answer is "single running screen almost always" → **Option C**
   (mode toggle).

Whatever you pick, the Expo Go preview keeps working — these canvas changes
don't affect the Snack export path.

---

## Open Questions to Resolve Tomorrow

- Do we want the expanded preview to navigate via `FlowConnections` (the
  existing wirer output), or let the user tap any button and we infer a
  target? First option is deterministic; second is magic.
- Edit panel location: right sidebar (like above) or floating popover anchored
  to the element?
- Inline text edit: should double-click enter edit mode directly, or always
  open the side panel?
- Multi-screen state: if a button says "Add to cart" and you tap it on the
  Home preview, does it visually reflect on the Cart screen too? (Probably
  not for v1 — screens are stateless snapshots.)

---

_End of proposal. No code changes. Sleep on it._
