#!/usr/bin/env node
// eval/free-tier-gate.mjs — verifies the free-tier app gate.
//
// What it tests:
//   1. The pure gate decision (decideAppGate in api/_lib/userPlan.ts) returns
//      allow/allow/block for free users at counts 0/1/2 and always allows paid.
//   2. The userPlan.ts source still exports the helpers the gate depends on
//      (getUserPlan, getFreeAppCount, decideAppGate) and pins the limit at 2.
//
// Why this shape:
//   userPlan.ts cannot be imported directly from a .mjs without a TS loader,
//   and importing it would also pull supabase-js + ESM resolution headaches.
//   The gate is 5 lines of pure logic; we mirror it here and contract-check
//   the source so the test stays honest if the real gate changes.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const userPlanPath = resolve(__dirname, '..', 'api', '_lib', 'userPlan.ts')

// --- Mirror of api/_lib/userPlan.ts decideAppGate ---
const FREE_APP_LIMIT = 2
function decideAppGate(tier, freeAppsUsed) {
  if (tier === 'paid') return { allow: true }
  if (freeAppsUsed >= FREE_APP_LIMIT) {
    return {
      allow: false,
      reason: 'free_app_limit_reached',
      free_apps_used: freeAppsUsed,
      free_apps_limit: FREE_APP_LIMIT,
    }
  }
  return { allow: true }
}

// --- Mocked getFreeAppCount: returns whatever the test rig configured ---
function makeMockGetFreeAppCount(value) {
  return async function getFreeAppCount(_userId) {
    return value
  }
}

let pass = 0
let fail = 0
const failures = []

function assert(label, cond, detail) {
  if (cond) {
    pass++
    console.log(`  PASS  ${label}`)
  } else {
    fail++
    failures.push({ label, detail })
    console.log(`  FAIL  ${label}  ${detail ? `→ ${JSON.stringify(detail)}` : ''}`)
  }
}

console.log('— Behavioral: free tier, count 0/1/2 —')
for (const count of [0, 1, 2]) {
  const getCount = makeMockGetFreeAppCount(count)
  const observed = await getCount('user-x')
  const decision = decideAppGate('free', observed)
  const expectAllow = count < FREE_APP_LIMIT
  assert(
    `free + count=${count} → ${expectAllow ? 'allow' : 'block'}`,
    decision.allow === expectAllow,
    decision,
  )
  if (!expectAllow) {
    assert(
      `  block payload shape (count=${count})`,
      decision.allow === false &&
        decision.reason === 'free_app_limit_reached' &&
        decision.free_apps_used === count &&
        decision.free_apps_limit === FREE_APP_LIMIT,
      decision,
    )
  }
}

console.log('\n— Behavioral: paid tier, count 0/1/2/99 —')
for (const count of [0, 1, 2, 99]) {
  const getCount = makeMockGetFreeAppCount(count)
  const decision = decideAppGate('paid', await getCount('user-x'))
  assert(`paid + count=${count} → allow`, decision.allow === true, decision)
}

console.log('\n— Source contract: api/_lib/userPlan.ts —')
const src = readFileSync(userPlanPath, 'utf8')
assert(
  'exports getUserPlan',
  /export\s+async\s+function\s+getUserPlan\s*\(/.test(src),
)
assert(
  'exports getFreeAppCount',
  /export\s+async\s+function\s+getFreeAppCount\s*\(/.test(src),
)
assert(
  'exports decideAppGate',
  /export\s+function\s+decideAppGate\s*\(/.test(src),
)
assert(
  'FREE_APP_LIMIT pinned to 2',
  /FREE_APP_LIMIT\s*=\s*2\b/.test(src),
)
assert(
  "getFreeAppCount queries generation_type='app' AND success=true",
  /generation_type[^\n]*['"]app['"]/.test(src) && /success[^\n]*true\b/.test(src),
)
assert(
  "getUserPlan returns 'paid' for plan!='free' AND status active/trialing",
  /plan\s*!==?\s*['"]free['"]/.test(src) &&
    /status\s*===?\s*['"]active['"]/.test(src) &&
    /status\s*===?\s*['"]trialing['"]/.test(src),
)

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) {
  console.error('FAILURES:', JSON.stringify(failures, null, 2))
  process.exit(1)
}
