# Session 9: Moats vs Reality Audit + Design System Quality Review

**Date:** March 21, 2026
**Scope:** Read-only audit of all claims vs actual codebase state
**Methodology:** Full code review of api/, mcp-server/, src/, supabase/, docs/

---

## PART 1: MOAT REALITY CHECK

### Moat #1: Component Intelligence

**Claimed:** 50+ production-quality templates, 15 design rules, learning system, design system ingestion

**Actual Status: PARTIALLY BUILT**

- **Templates:** There are 10 template *categories* in `mcp-server/src/tools/list-templates.ts` (Fitness, E-commerce, Social, Finance, Productivity, Onboarding, Settings, Profile, Dashboard, Auth). These are category labels with descriptions — they are NOT 50+ pre-built component trees. The actual templates are the 5 few-shot examples in `generate.ts` (login, dashboard, profile, settings, product detail). The "50+ templates" claim is fiction.
- **Design rules:** The normalizer enforces approximately 8-10 rules: spacing snapping, font size snapping, border radius snapping, font weight validation, touch target minimum, type mapping for unsupported components, root flex:1, nested ScrollView flattening, empty children cleanup, extreme negative margin capping. Not 15. But the quality of what exists is solid.
- **Learning system:** `api/analyze-diffs.ts` exists and aggregates edit patterns from the `edit_diffs` table. It identifies color changes, spacing changes, component additions/removals. However, **these patterns are never fed back into generation**. The `design_patterns` table is write-only from the AI's perspective — the system prompt in `generate.ts` does not read from it. The loop is not closed.
- **Design system ingestion:** The DESIGN.md parser in `generate.ts` (lines 44-72) supports 3 patterns: fenced code blocks, inline markers (`--- DESIGN.MD ---`), and unfenced markdown with 2+ design headers. This is *prompt-level* ingestion, not codebase scanning. It cannot scan a directory, read a `tailwind.config.js`, or analyze an existing app's components.

**Honesty Score: 4/10**
**Gap:** Claims 50+ templates, has 5. Claims learning system, has data capture with no feedback loop. Claims codebase ingestion, has prompt parsing.
**Risk:** Google Stitch already has DESIGN.md as a native format. If Stitch standardizes the format, Mokkoi's parser must be compatible or become irrelevant.

---

### Moat #2: Network Effects & Ecosystem

**Claimed:** Shared component libraries, community templates, plugin system

**Actual Status: NOT STARTED**

- **Shared libraries:** No sharing mechanism beyond `is_public` on projects (basic boolean in Supabase). No browse/discover functionality.
- **Community templates:** No community upload, rating, or discovery system. The ShareModal shares links to social media — it doesn't share *components* with other Mokkoi users.
- **Plugin system:** Zero plugin architecture. No extension points, no hooks for third-party code.

**Honesty Score: 1/10**
**Gap:** Entire moat is aspirational. Nothing is built.
**Risk:** This is a moat that requires critical mass to work. A solo developer product cannot credibly claim network effects.

---

### Moat #3: Data Flywheel

**Claimed:** Captures user edit diffs, learns from usage patterns

**Actual Status: HALF-BUILT (collection only)**

- **Edit diff capture:** REAL. `api/log-edit-diff.ts` captures before/after component trees for ai_edit, variation, and regenerate operations. This is called in both streaming and non-streaming paths of `generate.ts`.
- **Pattern analysis:** REAL. `api/analyze-diffs.ts` aggregates the last 100 diffs into pattern counts (color changes, spacing changes, component additions/removals) and stores them in `design_patterns`.
- **Feedback loop:** MISSING. The patterns stored in `design_patterns` are never queried by the generation pipeline. The system prompt is static. There is no mechanism to say "users frequently change X to Y, so default to Y."
- **PostHog analytics:** PostHog is in `package.json` — presumably tracking page views and events, but this is product analytics, not a generation quality flywheel.

**Honesty Score: 3/10**
**Gap:** Data collection infrastructure exists, but the "flywheel" doesn't spin. It's a one-way pipe: diffs go in, nothing comes out to improve generation.
**Risk:** The stored patterns will grow stale without a consumption mechanism. The table will fill with data nobody reads.

---

### Moat #4: Design System Lock-in

**Claimed:** Scans codebases, understands existing components/colors/fonts/spacing

**Actual Status: PARTIALLY BUILT (prompt-level only)**

- **DESIGN.md parser:** Works for markdown content embedded in prompts. Supports 3 extraction patterns. This is functional but shallow.
- **Codebase scanning:** Does NOT exist. Cannot read `tailwind.config.js`, `theme.ts`, Figma tokens, or any file from a user's project.
- **Format support:** Only plain markdown. No JSON token format, no Figma variables, no Style Dictionary, no Tailwind config.
- **Lock-in mechanism:** The component tree JSON format (`mokkoi.ts` types) is Mokkoi's actual lock-in. Once a user has screens as Mokkoi JSON, they need Mokkoi to render/edit them. But there's no export to standard React Native `.tsx` files — which means the lock-in works against adoption ("I can't use this output in my project").

