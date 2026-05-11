/**
 * planner.ts — types-only stub for the deep-navigation planner.
 *
 * This module defines the contract between the planner (Stream A) and its
 * downstream consumers (Streams B/C). The runtime implementation lands in
 * Stream A; this file exists so other streams can import types without a
 * circular dependency.
 */

import type { Screen } from '../../src/types/mokkoi'

export type ScreenKind = 'screen' | 'modal'

export interface ScreenEntry {
  id: string
  kind: ScreenKind
  purpose: string
  params?: string[]
  dataSource?: string
}

export interface RouteGraph {
  screens: ScreenEntry[]
  tabs: string[]
}

export interface AppData {
  screens: Screen[]
  entryScreenId?: string
}

export interface PlannerOutput {
  appData: AppData
  routeGraph: RouteGraph
}

export async function runPlanner(): Promise<PlannerOutput> {
  throw new Error('Not yet implemented — Stream A')
}
