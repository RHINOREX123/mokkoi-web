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