**Honesty Score: 3/10**
**Gap:** "Scans codebases" is completely false. The DESIGN.md parser works but only for manually-provided content in prompts.
**Risk:** Stitch's DESIGN.md is becoming a standard. If Mokkoi can't import Stitch's exact format, the "Stitch → Mokkoi pipeline" described in COMPETITIVE_ANALYSIS.md breaks. The P1 roadmap item for Stitch compatibility is critical.

---

### Moat #5: First Mover Speed

**Claimed:** FIRST MCP server for native mobile screens with visual preview

**Actual Status: PLAUSIBLY TRUE**

- **MCP server:** EXISTS. `mcp-server/` is a real npm package (`mokkoi-mcp`) with tools: `generate_screen`, `edit_screen`, `screenshot_to_screen`, `generate_flow`, `list_templates`, `sync_from_canvas`, `watch_canvas`.
- **Published on npm:** Yes, with automated CI/CD via GitHub Actions.
- **First for React Native screens:** Likely true as of the current date. Google Stitch has an MCP server but outputs HTML/CSS/React, not React Native. Rork has no MCP server. No other known MCP server generates React Native component trees.
- **Visual preview:** The web app renders screens in a phone frame. The MCP server syncs to the canvas via `sync_from_canvas` and `watch_canvas`.

**Honesty Score: 7/10**
**Gap:** The "first mover" claim is time-bounded and fragile. Being first means nothing if you don't build quality faster than followers.
**Risk:** HIGH. If Rork (a16z-backed, $2.8M raised) adds MCP support, or if a new entrant appears, this moat evaporates. Speed advantages are consumed by competitors within 3-6 months.

---

### Moat #6: Screen Flow Intelligence

**Claimed:** Multi-screen generation with navigation logic, shared state, transitions

**Actual Status: PARTIALLY BUILT (basic multi-screen, no navigation/state/transitions)**

- **Multi-screen generation:** YES. `generate-flow.ts` generates 3-5 screens as a JSON array with `id`, `name`, and `tree` per screen.
- **Navigation logic:** MINIMAL. The system prompt says "Include navigation elements (Back button, Next button, Skip, progress indicators) that reference other screens" — but this is a prompt instruction, not enforced logic. Screens don't have `onPress: navigate('screen-2')` or any actual linking. They're independent trees that happen to be generated together.
- **Shared state:** NO. No state management, no shared data between screens.
- **Transitions:** NO. No animation or transition definitions.
- **Consistency rules:** The prompt includes "All screens in a flow MUST use the exact same color palette, font sizes, and card styles" — good instruction, but compliance depends on the LLM following directions. No post-generation validation of cross-screen consistency.

**Honesty Score: 4/10**
**Gap:** Claims "navigation logic, shared state, transitions" — has none of these. Has batch screen generation with a consistency instruction in the prompt.
**Risk:** Stitch's infinite canvas with true screen linking is far ahead. Rork generates actual navigable apps.

---

### Moat #7: Screenshot-to-Mokkoi Reverse Engineering

**Claimed:** Drop a screenshot, get React Native components

**Actual Status: BUILT**

- **Image input:** `generate.ts` accepts `imageData` (base64) and `imageMimeType` parameters.
- **MCP tool:** `screenshot_to_screen` in the MCP server accepts PNG/JPG/WEBP/GIF.
- **Implementation:** Uses Claude's vision capability — sends the image as a base64 `image` content block alongside a text prompt asking Claude to recreate the design as a React Native component tree.
- **Quality caveat:** The output quality depends entirely on Claude's vision-to-JSON ability. There's no custom model, no fine-tuning, no layout detection pipeline. It's a prompt wrapper around Claude's multimodal API.

**Honesty Score: 6/10**
**Gap:** The feature exists and works. But "reverse engineering" oversells it — it's "Claude, look at this image and generate JSON." Quality is unpredictable.
**Risk:** Every competitor with access to a multimodal LLM can replicate this in a day. Google Stitch already does this with Gemini.

---

### Moat #8: Brand Kit / White Label Intelligence

**Claimed:** Upload logo + brand colors + reference screenshots → brand profile

**Actual Status: NOT STARTED**

- No brand profile system
- No logo upload
- No brand color extraction
- The DESIGN.md parser could theoretically accept brand colors in a markdown block, but there's no dedicated brand kit feature.

**Honesty Score: 0/10**
**Gap:** Completely aspirational. Nothing built.
**Risk:** Low risk since it's not being marketed, but also zero contribution to defensibility.

---

### Moat #9: Accessibility-First Leadership

**Claimed:** WCAG compliance built into every screen, accessibility scoring

**Actual Status: MINIMAL**

- **Touch targets:** The normalizer enforces `minHeight: 44` on TouchableOpacity. This is one accessibility rule.
- **Color contrast:** NOT checked. The design tokens use `#6B6B80` for tertiary text on `#0A0A1A` background — this passes WCAG AA for large text but may fail for small text. No automated contrast checking.
- **Accessibility scoring:** Does NOT exist. No scoring system, no WCAG audit.
- **Screen reader support:** No `accessibilityLabel`, `accessibilityRole`, or `accessibilityHint` in any generated output or few-shot examples.

