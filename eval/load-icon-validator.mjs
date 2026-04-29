// eval/load-icon-validator.mjs — load icon names from src/utils/iconMap.ts
// without compiling TypeScript. We just regex out the keys/values from the
// source file. Brittle but cheap; revisit if iconMap.ts gets refactored.
import { readFileSync } from 'node:fs'

const SRC = readFileSync(new URL('../src/utils/iconMap.ts', import.meta.url), 'utf8')

function extractRecordKeys(src, recordName) {
  // Match `export const NAME: Record<...> = {...}` block
  const re = new RegExp(`export const ${recordName}[^=]*=\\s*\\{([\\s\\S]*?)^\\}`, 'm')
  const m = re.exec(src)
  if (!m) return new Set()
  const body = m[1]
  // Pull each "  key: 'value'" or "  'key': 'value'" pair
  const keys = new Set()
  const values = new Set()
  const lineRe = /['"]?([a-zA-Z][\w-]*)['"]?\s*:\s*['"]([^'"]+)['"]/g
  let mm
  while ((mm = lineRe.exec(body)) !== null) {
    keys.add(mm[1])
    values.add(mm[2])
  }
  return { keys, values }
}

const lucide = extractRecordKeys(SRC, 'LUCIDE_TO_MATERIAL')
const ionic = extractRecordKeys(SRC, 'LUCIDE_TO_IONICONS')

// Build a unified set of acceptable icon names: all Lucide kebab-case keys,
// all Material snake_case values (the mapped output names), plus the
// dual-use pass-throughs the renderer falls back on.
export const KNOWN_ICONS = new Set([
  ...lucide.keys, ...lucide.values,
  ...ionic.keys, ...ionic.values,
])

// Add a permissive default — single-word icons that look reasonable. The
// real renderer's toMaterialSymbol handles unknowns by returning the name
// itself (which the Material Symbols font may or may not have a glyph for).
// We're stricter: name must match either a Lucide key or a Material value.

export function isKnownIcon(name) {
  if (!name || typeof name !== 'string') return false
  return KNOWN_ICONS.has(name)
}

// For use as a default export
export default isKnownIcon
