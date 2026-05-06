// In-memory sliding-window rate limiter for /api/plan-conversation.
//
// V1 only: per-user 6 req/min. Vercel function memory persists across warm
// invocations on the same instance — acceptable for a paid-tier feature
// where determined abuse is unlikely. Migrate to DB-backed if needed.
//
// Per-project 50-turn cap is NOT enforced here; it is checked against the
// `messages` table in the endpoint itself.

const WINDOW_MS = 60_000
const MAX_REQUESTS_PER_WINDOW = 6
const MAX_BUCKETS = 5_000 // protect against unbounded memory in long-lived instances

const buckets = new Map<string, number[]>()

export interface RateLimitResult {
  allowed: boolean
  retryAfterSec: number
}

/** Returns { allowed, retryAfterSec }. retryAfterSec = 0 when allowed. */
export function checkPlanRateLimit(userId: string): RateLimitResult {
  const now = Date.now()
  const cutoff = now - WINDOW_MS

  let timestamps = buckets.get(userId)
  if (!timestamps) {
    timestamps = []
    // Drop oldest bucket if we hit the cap. Cheap heuristic — pick any.
    if (buckets.size >= MAX_BUCKETS) {
      const firstKey = buckets.keys().next().value
      if (firstKey !== undefined) buckets.delete(firstKey)
    }
    buckets.set(userId, timestamps)
  }

  // Drop entries older than the window.
  while (timestamps.length > 0 && timestamps[0] < cutoff) {
    timestamps.shift()
  }

  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    const oldest = timestamps[0]
    const retryAfterSec = Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000))
    return { allowed: false, retryAfterSec }
  }

  timestamps.push(now)
  return { allowed: true, retryAfterSec: 0 }
}

// Test hook — used to reset state between unit tests if/when added.
export function __resetPlanRateLimiter() {
  buckets.clear()
}