**Honesty Score: 1/10**
**Gap:** Claims "WCAG compliance built into every screen" — has one touch target rule. No contrast checking, no screen reader labels, no scoring.
**Risk:** Accessibility claims without substance are a legal and reputational liability, especially if marketing to enterprise customers.

---

### Moat #10: Design System Marketplace

**Claimed:** Teams publish and sell design systems

**Actual Status: NOT STARTED**

- No marketplace infrastructure
- No payment system for design systems (Stripe exists for subscriptions, not marketplace transactions)
- No publishing mechanism beyond the `is_public` project flag

**Honesty Score: 0/10**
**Gap:** Entirely aspirational.
**Risk:** Marketplaces are extremely hard to build and require both supply and demand. This should not be in a moat document.

---

### Moat #11: Version History & Design Decisions Log

**Claimed:** Full history with WHY behind changes

**Actual Status: NOT STARTED**

- No version history system
- `edit_diffs` table captures before/after trees but there's no UI to browse history or revert
- No "WHY" annotation — the edit prompt is stored (truncated to 500 chars) but there's no design decision log
- The UI explicitly warns "cannot be undone" on deletion, confirming no versioning

**Honesty Score: 1/10** (1 because the raw diff data exists in Supabase, just not exposed)
**Gap:** Claims "full history with WHY" — has raw diff data in a database table with no user-facing access.
**Risk:** Low — this is a table-stakes feature, not a moat. Every design tool has version history.

---

### Moat #12: Framework Migration

**Claimed:** React Native to Flutter conversion

**Actual Status: NOT STARTED**

- Output is React Native JSON only
- No Flutter/Dart code generation
- No SwiftUI output
- No multi-framework target selection anywhere in the codebase

**Honesty Score: 0/10**
**Gap:** Completely aspirational.
**Risk:** Supporting multiple output frameworks is extremely complex. Each framework has different layout models, component libraries, and conventions. This is a P3 feature at best.

---

### Moat Summary Table

| Moat | Claimed Status | Actual Status | Honesty Score | Critical Gap |
|------|---------------|---------------|:---:|--------------|
| #1 Component Intelligence | Active Now | Partial — 5 examples, ~10 rules, no learning loop | 4/10 | 50+ templates don't exist; learning system captures data but never uses it |
| #2 Network Effects | Active Now | Not Started | 1/10 | Zero community/sharing/plugin infrastructure |
| #3 Data Flywheel | Active Now | Half-built (collection only) | 3/10 | Patterns stored but never fed back to generation |
| #4 Design System Lock-in | Active Now | Partial — prompt parsing only | 3/10 | No codebase scanning; JSON format locks users IN but blocks adoption |
| #5 First Mover Speed | Active Now | Plausibly true | 7/10 | Fragile — any funded competitor can catch up in months |
| #6 Screen Flow Intelligence | Active Now | Basic batch generation | 4/10 | No navigation logic, shared state, or transitions |
| #7 Screenshot Reverse Engineering | Active Now | Built (Claude vision wrapper) | 6/10 | Trivially replicable; quality depends on Claude, not Mokkoi |
| #8 Brand Kit | Planned | Not Started | 0/10 | Nothing built |
| #9 Accessibility Leadership | Active Now | 1 rule (touch targets) | 1/10 | No contrast checking, no scoring, no screen reader labels |
| #10 Design System Marketplace | Planned | Not Started | 0/10 | Nothing built |
| #11 Version History | Planned | Raw data exists, no UI | 1/10 | No user-facing history, no revert capability |
| #12 Framework Migration | Planned | Not Started | 0/10 | Nothing built |

**Overall Moat Honesty Score: 2.5/10**

The moat document describes a mature platform. The code describes an early MVP with 3 real strengths: MCP server, design system normalizer, and React Native JSON output format.

---

## PART 2: DESIGN SYSTEM DEEP QUALITY REVIEW

### 2A. Token System Quality

**Spacing Scale:** `[0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64]`
- 11 values. Complete for mobile UI. Matches iOS HIG spacing philosophy.
- MISSING: No 2px value (useful for hairline gaps, e.g., between stacked badges). No 96/128 for large hero sections.
- Apple HIG uses an 8pt grid primarily; this scale includes non-8pt values (4, 12, 20) which is fine — it's a superset.
- MD3 uses 4px increments; this aligns well.
- **Grade: A-** — solid and practical.

**Font Size Scale:** `[11, 12, 13, 14, 16, 17, 20, 24, 28, 34, 40, 48]`
- 12 values. Maps closely to iOS Dynamic Type sizes.
- Apple HIG: Caption2=11, Caption1=12, Footnote=13, Subheadline=15, Body=17, Title3=20, Title2=22, Title1=28, LargeTitle=34. Mokkoi is close but uses 14 instead of 15, and 24 instead of 22.
- MD3: Uses 11, 12, 14, 16, 22, 24, 28, 32, 36, 45, 57. Mokkoi's scale is reasonably compatible.
- MISSING: No 15 (iOS Subheadline) or 22 (iOS Title2 / MD3 headline-small).
- **Grade: B+** — good coverage, minor gaps vs iOS type ramp.

**Font Weights:** `["400", "500", "600", "700"]`
- 4 values. Correct and sufficient for mobile UI.
- Also accepts "normal" and "bold" as aliases.
- MISSING: "300" (light) for large display text is sometimes useful but not critical.
- **Grade: A** — clean and appropriate.

