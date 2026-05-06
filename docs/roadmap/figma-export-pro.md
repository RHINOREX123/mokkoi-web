# Figma export — Pro tier feature

**Status:** `idea`
**Estimated effort:** 2–4 weeks (export pipeline + Figma API integration + Pro gating)
**Priority:** Low (Pro tier feature; ship after we have paying users)
**Owner:** unassigned

## Goal

Paid users (Pro tier) can export any Mokkoi project to Figma — the screens become editable Figma frames. Designers continue refining in Figma, then re-import (manual or sync) back to Mokkoi.

## Why

- **Differentiator:** No competitor does this. Bolt, Lovable, v0, Rocket — all one-way (build, can't roundtrip with designers).
- **Designer workflow:** Designers live in Figma. Roundtrip with their tool unlocks teams.
- **Pro tier hook:** Tangible feature for the upgrade pitch (better than "more tokens").
- **Press value:** "First AI app builder with Figma export" is a real headline.

## Why Pro tier (not free)

- Engineering investment is significant; needs revenue justification
- Designers / teams = the segment most likely to pay
- Free users already have plenty (build, screenshot, import HTML); this is a power feature

## Feasibility

Figma REST API IS publicly available — no special partnership needed. The hard part is fidelity: translating React Native component trees to Figma frames with high quality is non-trivial.

Approaches:

### A) Plugin-based (run inside Figma)

User installs a Mokkoi Figma plugin. From Mokkoi: "Export to Figma" → generates a payload → user opens plugin in Figma → plugin reads payload → creates frames.

- 🟢 More control over Figma rendering
- 🟢 Can use Figma's full API surface from inside
- 🔴 Friction: user must install plugin
- 🔴 Two tools to maintain (Mokkoi + plugin)

### B) Direct REST API (simpler UX)

Mokkoi server-side: convert project tree → Figma file format → POST to Figma API → user gets a URL to the new Figma file.

- 🟢 Zero install — user clicks Export, gets a Figma link
- 🔴 Limited write API in Figma's REST (mostly read-only for files; POST endpoints exist but constrained)
- 🔴 May need to construct .fig file format directly (complex)

### C) Hybrid (recommended for v1)

- Server generates a .fig file (or simplified JSON)
- User uploads it to Figma manually (drag-drop into a new file)
- One extra step but no API limits, no plugin install

## Quality bar

Export is only worth shipping if:
- Layout positions are accurate (within ~5px)
- Colors match (1:1)
- Text styles preserved
- Auto-layout / constraints survive the trip
- Component hierarchy is meaningful (not flat)

If we can't hit these, the feature damages trust ("Mokkoi exported a mess"). Better to delay than ship broken.

## Pro gating

```ts
// In the export menu of /app/:id
{plan === 'pro' ? (
  <button onClick={handleExportFigma}>Export to Figma</button>
) : (
  <button onClick={() => setShowPaywall(true)}>
    Export to Figma <Badge>Pro</Badge>
  </button>
)}
```

Free users see the button but get the paywall modal. Hooks them into upgrade flow.

## Files to touch (rough)

```
src/components/CodeExportModal.tsx       — add Figma tab
src/lib/figma-export.ts                  — NEW: tree → Figma format
api/export-figma.ts                      — NEW: optional REST endpoint
src/components/PaywallModal.tsx          — already exists, add Figma row
docs/MOKKOI_PRO_FEATURES.md              — list Figma export
```

## Out of scope (intentional)

- Figma → Mokkoi sync (one-way export only for v1)
- Real-time collab (Mokkoi project updates → Figma file updates live)
- Figma plugin (Path A) — too much surface area for v1
- Other design tools (Sketch, XD, Penpot) — Figma only

## Dependencies

- Mature project lifecycle (users with real apps to export)
- Pro tier billing infrastructure (already in place via Stripe)
- Marketing — "Now with Figma export!" needs a real launch push
- High output quality — see "Quality bar" above

## Recommended timing

**Post-YC, post initial-paid-users.** This is a retention / upsell feature, not an acquisition feature. Build when:
- You have ≥100 paying users
- They're actively asking for designer collab
- You can spare 3-4 weeks of focused engineering

Until then: park it. Maybe add a "Coming Soon — Pro" placeholder in the Export menu to validate demand.
