// api/lib/template-matcher.ts
// Pure function: maps a user prompt to the best-fitting AppTemplate id, or null.
// Designed to recover the "hidden prior" benefit of the template grid after the
// grid is removed from the landing page.

interface TemplateKeywords {
  id: string
  primary: string[]   // must-have anchor terms (score boost)
  secondary: string[] // supporting terms
}

const TEMPLATE_KEYWORDS: TemplateKeywords[] = [
  {
    id: 'fitness',
    primary: ['fitness', 'workout', 'exercise', 'gym'],
    secondary: ['tracker', 'tracking', 'progress', 'health', 'calories', 'steps', 'muscle', 'cardio', 'yoga', 'hiit', 'strength'],
  },
  {
    id: 'food-delivery',
    primary: ['food', 'delivery', 'restaurant', 'restaurants'],
    secondary: ['order', 'ordering', 'menu', 'cart', 'cuisine', 'pizza', 'sushi', 'tracking', 'rider'],
  },
  {
    id: 'social-media',
    primary: ['social', 'feed', 'posts'],
    secondary: ['media', 'profile', 'followers', 'following', 'stories', 'messages', 'notifications', 'comments', 'likes'],
  },
  {
    id: 'ecommerce',
    primary: ['ecommerce', 'e-commerce', 'shopping', 'shop', 'store'],
    secondary: ['product', 'products', 'cart', 'checkout', 'catalog', 'buy', 'purchase'],
  },
  {
    id: 'banking',
    primary: ['banking', 'bank', 'finance', 'financial'],
    secondary: ['transactions', 'transfer', 'balance', 'account', 'wallet', 'payment', 'card', 'savings'],
  },
  {
    id: 'music',
    primary: ['music', 'song', 'songs', 'audio'],
    secondary: ['streaming', 'stream', 'playlist', 'playlists', 'player', 'album', 'artist', 'podcast'],
  },
]

export interface TemplateMatch {
  templateId: string
  score: number
}

export function matchTemplate(prompt: string): TemplateMatch | null {
  if (!prompt || !prompt.trim()) return null

  const tokens = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  const tokenSet = new Set(tokens)
  const joined = tokens.join(' ')

  let best: TemplateMatch | null = null

  for (const t of TEMPLATE_KEYWORDS) {
    // Count primary hits
    let primaryHits = 0
    for (const kw of t.primary) {
      if (tokenSet.has(kw) || joined.includes(kw)) primaryHits++
    }

    // Require at least one primary hit
    if (primaryHits === 0) continue

    // Count secondary hits
    let secondaryHits = 0
    for (const kw of t.secondary) {
      if (tokenSet.has(kw)) secondaryHits++
    }

    // Scoring: primary hit ratio drives most of the score.
    // 1 primary hit out of 4 possible = ratio 0.25.
    // We want score > 0.7 for "A fitness tracking app" (1 primary + 1 secondary).
    //
    // Formula: score = primaryHits * 0.5 + secondaryHits * 0.1 + primaryHitRatio * 0.3
    // For fitness (1p+1s): 1*0.5 + 1*0.1 + (1/4)*0.3 = 0.5+0.1+0.075 = 0.675 — still not enough.
    //
    // Better approach: treat having ANY primary hit as 0.7 base, then secondary boosts.
    // score = 0.7 + (secondaryHits / secondary.length) * 0.3
    // "A fitness tracking app": 0.7 + (1/11)*0.3 = 0.727 ✓
    // "build me a to-do list": no primary hit → null ✓

    const secondaryBoost = secondaryHits > 0 ? (secondaryHits / t.secondary.length) * 0.3 : 0
    const primaryBonus = primaryHits > 1 ? ((primaryHits - 1) / t.primary.length) * 0.1 : 0
    const score = 0.7 + secondaryBoost + primaryBonus

    if (!best || score > best.score) best = { templateId: t.id, score }
  }

  if (!best || best.score < 0.7) return null
  return best
}