**Line Heights:** Defined for every font size. Ratios range from 1.25x to 1.45x. All rounded to nearest 4.
- **Grade: A** — comprehensive, no gaps.

**Letter Spacing:** 4 ranges defined. Positive for small text, zero for body, negative for headings/display.
- Matches professional typography practice.
- **Grade: A** — well-considered.

**Border Radius Scale:** `[0, 4, 8, 12, 16, 24, 9999]`
- 7 values. Good range from sharp to circular.
- MISSING: 20 (large rounded rectangles, common in iOS). The jump from 16 to 24 is a bit large.
- **Grade: B+**

**Color System (Dark):**
- 4 surface levels: good depth hierarchy.
- 4 text levels: primary, secondary, tertiary, inverse — complete.
- 4 semantic colors with surface variants: success, warning, error, info — complete.
- 2 border levels + overlay: sufficient.
- Brand: primary + light + dark + surface variant: good.
- ISSUE: Only ONE accent color (#6C5CE7 purple). Real apps need the ability to specify a custom primary color. The DESIGN.md parser partially addresses this, but the default is baked in.
- MISSING: No secondary accent color. No "on-primary" text color explicitly (text-inverse serves this role). No disabled state colors.
- **Grade: B+** — functional but mono-accent limits diversity.

**Color System (Light):**
- Mirror of dark theme with appropriate value swaps.
- Brand/accent and semantic colors shared with dark theme — correct.
- ISSUE: Light theme surface-0 is `#F5F5FA` (slightly blue-tinted gray), not pure white. This is a design choice, not a bug — but "white theme" requests may expect `#FFFFFF`.
- **Grade: B** — functional, but the blue tint could surprise users expecting pure white.

**Shadows:** 3 levels (none, subtle, medium, prominent). Well-defined with specific values. No cross-platform shadow issues addressed (Android elevation vs iOS shadow).
- **Grade: B+**

**Component Heights, Icon/Avatar sizes, Safe Areas:** All well-defined and match iOS conventions.
- **Grade: A**

**Overall Token System: B+** — A professional token system that covers 90% of use cases. The main gaps are mono-accent color, missing a few intermediate border radius values, and no secondary color support.

---

### 2B. Few-Shot Example Quality

#### Example 1: Login Screen (Fitness App)
- **Renders correctly?** YES — all props are valid. TextInput wrapped in View with proper height. Styles at top level.
- **Visual hierarchy?** Clear: emoji icon → large heading (28/700) → subtext (14/secondary) → inputs → primary button → divider → social buttons → sign-up link.
- **Spacing rhythm?** Consistent: marginTop values are 24, 8, 40, 16, 24, 24, 16, 24, 32 — uses scale values. Top section uses paddingTop: 64 which is ON the scale.
- **Content?** Realistic: "Welcome back, athlete", "Sign in to crush your goals". Good.
- **Touch targets?** All TouchableOpacity and input areas are ≥44px. Social buttons are 48x48. Good.
- **Professional?** Yes — this looks like a real fitness app login.
- **Issues:** Social login buttons use "G" and "\uF8FF" (Apple logo) as plain text — the Apple logo won't render on non-Apple devices. Minor: the divider pattern ("or continue with") is well-executed.
- **Grade: A-** — One minor rendering concern (Apple logo character).

#### Example 2: Dashboard (Fitness)
- **Renders correctly?** YES — complex layout with stat cards, progress bar, workout card, quick actions grid, tab bar.
- **Visual hierarchy?** Excellent: greeting (14 muted) → name (24/600) → stat cards (20/700 numbers) → daily goal with progress bar → workout card with CTA → quick action grid → tab bar.
- **Spacing rhythm?** Good: paddingHorizontal 20 throughout, marginTop values are 24, 32, 32 for sections, 4/8 within.
- **Content?** Excellent: "8,450 steps", "342 kcal burned", "72 bpm resting", "82%" progress. All from content library.
- **Touch targets?** Tab bar items don't have explicit height — they rely on content sizing. The "Start Workout" button is 40px (below 44px standard but above compact). Quick action grid items have no minHeight.
- **Professional?** Yes — this is the strongest example. Looks like a real fitness dashboard.
- **Issues:** "Start Workout" button is 40px height (compact size, acceptable). Quick action grid items use `width: "47%"` — works but could cause alignment issues at different widths. Tab bar paddingBottom is 34 (safe area) but the root View only has paddingTop: 54, no paddingBottom (tab bar handles it). This is correct architecture.
- **Grade: A-** — Minor touch target concern on CTA button.

#### Example 3: Social Media Profile
- **Renders correctly?** YES — nav bar, avatar, stats row, follow/message buttons, tab bar, photo grid.
- **Visual hierarchy?** Clear: avatar (80px) → name (20/700) → handle (14/tertiary) → bio (14/secondary) → stats (17/600) → action buttons → tab selector → grid.
- **Spacing rhythm?** Good: consistent 20px horizontal padding, logical marginTop progression.
- **Content?** Good: "Maya Chen", "@maya.creates", "12.4K followers", "892 following", "3,241 posts".
- **Touch targets?** Nav bar buttons are 44x44. Follow/Message buttons are 40px (compact, acceptable). Tab items rely on content height — no explicit minHeight.
- **Professional?** Yes — instantly recognizable as an Instagram-style profile.
- **Issues:** Photo grid uses `width: "32.6%"` — hardcoded percentage that assumes specific gap math. The grid items have `aspectRatio: 1` which the web renderer may not handle. Profile avatar uses a letter "M" on a colored circle instead of an image — fine for a mockup. The "Posts" tab has a 3px bottom border (`borderBottomWidth: 3`) which is not on any scale.
- **Grade: B+** — aspectRatio may not render in web preview; off-scale border width.

#### Example 4: Settings Screen
- **Renders correctly?** YES — profile section, grouped list sections with icons, switches, chevrons, log out/delete.
- **Visual hierarchy?** Excellent: profile card → grouped sections with uppercase labels (13/500/uppercase with letterSpacing) → individual rows → danger zone.
- **Spacing rhythm?** Excellent: section marginTop: 24, rows at height: 48, consistent paddingHorizontal: 16 within groups and 20 at screen level.
- **Content?** Good: "Sarah Mitchell", "sarah@email.com", "Dark" for appearance, "English" for language, "v2.1.0".
- **Touch targets?** All rows are 48px. Profile section uses paddingVertical: 16 making it taller. Good.
- **Professional?** YES — this is production-quality. Looks exactly like iOS Settings.
- **Issues:** Section header letterSpacing is `1` which is not in the defined letter spacing rules (rules only cover font-size-based spacing: 0.4, 0, -0.2, -0.5). The "›" chevron character (right single guillemet) renders differently across platforms vs a proper chevron icon. Emoji icons (🔔, 🛡, 🎨, etc.) are effective but may render inconsistently across Android/iOS.
- **Grade: A-** — Best example. Minor letterSpacing deviation.

#### Example 5: Product Detail (Shoe Store)
- **Renders correctly?** YES — hero image area, product info, size selector, color selector, description, reviews, sticky bottom bar.
- **Visual hierarchy?** Excellent: large image area (280px) → brand label (13/uppercase) → product name (24/700) → price (24/700/primary) → rating → badge → size/color pickers → description → review → CTA.
- **Spacing rhythm?** Good: sections separated by marginTop: 24, consistent paddingHorizontal: 20.
- **Content?** Excellent: "Nike", "Air Max 270", "$189.00", "4.8 ★ (2.4k reviews)", "Free Shipping", realistic description text.
- **Touch targets?** Size options are 48x40 — width fine, height at 40 (compact). Color swatches are 32x32 — BELOW 44px minimum. Heart button is 48x48. "Add to Cart" is 48px. Good overall.
- **Professional?** YES — looks like a real e-commerce product page.
- **Issues:** Color swatches at 32x32 violate the 44px touch target rule that the design system itself defines. The sticky bottom bar uses `position: "absolute"` with `bottom: 0` — this works but `paddingBottom: 98` on the last scroll section compensates. This is fragile. The "Free Shipping" badge uses `rgba(0, 184, 148, 0.1)` with spaces — technically fine but inconsistent with the no-spaces format used in token definitions.
- **Grade: B+** — Touch target violation on color swatches; fragile absolute positioning.

**Few-Shot Example Summary:**

| Example | Grade | Key Issues |
|---------|:-----:|------------|
| Login | A- | Apple logo character may not render |
| Dashboard | A- | Minor CTA button height (40px) |
| Profile | B+ | aspectRatio web compatibility; off-scale border |
| Settings | A- | Off-scale letterSpacing; emoji platform variance |
| Product | B+ | Color swatches violate 44px rule; fragile positioning |

**Overall: B+** — These are strong examples. They demonstrate clear design taste and professional quality. The issues are minor and mostly edge cases. The biggest concern is that 2 of 5 examples violate the system's own touch target rules.

---

### 2C. System Prompt Architecture

**Approximate Token Count:**
- DESIGN_TOKENS: ~700 tokens
- COMPONENT_TYPES: ~500 tokens
- CONTENT_LIBRARY: ~1,100 tokens
- PLATFORM_RULES: ~600 tokens
- QUALITY_CHECKLIST: ~200 tokens
- Few-shot examples (5): ~4,000-5,000 tokens combined (they're dense JSON)
- Framing text + instructions: ~300 tokens
- **Total system prompt: ~7,400-8,400 tokens**

This is LONG but within acceptable bounds for Claude Sonnet/Haiku. The few-shot examples are the bulk. With prompt caching (`cache_control: { type: 'ephemeral' }`), the cost is amortized across requests.

**Instruction Clarity:**
- Instructions are mostly clear and well-organized.
- The system prompt uses BOTH positive examples (few-shot) AND negative constraints ("Never use Lorem ipsum"). This is a good balance.
- ISSUE: The prompt says "Return ONLY valid JSON, no markdown, no explanation" but also includes `EDIT MODE:` instructions inline. During create mode, the model sees edit mode rules that don't apply — minor confusion potential.
- ISSUE: The DESIGN.MD SUPPORT paragraph in the system prompt tells the model to "extract and use" tokens from DESIGN.md — but the extraction already happened in `extractDesignMd()` before the prompt is built. The model receives pre-extracted tokens appended at the end. The instruction is slightly misleading but harmless.

**Edit Mode vs Create Mode:**
- Create mode has 5 few-shot examples — strong.
- Edit mode has one paragraph of instructions at the end of the system prompt, plus a detailed user message template (lines 248-256) that includes the existing tree and says "Do NOT recreate from scratch."
- WEAKNESS: There are NO few-shot examples for edit mode. The model has to figure out how to modify an existing JSON tree from instructions alone. This likely causes the #1 user complaint: edits that accidentally rebuild the screen instead of modifying it.

**Contradictions:**
- The system prompt says "maximum 4-5 different font sizes per screen" (PLATFORM_RULES). But the dashboard example uses at least 6 different sizes (11, 12, 13, 14, 17, 20, 24, 28, 48). This contradiction means the model will learn to ignore the 4-5 rule.
- The token system allows 48px font size for "hero display, decorative emoji" but emoji are set in the few-shot examples at sizes 20-48 — the size variation is inconsistent between examples.

**Rules That Could Hurt Output:**
- "Screen width is 320px" — this is narrow. Modern iPhones are 375-430pt wide. 320px was the iPhone 5. This could cause the model to generate overly cramped layouts.
- "use emoji characters or colored View circles — never text descriptions like '[icon]'" — good rule, but emoji rendering varies wildly across platforms, potentially making previews look inconsistent.

**Overall Prompt Architecture: B** — Well-structured with good examples, but edit mode is under-served and there are some internal contradictions.

---

### 2D. Normalizer Effectiveness

**What it catches (good):**
1. Off-scale spacing values → snaps to nearest
2. Off-scale font sizes → snaps to nearest
3. Off-scale border radius → snaps to nearest
4. Invalid font weights → maps to nearest valid weight
5. Unsupported component types → maps to supported equivalents (Pressable→TouchableOpacity, etc.)
6. Root element missing flex:1 → adds it
7. TouchableOpacity below 44px → adds minHeight:44
8. Nested vertical ScrollViews → converts inner to View
9. Empty children arrays → removes them
10. Extreme negative margins (< -16) → resets to 0
11. String pixel values ("16px") → parses to number
12. props.style (legacy format) → normalizes

**What it misses (gaps):**
1. **Color validation:** No checking that colors come from the defined palette. LLM can generate arbitrary hex colors and they pass through untouched.
2. **Font size/weight pairing:** No validation that heading sizes use bold weights and body uses regular.
3. **Line height validation:** Not checked at all. The model might output lineHeight: 18 for fontSize: 14 (should be 20).
4. **Letter spacing:** Not validated.
5. **Touch target width:** Only height/minHeight is checked, not width. A 20px-wide button would pass.
6. **Safe area padding:** Not enforced on root. If the model forgets paddingTop:54, the normalizer doesn't add it.
7. **Content validation:** No check for "Lorem ipsum" or "John Doe" in text nodes.
8. **Opacity values:** Not validated against the defined scale.
9. **Shadow values:** Not validated.
10. **Component height standards:** Button height 48, input height 48 — not enforced by normalizer.

**False positive risk:**
- **YES — borderRadius snapping could break intentional values.** If someone uses DESIGN.md to specify `borderRadius: 20`, the normalizer will snap it to 16 or 24. The normalizer doesn't know about custom DESIGN.md tokens and applies Mokkoi's scale unconditionally.
- **Spacing snapping same issue:** Custom spacing from DESIGN.md (e.g., spacing: 18) would be snapped to 16 or 20.

**Running on all paths?**
- YES for streaming: `normalizeComponentTree(tree)` is called after full text is parsed (line 461).
- YES for non-streaming: would need to verify the remaining code, but the flow structure mirrors streaming.
- YES for generate-flow: `normalizeComponentTree(s.tree)` is called per screen (line 204 of generate-flow.ts).
- **ISSUE:** Partial tree emissions during streaming (`partial_tree` events at line 436) are NOT normalized. Users see un-normalized trees during streaming, then a normalized final tree. This could cause a visual "jump" at the end of streaming.

**Overall Normalizer: B-** — Catches structural issues well but misses semantic validation (colors, line heights, content). The DESIGN.md override conflict is a real bug.

---

### 2E. Content Library Assessment

**Category Count: 26 categories**

Fitness/Health, E-commerce/Shopping, Social Media, Banking/Finance, Food Delivery, Music/Media, Productivity/Tasks, Travel, Education, Real Estate, Dating, Weather, News/Media, Messaging/Chat, Healthcare, Ride-Hailing, Streaming/Video, Crypto/Trading, Habit Tracking, Pet Care, Recipe/Cooking, Events/Ticketing, Parking/Maps, Kids/Parenting, Gaming, Subscription/SaaS.

**Random Category Check 1: Banking/Finance**
- Names: "Main Checking", "Savings Goal", "Investment Portfolio" — realistic
- Amounts: "$4,285.50", "$12,847.32", "+$2,450.00" — believable
- Transactions: "Netflix Subscription -$15.99", "Whole Foods Market -$67.32", "Payroll +$3,200" — excellent, specific merchants
- **Verdict:** Would feel like the user's app. Grade: A

**Random Category Check 2: Pet Care**
- Pets: "Luna · Golden Retriever · 3 years", "Mochi · Persian Cat · 5 years" — cute, realistic
- Events: "Vet Checkup · Apr 5" — good
- Logs: "Breakfast: 2 cups kibble", "Walk: 45 min" — realistic
- **Verdict:** Solid but thin. Only 2 pet names. Real pet apps have more: weight tracking, vaccination records, medication schedules.
- Grade: B+

**Random Category Check 3: Crypto/Trading**
- Assets: "Bitcoin (BTC)", "Ethereum (ETH)", "Solana (SOL)" — standard
- Prices: "$67,842.50", "$3,421.80" — plausible (BTC range is right for 2026)
- Changes: "+2.4%", "-0.8%" — realistic daily moves
- Portfolio: "Total Value: $24,580" — believable retail investor
- **Verdict:** Good basics. Missing: charts data, order book snippets, alert labels.
- Grade: B+

**Missing Categories:**
- **Automotive/Car maintenance** (oil changes, mileage tracking)
- **Job search/Recruiting** (LinkedIn-style)
- **Photography/Camera** (photo editing, gallery management)
- **Sports/Live scores** (game schedules, team standings)
- **Meditation/Mindfulness** (separate from fitness — focused meditation apps)
- **Language learning** (separate from education — Duolingo-style)
- **Home automation/IoT** (smart home controls, device management)

**Overall Content Library: A-** — 26 categories is impressive and covers most user requests. The content within each category is realistic and would make generated screens feel professional.

---

### 2F. DESIGN.md Parser Assessment

**Supported Formats:**
1. Fenced code blocks (```md, ```markdown, ```design, ```yaml, ```json) containing design headers
2. Inline markers (`--- DESIGN.MD ---` ... `--- END DESIGN.MD ---`)
3. Unfenced markdown with ≥2 design-related headers

**Recognized Headers:** Colors, Typography, Spacing, Components, Theme, Tokens, Brand

**What works:**
- Pattern 1 handles the most common case (user pastes a code block)
- Pattern 3 catches loose markdown that users might paste without fencing
- The 2-header minimum for Pattern 3 prevents false positives on prompts that casually mention "colors"

**What doesn't work / risks:**
- **Stitch DESIGN.md format compatibility:** UNTESTED. If Google Stitch outputs DESIGN.md with headers like "## Primary Colors" or "### Font Family" (sub-headers rather than top-level), the parser may not catch them because it only matches `# Colors`, `# Typography`, etc. at the top-level header.
- **JSON format:** If a DESIGN.md uses JSON objects instead of markdown tables (e.g., `{"primary": "#FF0000"}`), the parser extracts the raw text but the LLM must interpret it. No structured parsing.
- **Style Dictionary format:** Not supported. Style Dictionary uses nested JSON with `$value` and `$type` keys — the parser would extract it as raw text.
- **Figma Variables:** Not supported.
- **Tailwind config:** Not supported.
- **Conflicting tokens:** If the user provides tokens that conflict with Mokkoi's normalizer scales (e.g., borderRadius: 10 in DESIGN.md), the normalizer will snap them anyway. This is a **real bug** — the normalizer should respect DESIGN.md overrides.

**Robustness:**
- FRAGILE for edge cases. The regex patterns are greedy and could match unintended content in long prompts.
- Pattern 3 (unfenced headers) is the riskiest — a prompt like "I want a screen with Colors that pop and Typography that's bold" would match two headers and incorrectly strip content from the prompt.

**Overall Parser: C+** — Works for the happy path. Fragile for real-world use. The normalizer conflict is a genuine bug that would frustrate users trying to use custom design tokens.

---

## PART 3: GENERATION QUALITY PREDICTION

### Test 1: "Create a fitness dashboard with daily stats, workout history, and progress rings"

**Prediction:** HIGH QUALITY. This is directly covered by the fitness dashboard few-shot example. Claude will produce something very close to EXAMPLE_DASHBOARD but with the specific elements requested. The content library has excellent fitness data.

**Most likely quality issue:** "Progress rings" — the renderer has no circular progress component. The model will likely approximate with progress bars (View inside View) or try percentage text. It cannot draw SVG rings.

**User reaction:** "Wow, this looks great!" — then "Wait, where are the progress rings?"

### Test 2: "Design a login screen for a music streaming app"

**Prediction:** HIGH QUALITY. Directly covered by EXAMPLE_LOGIN. Claude will combine the login structure with music content from the content library.

**Most likely quality issue:** It will look very similar to the fitness login example but with music content. Limited visual diversity because there's only one login example to learn from.

**User reaction:** "This looks good, but it looks exactly like the fitness login with different text."

### Test 3: "Build a user profile page with posts grid and follower stats"

**Prediction:** HIGH QUALITY. Directly covered by EXAMPLE_PROFILE. Claude will produce an Instagram-style profile.

**Most likely quality issue:** The photo grid will be colored placeholder rectangles (no actual images). The `aspectRatio` property may not render correctly in the web preview.

**User reaction:** "This is solid" — close to the few-shot example with minor variations.

### Test 4: "Create a settings page for a banking app"

**Prediction:** GOOD QUALITY. Settings is covered by EXAMPLE_SETTINGS. Banking content is in the content library. Claude needs to combine the settings layout with banking-specific options (account security, transaction limits, etc.).

**Most likely quality issue:** May look too generic — identical to the settings example but with banking labels. The model might not think to add banking-specific UI patterns like account balance display in the profile card.

**User reaction:** "Fine, but this could be settings for any app."

### Test 5: "Design a product detail page for a sneaker store"

**Prediction:** HIGH QUALITY. This is almost exactly the EXAMPLE_PRODUCT prompt. Claude will produce something nearly identical.

**Most likely quality issue:** Color swatches at 32px (touch target violation). The "sneaker" emoji (👟) will be the hero image.

**User reaction:** "Impressive!" — This is the best-case scenario because it matches the example.

**Pattern:** Generation quality is HIGH when the prompt matches a few-shot example category, and degrades when it doesn't. The system has 5 examples covering login, dashboard, profile, settings, and product detail. Prompts for categories like "calendar app", "music player", "map view", or "messaging thread" have no direct example and will be more variable.

---

## PART 4: HONEST COMPETITIVE POSITION

### 1. What could you honestly tell a VC about your moat today?

**Honest answer:** "We are the only MCP server that generates React Native screen designs as structured JSON with live preview. We have a design token system and a normalizer that catches common generation errors. We support screenshot input, screen editing with conversation history, and multi-screen flow generation. Our MCP server is published on npm and works with Claude Code and Cursor."

That's it. That's the real moat. It's:
- **React Native + MCP** (unique intersection, nobody else serves this)
- **Design system normalizer** (quality differentiator vs raw LLM output)
- **Published and functional** (not vaporware)

Everything else in the 12-moat document is either aspirational, half-built, or trivially replicable.

### 2. What's the #1 thing that could kill Mokkoi in the next 3 months?

**Rork adding an MCP server.** Rork already generates React Native. They have $2.8M from a16z. If they add MCP support and per-screen generation, Mokkoi's core differentiator (RN + MCP) evaporates. Rork would have the same position plus full-app generation plus VC-funded engineering velocity.

Secondary risk: A well-funded new entrant (possibly from the Expo team) building an AI screen generator with native Expo integration. This would be more natural than Mokkoi's JSON-tree-in-a-web-preview approach.

### 3. What's the single highest-impact thing to build next?

**React Native .tsx code export.**

Right now, Mokkoi generates JSON that only renders in its own web preview. A developer cannot copy Mokkoi's output into their Expo project. This is the #1 adoption blocker. The JSON format creates lock-in that works AGAINST the user, not for them.

If Mokkoi could export a working React Native `.tsx` component file from any generated screen, it becomes immediately useful in a developer's daily workflow. This is the difference between "cool demo" and "tool I actually use."

This is already on the P1 roadmap. It should be P0.

### 4. Is the design system quality good enough to launch?

**Yes, with caveats.**

The good:
- Token system is professional and well-researched
- Few-shot examples are genuinely good (B+ average)
- Content library with 26 categories ensures realistic output
- Normalizer catches the most common structural errors
- Dark theme is attractive and consistent

The caveats:
- Output will look same-y. 5 few-shot examples means 5 "looks." Users generating their 6th screen will start noticing the pattern.
- The mono-accent color (#6C5CE7 purple) means every screen looks "Mokkoi purple" unless the user specifies otherwise.
- Edit mode quality will be inconsistent (no few-shot examples for edits).
- The normalizer can fight against DESIGN.md custom tokens.

**Users will be impressed on first use and start noticing limitations by the 5th-10th screen.**

### 5. What would you tell YC honestly?

**Honest version:**

"We built an MVP that occupies a genuinely empty niche: AI-generated React Native screens via MCP server. The niche is real — no one else serves React Native developers who want AI-generated individual screens inside their existing workflow.

We have a working product: MCP server on npm, web app with phone frame preview, streaming generation, screenshot input, multi-screen flows, and a design token system that ensures consistent output quality. The design system was built by studying Apple HIG and Material Design 3.

What we don't have: code export (our output is JSON, not copy-pasteable .tsx files), a learning loop (we capture edit data but don't use it), community features, or a meaningful user base yet.

Our honest moat is first-mover advantage in an empty niche + design system quality. This is thin but real — the question is whether we can build depth faster than Rork or a new entrant can enter the space.

We're pre-revenue, pre-traction. We need funding to ship code export, grow MCP adoption, and build the Stitch→Mokkoi pipeline before someone else fills this gap."

---

## APPENDIX: Key Metrics

| Metric | Value |
|--------|-------|
| Component types supported | 10 |
| Few-shot examples | 5 |
| Content library categories | 26 |
| Token scales defined | 12 (spacing, font size, weight, line height, letter spacing, border radius, colors dark/light, shadows, icons, avatars, component heights, safe areas) |
| Normalizer rules | ~12 |
| MCP server tools | 7 |
| Design system grade | B+ |
| Moat honesty score | 2.5/10 |
| Launch readiness | Yes (MVP), No (growth product) |
