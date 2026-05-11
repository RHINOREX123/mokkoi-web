/* ────────────────────────────────────────────────────────────────────────────
 * Pill state — pure-visual filter-pill toggle state.
 *
 * State lives in RuntimeIframePreview (parent), survives screen re-renders,
 * is mirrored into the iframe via postMessage so ScreenRenderer can apply
 * active styling. Has NO effect on appData, navigation, or any other screen.
 *
 * Shape: pillState[screenId][group] = active stateKey
 * ──────────────────────────────────────────────────────────────────────────── */

export type PillState = Record<string, Record<string, string>>

/**
 * Active stateKey for a (screen, group) pair, or `fallbackStateKey` if unset.
 * Callers pass the first pill's stateKey as the fallback so a pill row is
 * never rendered with zero active pills.
 */
export function getActivePillStateKey(
  state: PillState,
  screenId: string,
  group: string,
  fallbackStateKey?: string,
): string | null {
  const fromState = state[screenId]?.[group]
  if (typeof fromState === 'string' && fromState.length > 0) return fromState
  return fallbackStateKey ?? null
}

/**
 * Returns a NEW PillState with (screenId, group) set to `key`. Original
 * object is not mutated — caller can pass straight to a setState updater.
 */
export function setActivePillStateKey(
  state: PillState,
  screenId: string,
  group: string,
  key: string,
): PillState {
  const screenSlice = state[screenId] ?? {}
  return {
    ...state,
    [screenId]: {
      ...screenSlice,
      [group]: key,
    },
  }
}
