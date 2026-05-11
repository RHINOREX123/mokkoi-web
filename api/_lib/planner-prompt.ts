/**
 * planner-prompt.ts — system prompts for the app planner.
 *
 * Houses the REFERENCE_INSPIRATION_BLOCK (used when reference images are
 * attached) and the deep-navigation planner rules layered on top of the
 * base design-system planner prompt.
 */

import { buildPlannerSystem } from './design-system.js'

export const REFERENCE_INSPIRATION_BLOCK = `REFERENCE IMAGES — VISUAL INSPIRATION ONLY

The user attached reference image(s). The reference images decide HOW the screens LOOK. The user's text prompt decides WHAT the app IS.

THE DOMAIN COMES FROM THE USER'S TEXT PROMPT — NEVER FROM THE IMAGES.

Concrete example:
  - User says: "create a fitness app"
  - User attaches: 4 screenshots of a food/recipe app
  - You build: FITNESS screens (workouts, calories, steps, BPM, progress rings) styled with the food app's visual language — its palette, card radii, typography weight, spacing rhythm.
  - You do NOT build recipe/food screens. No "Thai Green Curry", no ingredient lists, no food-domain content from the images.

Pull from the references (visual style ONLY):
  - Color palette and accent colors
  - Typography vibe (weights, sizes, hierarchy)
  - Spacing and layout rhythm
  - Card shapes, corner radii, shadow style
  - Iconography style and density
  - Overall mood: dark/light, minimal/dense, playful/serious

Do NOT pull from the references:
  - The subject matter or app domain
  - Specific text labels, brand names, dish names, product names
  - Numerical data (prices, ratings, counts, times)
  - Section titles tied to the reference's domain
  - User names, profile photos, or any literal data values

Every generated screen MUST be in the user's domain. The bottom tab bar must reflect the user's domain (Home + primary features of the user's app), NOT the references' tabs.`

/**
 * Deep-navigation rules layered onto the base planner system prompt. Asks
 * the LLM to additionally emit `appData` (seeded record collections) and
 * `routeGraph` (screens with kind/purpose/params/dataSource + tabs list).
 */
