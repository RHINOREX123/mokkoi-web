// The one place the harness talks to Claude. Everything else calls `ModelClient.call()`,
// so swapping or A/B testing a provider later is a change to this file only.
//
// - Model routing: Haiku 5.5 parses, Sonnet 5.5 runs the specialists, Opus 5.5 is the
//   skeptic and the writer.
// - Prompt caching: the shared evidence pack is a cached system block.
// - Hard budget: every call is priced up front at its worst case and refused if it could
//   push the report past its cap.
import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import type { z } from 'zod'

export type Role = 'parse' | 'specialist' | 'skeptic' | 'writer'

export const MODEL_FOR: Record<Role, string> = {
  parse: 'claude-haiku-5-5',
  specialist: 'claude-sonnet-5-5',
  skeptic: 'claude-opus-5-5',
  writer: 'claude-opus-5-5',
}

const EFFORT_FOR: Record<Role, 'low' | 'medium' | 'high'> = { parse: 'low', specialist: 'medium', skeptic: 'medium', writer: 'medium' }
// Skeptic and writer share an effort level on purpose: changing effort between calls breaks the shared prompt cache.

/** USD per million tokens (Anthropic list prices, Oct 2026). Cache writes are 1.25x input (5-minute TTL). */
interface Price {
  input: number
  output: number
  cacheRead: number
}
const PRICES: Record<string, Price> = {
  'claude-haiku-5-5': { input: 0.1, output: 0.5, cacheRead: 0.01 }, // prompts <= 100K tokens
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2 },
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2 },
  'claude-opus-5': { input: 5, output: 25, cacheRead: 0.5 },
  'claude-fable-5-1': { input: 10, output: 50, cacheRead: 0.25 },
}
const HAIKU_LONG: Price = { input: 0.5, output: 2.5, cacheRead: 0.05 }
const FALLBACK_PRICE: Price = { input: 10, output: 50, cacheRead: 1 } // unknown model: assume the dearest

function priceFor(model: string, promptTokens: number): Price {
  if (model === 'claude-haiku-5-5' && promptTokens > 100_000) return HAIKU_LONG
  return PRICES[model] ?? FALLBACK_PRICE
}

export interface Usage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

export function costOf(model: string, u: Usage): number {
  const p = priceFor(model, u.inputTokens + u.cacheReadTokens + u.cacheWriteTokens)
  return (u.inputTokens * p.input + u.cacheWriteTokens * p.input * 1.25 + u.cacheReadTokens * p.cacheRead + u.outputTokens * p.output) / 1_000_000
}

export class BudgetExceededError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BudgetExceededError'
  }
}

export interface UsageLine {
  calls: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  costUsd: number
}

export class Budget {
  readonly capUsd: number
  spentUsd = 0
  readonly byModel: Record<string, UsageLine> = {}

  constructor(capUsd: number) {
    this.capUsd = capUsd
  }

  /** Worst-case price of a call: every input token uncached plus a 25% write premium, plus max output. */
  assertCanSpend(model: string, estInputTokens: number, maxTokens: number, label: string) {
    const p = priceFor(model, estInputTokens)
    const worst = (estInputTokens * p.input * 1.25 + maxTokens * p.output) / 1_000_000
    if (this.spentUsd + worst > this.capUsd) {
      throw new BudgetExceededError(`${label}: worst case $${worst.toFixed(3)} would exceed the $${this.capUsd} cap (spent $${this.spentUsd.toFixed(3)})`)
    }
  }

  record(model: string, u: Usage) {
    const cost = costOf(model, u)
    this.spentUsd += cost
    const line = (this.byModel[model] ??= { calls: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0 })
    line.calls++
    line.inputTokens += u.inputTokens
    line.outputTokens += u.outputTokens
    line.cacheReadTokens += u.cacheReadTokens
    line.cacheWriteTokens += u.cacheWriteTokens
    line.costUsd += cost
    return cost
  }
}

/** Rough token estimate for budgeting (about 3.5 characters per token for English plus JSON). */
export const estimateTokens = (s: string) => Math.ceil(s.length / 3.5)

export interface ModelCall<T> {
  role: Role
  label: string
  /** Stable, shareable prefix (rules + evidence pack). Cached. */
  cachedSystem: string
  /** Role-specific instructions, after the cache breakpoint. */
  instructions: string
  /** The task input for this call. */
  input: string
  schema: z.ZodType<T>
  maxTokens: number
}

export interface ModelResult<T> {
  data: T
  model: string
  usage: Usage
  costUsd: number
}

export interface ModelClient {
  call<T>(req: ModelCall<T>, budget: Budget): Promise<ModelResult<T>>
}

export class ModelRefusalError extends Error {
  constructor(label: string, detail: string) {
    super(`${label}: the model declined (${detail})`)
    this.name = 'ModelRefusalError'
  }
}

export class AnthropicModelClient implements ModelClient {
  private client: Anthropic

  constructor(client = new Anthropic({ maxRetries: 3, timeout: 10 * 60_000 })) {
    this.client = client
  }

  async call<T>(req: ModelCall<T>, budget: Budget): Promise<ModelResult<T>> {
    const model = MODEL_FOR[req.role]
    const est = estimateTokens(req.cachedSystem + req.instructions + req.input) + 600
    budget.assertCanSpend(model, est, req.maxTokens, req.label)

    // Server-side refusal fallback where the model supports it (not Haiku).
    const fallback = model === 'claude-haiku-5-5' ? {} : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
    const res = await this.client.beta.messages.parse({
      model,
      max_tokens: req.maxTokens,
      ...fallback,
      system: [
        { type: 'text', text: req.cachedSystem, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: req.instructions },
      ],
      messages: [{ role: 'user', content: req.input }],
      output_config: { effort: EFFORT_FOR[req.role], format: betaZodOutputFormat(req.schema) },
    })

    const usage: Usage = {
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
      cacheReadTokens: res.usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: res.usage.cache_creation_input_tokens ?? 0,
    }
    const servedBy = res.model || model
    const costUsd = budget.record(servedBy, usage)

    if (res.stop_reason === 'refusal') throw new ModelRefusalError(req.label, res.stop_details?.category ?? 'no category')
    if (res.stop_reason === 'max_tokens') throw new Error(`${req.label}: output hit max_tokens (${req.maxTokens})`)
    if (!res.parsed_output) throw new Error(`${req.label}: response did not match the schema`)
    return { data: res.parsed_output as T, model: servedBy, usage, costUsd }
  }
}
