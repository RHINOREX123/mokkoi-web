import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Image generation proxy — tries sources in order:
 * 1. fal.ai FLUX schnell (AI-generated, ~$0.003/image)
 * 2. Pexels API (stock photos, free)
 * 3. LoremFlickr (keyword-based stock, free, no API key)
 */

// Simple in-memory cache to avoid re-generating identical queries
const cache = new Map<string, { url: string; source: string; ts: number }>()
const CACHE_TTL = 1000 * 60 * 30 // 30 minutes

function getCached(key: string) {
  const entry = cache.get(key)
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry
  cache.delete(key)
  return null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow both GET and POST
  const params = req.method === 'POST' ? (req.body || {}) : (req.query || {})
  const query = (params.query as string || '').trim()
  const width = parseInt(params.width as string) || 400
  const height = parseInt(params.height as string) || 300

  if (!query) {
    return res.status(400).json({ error: 'No query provided' })
  }

  // CORS headers for frontend calls
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  // Check cache first
  const cacheKey = `${query}:${width}x${height}`
  const cached = getCached(cacheKey)
  if (cached) {
    return res.json({ url: cached.url, source: cached.source, cached: true })
  }

  // --- Source 1: fal.ai FLUX schnell ---
  const falKey = process.env.FAL_API_KEY
  if (falKey) {
    try {
      // fal.ai queue API — submit and poll for result
      const submitRes = await fetch('https://queue.fal.run/fal-ai/flux/schnell', {
        method: 'POST',
        headers: {
          'Authorization': `Key ${falKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: query + ', high quality, professional photography, 4k',
          image_size: { width, height },
          num_images: 1,
          num_inference_steps: 4,
          enable_safety_checker: true,
        }),
      })

      if (submitRes.ok) {
        const data = await submitRes.json()
        const imageUrl = data?.images?.[0]?.url
        if (imageUrl) {
          cache.set(cacheKey, { url: imageUrl, source: 'flux', ts: Date.now() })
          return res.json({ url: imageUrl, source: 'flux' })
        }
      }
    } catch (e) {
      console.error('[generate-image] FLUX error:', (e as Error).message)
    }
  }

  // --- Source 2: Pexels API ---
  const pexelsKey = process.env.PEXELS_API_KEY
  if (pexelsKey) {
    try {
      // Use first 3-4 meaningful words for Pexels search (it's keyword-based)
      const pexelsQuery = query.split(/\s+/).slice(0, 5).join(' ')
      const pexelsRes = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(pexelsQuery)}&per_page=3&size=small`,
        { headers: { 'Authorization': pexelsKey } }
      )

      if (pexelsRes.ok) {
        const data = await pexelsRes.json()
        if (data.photos?.length > 0) {
          // Pick a random photo from top 3 for variety
          const photo = data.photos[Math.floor(Math.random() * data.photos.length)]
          // Choose the best size: medium (~350px wide) or landscape (~600px wide)
          const imageUrl = width > 400
            ? (photo.src?.landscape || photo.src?.medium || photo.src?.original)
            : (photo.src?.medium || photo.src?.landscape || photo.src?.original)

          if (imageUrl) {
            cache.set(cacheKey, { url: imageUrl, source: 'pexels', ts: Date.now() })
            return res.json({ url: imageUrl, source: 'pexels' })
          }
        }
      }
    } catch (e) {
      console.error('[generate-image] Pexels error:', (e as Error).message)
    }
  }

  // --- Source 3: LoremFlickr (final fallback, always works) ---
  const keywords = query.split(/\s+/).slice(0, 3).join(',')
  const hash = Math.abs(query.split('').reduce((a, c) => a + c.charCodeAt(0), 0))
  const fallbackUrl = `https://loremflickr.com/${width}/${height}/${encodeURIComponent(keywords)}?lock=${hash}`

  cache.set(cacheKey, { url: fallbackUrl, source: 'loremflickr', ts: Date.now() })
  return res.json({ url: fallbackUrl, source: 'loremflickr' })
}