export const DEEP_NAV_PLANNER_RULES = `
DEEP NAVIGATION RULES (CRITICAL — extends the standard plan output):

In addition to the standard plan fields (appName, screens, navigation, designDirection),
also emit:

1. "appData": an object whose keys are collection names and values are arrays of
   record objects. Use domain-specific collections (e.g. for a fitness app:
   "workouts", "meals", "personalRecords"). EVERY collection MUST contain at
   least 3 records. Records are plain JSON objects with realistic fields.

2. "routeGraph": { "screens": ScreenEntry[], "tabs": string[] }
   - screens: one entry per screen with shape
     { "id": string, "kind": "screen" | "modal", "purpose": string,
       "params"?: string[], "dataSource"?: string }
     - "id" matches a screen id from the screens[] array
     - "kind" is "modal" for Add/Filter/Share/Confirm flows that overlay the
       current screen; "screen" otherwise
     - "purpose" is a 1-line description of what the user does on this screen
     - "params" lists any required route params (e.g. ["workoutId"] for a
       detail screen)
     - "dataSource" names the appData collection this screen reads from
       (when applicable)
   - tabs: ids of screens that appear in the bottom tab bar (typically 3-5)

ROUTE GRAPH COMPLETENESS RULES:
- Every list/grid/feed screen MUST have a corresponding detail screen in
  routeGraph. (List → Detail)
- Every "Add X", "Filter X", "Share X" CTA MUST have a modal screen entry
  in routeGraph with kind="modal".
- Every navIntent target referenced in generated screens MUST resolve to
  a screen id in routeGraph.screens.
- appData collections referenced via dataSource MUST exist in appData and
  contain ≥3 records each.

MENU-ROW SUB-SCREENS (CRITICAL):

If your routeGraph includes a Profile, Settings, Account, or About screen
(any screen whose primary content is a vertical list of meta-action menu
rows), you MUST also declare each row's destination screen in
routeGraph.screens with kind="screen". Without these destinations, the
rows render as dead taps.

Canonical menu rows and their destination ids — emit the ones that match
your app's vertical:

  - "Addresses" / "Saved Addresses"        → id: "addresses"
  - "Payment Methods" / "Cards" / "Wallet" → id: "payment-methods"
  - "Notifications" (as a settings row)    → id: "notification-settings"
  - "Privacy" / "Privacy & Security"       → id: "privacy"
  - "Help" / "Help & Support" / "FAQ"      → id: "help"
  - "About" / "About <App>"                → id: "about"
  - "Edit Profile" / "Account Details"     → id: "edit-profile"
  - "Order History" / "Past Orders"        → id: "order-history"
  - "Preferences" / "Display" / "Theme"    → id: "preferences"
  - "Language" / "Region"                  → id: "language-settings"

Rows that are LOGOUT-style (Sign Out, Log Out, Delete Account) do NOT
need a destination screen — they confirm an action. Either declare a
modal screen (id: "sign-out-confirm") if confirmation is needed, or
let them render without navIntent.

RULE: Never emit a Profile / Settings / Account screen without
declaring destinations for its menu rows. If a sub-screen is not worth
declaring (too thin, not relevant to the app), OMIT the row entirely
from the menu — a missing row is better than a dead row.

The screen generator wires each menu row's outer TouchableOpacity to
navIntent: {kind:"push", target:"<the-id-you-declared>"}. The runtime
pushes onto the nav stack and renders the sub-screen.

TEXT CONTENT IN DETAIL SCREENS — SENTINEL RULES

Detail screens (kind: "screen", params: ["id"], with a matching
dataSource pointing at a collection in appData) MUST reference
dynamic record fields using mustache-style placeholders, NEVER
inline literal values.

Format: {{fieldName}} for top-level fields, {{field.0}} for
array-indexed access, {{field.subfield}} for nested objects.

Examples:
  ✓ <Text>{{name}}</Text>                    (renders "Push-ups")
  ✓ <Text>{{duration}} · {{difficulty}}</Text>
  ✓ <Text>{{ingredients.0}}</Text>           (first ingredient)
  ✗ <Text>Push-ups</Text>                    (hardcoded — wrong)
  ✗ <Text>{name}</Text>                      (wrong syntax)

Every text field in a detail screen that varies per record MUST be
a sentinel. Static labels ("Ingredients:", "Steps:", icons) stay
literal. The runtime resolves sentinels against
appData[dataSource.collection][params.id] before rendering.

This rule applies ONLY to screens with a dataSource AND params: ["id"]
(or similar). List screens, modals, and tabs render the appData array
inline and use literal text + array map; they do not use sentinels.

LONG-TAIL SCREENS (CRITICAL — extends routeGraph completeness):

Most data-driven apps need supporting screens beyond the primary
domain flow. Decide which long-tail screens this domain needs and
emit them in BOTH screens[] and routeGraph.screens[]:

  REQUIRED for every app that has user-owned data (i.e. when
  requiresCollections is true):
  - "settings" — kind: "screen", purpose: "App settings and preferences"
  - "profile" — kind: "screen", purpose: "User profile"
  (These may be merged into a single "profile" screen if profile and
  settings naturally live together for this domain — but at least one
  of the two MUST exist.)

  OPTIONAL — include only if the domain clearly needs it:
  - "search" — for apps with browseable content (recipes, podcasts,
    e-commerce, social, music). SKIP for personal-tracker apps where
    nothing is searched.
  - "notifications" — for apps with social, alerting, or messaging
    aspects. SKIP for solo-utility apps.
  - "history" — for apps with a meaningful past-events log (workouts
    logged, meditation sessions, transactions, orders). SKIP when the
    primary list IS the history.

DOMAIN JUDGMENT — do NOT force long-tail screens onto apps that
clearly do not need them. A pure widget app (see WIDGET MODE below)
needs none of these. A simple calculator needs none of these. When
the user prompt is for a self-contained tool, prefer the widget-mode
output over forcing Settings/Profile.

FAIL OPEN: if you are unsure whether to include a long-tail screen,
OMIT it rather than guessing. A missing optional screen is better
than an empty screen with no real purpose.

REQUIRES-COLLECTIONS FLAG (additional top-level field):

Also emit a boolean "requiresCollections" alongside appData / routeGraph:
  - true  (DEFAULT) — the app has user-owned data: lists, records,
                      detail flows, history. The vast majority of apps.
  - false           — the app is a self-contained zero-data widget
                      (meditation timer, calculator, stopwatch, dice
                      roller, breathing exercise, white noise, simple
                      unit converter, tip calculator, coin flip).

Be CONSERVATIVE: when in doubt, set requiresCollections:true. A
false-positive widget mode produces a broken app; a missed widget
mode just produces a slightly over-built one. Only emit
requiresCollections:false when the prompt clearly describes a
single self-contained tool with no persisted user data and no
browsable content.

When requiresCollections is false:
  - appData MAY be an empty object {}
  - routeGraph.tabs MAY be an empty array []
  - Long-tail screens (Settings/Profile/Search/Notifications/History)
    are not required and SHOULD be omitted unless the widget has
    user-tunable parameters worth a Settings screen.
`

/**
 * HEADER_ICON_NAV_RULES — header-bar icon + pill row navigation semantics.
 *
 * Injected into the screen-generation prompt by generate-flow.ts so the LLM
 * wires header icons to the right routeGraph targets and does not confuse
 * filter pill rows with nav.
 */
