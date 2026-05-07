import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticateRequest } from './_lib/auth-helper.js'

export const config = {
  api: {
    bodyParser: false,
  },
}

const MAX_BYTES = 8 * 1024 * 1024 // 8MB — well under OpenAI's 25MB cap, generous for ~10min of voice
const ALLOWED_MIMES = new Set([
  'audio/webm',
  'audio/webm;codecs=opus',
  'audio/ogg',
  'audio/ogg;codecs=opus',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
])
const TRANSCRIBE_MODEL = 'gpt-4o-mini-transcribe'

// Best-effort per-IP rate limiter to keep transcribe abuse contained without
// touching the existing Supabase usage_logs (different cost / cadence than
// generation). 30 requests / hour / IP — generous for real users, tight
// enough that a runaway client doesn't burn budget.
const rateBucket = new Map<string, { count: number; resetAt: number }>()
const RATE_WINDOW_MS = 60 * 60 * 1000
const RATE_LIMIT = 30

function rateLimitKey(req: VercelRequest, userId: string): string {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || 'unknown'
  return `${userId}:${ip}`
}

function checkRate(key: string): { allowed: boolean; resetIn: number } {
  const now = Date.now()
  const entry = rateBucket.get(key)
  if (!entry || entry.resetAt < now) {
    rateBucket.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return { allowed: true, resetIn: 0 }
  }
  if (entry.count >= RATE_LIMIT) {
    return { allowed: false, resetIn: Math.ceil((entry.resetAt - now) / 1000) }
  }
  entry.count += 1
  return { allowed: true, resetIn: 0 }
}

async function readBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req as AsyncIterable<Buffer | string>) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += buf.length
    if (total > MAX_BYTES) {
      throw new Error('payload_too_large')
    }
    chunks.push(buf)
  }
  return Buffer.concat(chunks)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  const user = await authenticateRequest(req, res)
  if (!user) return

  // Per-user-per-IP rate limit before we incur any OpenAI cost.
  const rate = checkRate(rateLimitKey(req, user.id))
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(rate.resetIn))
    return res.status(429).json({ error: 'rate_limit', retryAfter: rate.resetIn })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.error('[transcribe] OPENAI_API_KEY is not configured')
    return res.status(500).json({ error: 'transcribe_not_configured' })
  }

  // Content-Type signals what kind of audio the client sent. We trust the
  // client header to pick a plausible filename + extension for the OpenAI
  // upload; OpenAI itself sniffs the bytes for the actual format.
  const contentType = (req.headers['content-type'] || '').split(';')[0].trim().toLowerCase()
  if (!ALLOWED_MIMES.has(req.headers['content-type'] as string) && !ALLOWED_MIMES.has(contentType)) {
    return res.status(415).json({ error: 'unsupported_audio_format', received: contentType })
  }

  // Read raw body (we disabled the default JSON parser so we can stream
  // arbitrary binary into a buffer). Cap at MAX_BYTES to fail fast on
  // pathological inputs.
  let audio: Buffer
  try {
    audio = await readBody(req)
  } catch (err) {
    if (err instanceof Error && err.message === 'payload_too_large') {
      return res.status(413).json({ error: 'audio_too_large', maxBytes: MAX_BYTES })
    }
    console.error('[transcribe] readBody failed:', err)
    return res.status(400).json({ error: 'invalid_body' })
  }
  if (audio.length < 1024) {
    // Anything under ~1KB is sub-second silence; OpenAI will reject it
    // and bill us, so short-circuit before we call out.
    return res.status(400).json({ error: 'audio_too_short' })
  }

  // Build the multipart form for OpenAI. Node 18+ has Blob/FormData globals.
  const ext = contentType.includes('mp4') ? 'mp4'
    : contentType.includes('mpeg') ? 'mp3'
    : contentType.includes('wav') ? 'wav'
    : contentType.includes('ogg') ? 'ogg'
    : 'webm'
  const filename = `voice.${ext}`

  const form = new FormData()
  form.append('file', new Blob([new Uint8Array(audio)], { type: contentType }), filename)
  form.append('model', TRANSCRIBE_MODEL)
  // Plain-text response keeps the parse trivial. Mokkoi prompts are short
  // enough that we don't need timestamps or word-level data.
  form.append('response_format', 'text')

  let openaiResp: Response
  try {
    openaiResp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    })
  } catch (err) {
    console.error('[transcribe] OpenAI fetch failed:', err)
    return res.status(502).json({ error: 'transcribe_upstream_unavailable' })
  }

  if (!openaiResp.ok) {
    const errBody = await openaiResp.text().catch(() => '')
    console.error('[transcribe] OpenAI error:', openaiResp.status, errBody)
    return res.status(502).json({ error: 'transcribe_upstream_error', status: openaiResp.status })
  }

  // response_format=text returns plain text (no JSON wrapper).
  const text = (await openaiResp.text()).trim()
  if (text.length === 0) {
    return res.status(200).json({ text: '', empty: true })
  }
  return res.status(200).json({ text })
}
