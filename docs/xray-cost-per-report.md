# Mokkoi X-ray: what one Quick report costs

**Date:** 2026-10-29. **Engine:** `xray-harness-0.1.0`. **Source:** `response.usage` from real
Claude API runs, priced at list rates (per million tokens: Haiku 5.5 $0.10 in / $0.50 out /
$0.01 cache read; Sonnet 5.5 $2 / $10 / $0.20; Opus 5.5 $4 / $20 / $0.20; cache writes are 1.25×
input).

## Answer

**One Quick X-ray costs about $0.30–$0.70 in Claude usage, about $0.50 typical**,
and takes 1.5–3.5 minutes. That's about 1% of the $49 price. The hard cap per report is $5.
The one real end-to-end run (live data, Supabase) cost **$0.671**.

Collectors (DNS, RDAP, Wayback, PageSpeed and so on) use free public APIs and add no cost.

## Per report (final run, recorded fixtures)

| Benchmark | Haiku 5.5 (orchestrator) | Sonnet 5.5 (5 specialists) | Opus 5.5 (skeptic + writer) | Total | Wall time |
|---|---|---|---|---|---|
| Flippa SaaS + website (11.7K-token evidence pack) | 1 call · 218 in / 1,309 out · 11,718 cache write · **$0.002** | 5 calls · 9,185 in / 11,017 out · 48,216 cache read · 12,054 cache write · **$0.168** | 2 calls · 12,754 in / 6,927 out · 23,598 cache write · **$0.308** | **$0.478** | 120 s |
| Listing-only check (3.6K-token pack) | 1 call · 218 / 1,540 · 3,588 write · **$0.001** | 5 calls · 10,585 / 6,766 · 15,696 read · 3,924 write · **$0.102** | 2 calls · 11,364 / 7,286 · 7,338 write · **$0.228** | **$0.331** | 115 s |
| Website-only check (5.6K-token pack) | 1 call · 218 / 1,197 · 5,606 write · **$0.001** | 5 calls · 5,245 / 6,503 · 23,768 read · 5,942 write · **$0.095** | 2 calls · 7,895 / 4,573 · 11,374 write · **$0.180** | **$0.276** | 85 s |

Output tokens include the models' thinking tokens.

## The real end-to-end run (live data, Supabase, through the order flow)

Order placed on `/order`, marked paid in `/admin/xray`, run by `worker/run.ts --queued` against
the live site and listing, stored in the `mokkoi` Supabase project, approved, served at `/r/:token`.

| Model | Calls | Input | Output | Cache read | Cache write | Cost |
|---|---|---|---|---|---|---|
| Haiku 5.5 (orchestrator) | 1 | 218 | 2,205 | 0 | 11,818 | $0.003 |
| Sonnet 5.5 (specialists) | 6 (one empty answer retried) | 10,934 | 24,883 | 60,770 | 12,154 | $0.313 |
| Opus 5.5 (skeptic + writer) | 2 | 16,124 | 8,578 | 0 | 23,798 | $0.355 |
| **Total** | 9 | | | | | **$0.671** |

Wall time: 218 s (21 evidence rows from 26 public requests, then 199 s of model time).
This run was dearer than the replay runs because of the retried specialist and longer specialist
answers. **Plan on $0.30–0.70 per Quick report, about $0.50 typical.**

## Where the money goes

- **Opus is about 65% of the cost.** The skeptic and the writer each pay a fresh cache write for
  the evidence pack (cache reads = 0). The likely cause is that the two calls use different
  output schemas, so the prompt prefix differs. Cheapest next saving: give the writer only the
  surviving findings instead of the full evidence pack (about $0.05–0.10 per report). Not yet
  verified live.
- **Sonnet caching works:** after the first specialist writes the cache, the other four read it
  (12,054 tokens each on the largest case).
- **Haiku is negligible** (about $0.002).

## All live spend tonight (overnight build)

| Run | Reports | Cost |
|---|---|---|
| First harness test (one benchmark) | 1 | $0.83 |
| Eval run 1 (3 benchmarks + Haiku judge) | 3 | $1.30 |
| End-to-end test through the order flow (local store) | 1 | $0.36 |
| Eval run 2, final prompts (3 benchmarks + judge) | 3 | $1.09 |
| Real end-to-end on Supabase (the one allowed after the limit) | 1 | $0.67 |
| **Total** | **9** | **≈ $4.25** |

All of this ran before the "at most 3 live reports" instruction arrived, and it stayed under the $10 budget.
After that instruction, exactly one live run was made (the Supabase end-to-end).
