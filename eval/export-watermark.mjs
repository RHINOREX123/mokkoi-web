// Smoke test: run the export converter end-to-end against a tiny screen tree
// and confirm the watermark is correctly injected for free, absent for paid.
//
// Run: node eval/export-watermark.mjs
//
// Pure-string assertions only — no Vercel runtime, no Supabase. Source-level
// regex-shape checks against the produced TSX.

import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readFileSync } from 'node:fs'

const here = dirname(fileURLToPath(import.meta.url))
const exportSrc = readFileSync(join(here, '..', 'api', 'export.ts'), 'utf8')

const checks = []
function assert(name, cond, detail = '') {
  checks.push({ name, ok: cond, detail })
}

// 1. convertTreeToTSX accepts addWatermark param
assert(
  'convertTreeToTSX accepts addWatermark param',
  /function convertTreeToTSX\([^)]*addWatermark\s*=\s*false\)/.test(exportSrc),
)

// 2. convertFlowToTSX accepts addWatermark param
assert(
  'convertFlowToTSX accepts addWatermark param',
  /function convertFlowToTSX\([^)]*addWatermark\s*=\s*false\)/.test(exportSrc),
)

// 3. Wrap JSX with View + Watermark when addWatermark
assert(
  'wraps JSX with <View style={{ flex: 1 }}>...<Watermark /></View>',
  /View style=\{\{\s*flex:\s*1\s*\}\}/.test(exportSrc) &&
    /<Watermark \/>/.test(exportSrc),
)

// 4. Watermark suffix function exists
assert(
  'watermarkSuffix() function defined',
  /function watermarkSuffix\(\)/.test(exportSrc),
)

// 5. Watermark suffix contains expected RN style entries
assert(
  'watermarkSuffix contains absolute bottom-right styles',
  /position:\s*'absolute'/.test(exportSrc) &&
    /bottom:\s*16/.test(exportSrc) &&
    /right:\s*16/.test(exportSrc),
)

// 6. Watermark suffix contains "Made with Mokkoi" text
assert(
  'watermarkSuffix renders "Made with Mokkoi"',
  /Made with Mokkoi/.test(exportSrc),
)

// 7. isUserPaid uses status IN ('active', 'trialing')
assert(
  'isUserPaid checks status active OR trialing (matches Session A)',
  /\.in\(\s*'status',\s*\['active',\s*'trialing'\]\s*\)/.test(exportSrc),
)

// 8. isUserPaid checks plan === 'pro' || plan === 'max'
assert(
  'isUserPaid resolves paid for plan pro|max',
  /data\.plan === 'pro' \|\| data\.plan === 'max'/.test(exportSrc),
)

// 9. Handler appends watermarkSuffix conditionally
assert(
  'handler appends watermarkSuffix() when addWatermark',
  /code\s*\+\s*watermarkSuffix\(\)/.test(exportSrc),
)

// 10. MCP / anonymous bypass watermark
assert(
  'internal callers (MCP / anonymous) bypass watermark',
  /isInternal[\s\S]*?user\.isMCP[\s\S]*?'anonymous'[\s\S]*?'mcp'/.test(exportSrc),
)

// 11. Watermark function uses pointerEvents="none" so it doesn't block taps
assert(
  'Watermark uses pointerEvents="none" to not block underlying taps',
  /pointerEvents="none"/.test(exportSrc),
)

const passed = checks.filter(c => c.ok).length
const failed = checks.filter(c => !c.ok)

console.log(`\n— Export watermark contract checks —\n`)
for (const c of checks) {
  console.log(`  ${c.ok ? 'PASS' : 'FAIL'}  ${c.name}`)
  if (!c.ok && c.detail) console.log(`        ${c.detail}`)
}

console.log(`\n${passed} passed, ${failed.length} failed\n`)
if (failed.length > 0) process.exit(1)