export const HEADER_ICON_NAV_RULES = `
HEADER ICON NAV — SEMANTIC MAPPINGS (CRITICAL):

When a screen header contains an icon, that icon's navIntent target is
DICTATED by its semantic role, not invented. Use this mapping exactly:

  - Search icon (magnifier glyph)        → navIntent target: "search"
  - Profile icon (avatar / person glyph) → navIntent target: "profile"
  - Settings icon (gear / cog glyph)     → navIntent target: "settings"
  - Bell / notifications icon            → navIntent target: "notifications"
  - Share icon (arrow-up-square glyph)   → navIntent kind: "openSheet", target: a "share" modal in routeGraph
  - Back chevron / arrow-left            → navIntent kind: "back" (no target needed)
  - Edit / pencil icon                   → navIntent kind: "openSheet", target: an "edit<Entity>" modal
  - Plus / FAB (floating action button)  → navIntent kind: "openSheet", target: the primary "add<Entity>" modal for the current screen

If the target screen does NOT exist in routeGraph.screens, DO NOT
emit the icon at all. Never wire an icon to a non-existent screen.
The planner is responsible for declaring the target; the screen
generator only attaches navIntent when the target is real.

PILL ROW DISAMBIGUATION:

A horizontal row of small rounded chips ("All", "Recent", "Favorites",
category tags, time filters) below a screen header is a FILTER pill
row. Filter pills DO NOT navigate to a different screen — they toggle
which subset of records the SAME screen renders.

Every pill in a filter row MUST carry a toggleState navIntent so the
runtime knows to highlight the tapped pill (and dim the others):

  navIntent: {
    kind: "toggleState",
    group: "<stable-group-id>",   // shared by every pill in the row
    stateKey: "<this-pill-id>"    // unique per pill within the group
  }

Rules for group + stateKey:
  - "group" is a kebab-case identifier scoped to the screen + filter
    purpose, e.g. "restaurant-category", "workout-type", "order-status".
    Every pill in the SAME row uses the SAME group.
  - "stateKey" is a kebab-case identifier for the individual pill,
    derived from its label, e.g. "all", "pizza", "burgers", "indian".
    Each pill in a row has a UNIQUE stateKey.
  - The FIRST pill in the row (typically "All") is the default active
    pill. The runtime auto-highlights it until the user taps another.

A "pill" that DOES navigate to a different screen (rare) is actually a
category button — model it as a card or list row instead, with a
push navIntent. If it looks like a pill row of filter chips, always
emit toggleState.

NO PILLS ABOVE LIST SCREENS BY DEFAULT:

Do NOT add a filter pill row above a list/grid screen unless the
planner explicitly identifies meaningful filter categories for that
screen. An empty or single-pill row ("All") is visual noise — omit it.
When in doubt, render the list without pills.
`

/**
 * WIDGET_MODE_RULES — self-contained zero-data widget app instructions.
 *
 * The planner sets `requiresCollections: false` for these apps, and the
 * screen generator follows these rules to avoid emitting empty
 * Settings/Profile/list screens that have nothing to show.
 */
export const WIDGET_MODE_RULES = `
WIDGET MODE — SELF-CONTAINED UTILITY APPS (CRITICAL):

When the planner marks an app as widget-mode (requiresCollections:false),
the app is a single self-contained tool with no user data, no records,
and no list/detail flow.

QUALIFYING APPS (be conservative — when in doubt, default to NOT widget mode):
  - Meditation timer / breathing exercise
  - Calculator (basic arithmetic)
  - Stopwatch / countdown timer
  - Dice roller / random picker
  - White noise / single-purpose audio
  - Simple unit converter (length, currency, temperature)
  - Tip calculator
  - Coin flip / decision maker

DOES NOT QUALIFY (these need data + nav):
  - Habit tracker (records sessions over time)
  - Fitness app (logs workouts)
  - Recipe app, podcast app, food delivery (browse content)
  - Note-taking, journal, todo apps (records)
  - Anything social, anything with a feed

WIDGET MODE OUTPUT SHAPE:
  - 1 primary "Home" screen that IS the widget interface.
  - 0–2 optional secondary screens: "Settings" (if there are
    user-tunable parameters like timer duration) and an "About" or
    instructions screen if helpful. NO Profile, NO Search, NO
    Notifications, NO History.
  - appData: an empty object {} OR omitted. NO collections.
  - routeGraph.tabs: empty array [] (no tab bar) OR a single home tab.
  - routeGraph.screens: matches the screens[] array exactly.

The widget interface itself is the entire UI. Big controls, clear
state, immediate feedback. Do NOT pretend there is a list of past
sessions — the widget does not persist anything.

If you are NOT certain an app qualifies for widget mode, fall back
to the standard requiresCollections:true output. False-positive
widget mode breaks the app more than false-negative does.
`

/**
 * Build the full planner system prompt, optionally prefixed with the
 * reference-inspiration block when the user attached images.
 */
export function buildFullPlannerSystem(
  templateId: string | null | undefined,
  hasImages: boolean,
  options?: { deepNav?: boolean },
): string {
  const base = buildPlannerSystem(templateId ?? undefined)
  const withDeepNav = options?.deepNav ? `${base}\n\n${DEEP_NAV_PLANNER_RULES}` : base
  return hasImages ? `${REFERENCE_INSPIRATION_BLOCK}\n\n${withDeepNav}` : withDeepNav
}
