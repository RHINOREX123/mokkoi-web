// eval/test-set.mjs — 30 prompts across 6 archetypes, 5 each.
//
// Mix of specificity: some terse user-style ("build a yoga app"), some detailed
// ("create a marathon training app with weekly schedule, distance tracking,
// and pace charts"). Real prompts a user might type, not synthetic test inputs.
// Prompts deliberately span common Mokkoi failure modes (settings screens,
// product grids, chat, dashboards) so the harness exercises the macros most
// at risk per Day 1's findings.
export const TEST_SET = [
  // ─── Fitness ─────────────────────────────────────────────────────────
  { id: 'fit-1', archetype: 'fitness', prompt: 'build a workout tracker app' },
  { id: 'fit-2', archetype: 'fitness', prompt: 'create a calorie counter with daily goal ring and meal logging' },
  { id: 'fit-3', archetype: 'fitness', prompt: 'make a yoga app for beginners with guided sessions and progress tracking' },
  { id: 'fit-4', archetype: 'fitness', prompt: 'build a marathon training app with weekly schedule and pace charts' },
  { id: 'fit-5', archetype: 'fitness', prompt: 'create a step counter app that shows weekly streaks and friend leaderboards' },

  // ─── Food delivery ───────────────────────────────────────────────────
  { id: 'food-1', archetype: 'food-delivery', prompt: 'build a pizza delivery app' },
  { id: 'food-2', archetype: 'food-delivery', prompt: 'create a meal kit ordering app with cuisine filters and recipe previews' },
  { id: 'food-3', archetype: 'food-delivery', prompt: 'make a coffee shop app for ordering ahead with loyalty points' },
  { id: 'food-4', archetype: 'food-delivery', prompt: 'build a grocery delivery app with category browsing and cart management' },
  { id: 'food-5', archetype: 'food-delivery', prompt: 'create a restaurant reservation app with available time slots and reviews' },

  // ─── Social ──────────────────────────────────────────────────────────
  { id: 'social-1', archetype: 'social-media', prompt: 'build a photo sharing app' },
  { id: 'social-2', archetype: 'social-media', prompt: 'create a fitness community app where users post workouts and cheer each other on' },
  { id: 'social-3', archetype: 'social-media', prompt: 'make a recipe sharing app with photo feed and saved cookbooks' },
  { id: 'social-4', archetype: 'social-media', prompt: 'build a book club app with discussion threads and reading progress' },
  { id: 'social-5', archetype: 'social-media', prompt: 'create a travel journal app with location-tagged posts and friend feed' },

  // ─── E-commerce ──────────────────────────────────────────────────────
  { id: 'shop-1', archetype: 'ecommerce', prompt: 'build a sneaker store app' },
  { id: 'shop-2', archetype: 'ecommerce', prompt: 'create a flash sale app with countdown timers and limited-stock badges' },
  { id: 'shop-3', archetype: 'ecommerce', prompt: 'make a vintage clothing marketplace with seller profiles and item conditions' },
  { id: 'shop-4', archetype: 'ecommerce', prompt: 'build a luxury watch shopping app with brand filters and detail pages' },
  { id: 'shop-5', archetype: 'ecommerce', prompt: 'create a plant store app with care guides and watering reminders' },

  // ─── Banking / Finance ───────────────────────────────────────────────
  { id: 'bank-1', archetype: 'banking', prompt: 'build a personal finance tracker' },
  { id: 'bank-2', archetype: 'banking', prompt: 'create a crypto wallet app with portfolio breakdown and transaction history' },
  { id: 'bank-3', archetype: 'banking', prompt: 'make a budgeting app with category spend limits and monthly reports' },
  { id: 'bank-4', archetype: 'banking', prompt: 'build a peer-to-peer payment app like Venmo with friends list and request flow' },
  { id: 'bank-5', archetype: 'banking', prompt: 'create a stock investing app with watchlists, charts, and buy/sell flow' },

  // ─── Music / Media ───────────────────────────────────────────────────
  { id: 'music-1', archetype: 'music', prompt: 'build a music discovery app' },
  { id: 'music-2', archetype: 'music', prompt: 'create a podcast app with episode queue and playback controls' },
  { id: 'music-3', archetype: 'music', prompt: 'make an audiobook app with chapter navigation and reading progress' },
  { id: 'music-4', archetype: 'music', prompt: 'build a meditation audio app with categories like sleep, focus, and stress' },
  { id: 'music-5', archetype: 'music', prompt: 'create a live radio app with station genres and now-playing screen' },
]

export const ARCHETYPES = ['fitness', 'food-delivery', 'social-media', 'ecommerce', 'banking', 'music']
