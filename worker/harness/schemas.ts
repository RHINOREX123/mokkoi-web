// Strict JSON shapes for every model step (enforced by structured outputs, then re-checked in code).
import { z } from 'zod'

export const SeverityZ = z.enum(['critical', 'high', 'medium', 'low', 'info'])
export const SectionZ = z.enum(['listing_financials', 'tech_security', 'traffic_seo', 'market_platform', 'transferability'])

export const OrchestratorZ = z.object({
  business: z.object({
    name: z.string(),
    whatItDoes: z.string(),
    revenueModel: z.string(),
  }),
  claims: z.array(
    z.object({
      text: z.string().describe('One claim the seller makes, quoted or tightly paraphrased'),
      category: z.enum(['revenue', 'profit', 'customers', 'churn', 'traffic', 'age', 'stack', 'operations', 'costs', 'growth', 'other']),
      evidenceKeys: z.array(z.string()).describe('Evidence rows where the claim appears'),
    }),
  ),
  focus: z.array(z.string()).describe('Short notes on what the specialists should look at hardest'),
})
export type OrchestratorOut = z.infer<typeof OrchestratorZ>

export const SpecialistZ = z.object({
  findings: z.array(
    z.object({
      severity: SeverityZ,
      title: z.string().describe('One line, specific, plain English'),
      detail: z.string().describe('2-4 sentences: what the evidence shows and why a buyer should care'),
      evidenceKeys: z.array(z.string()).describe('Evidence rows that prove this, e.g. ["E5","E12"]'),
    }),
  ),
  claimChecks: z.array(
    z.object({
      claimIndex: z.number().int().describe('Index into the extracted claims list'),
      status: z.enum(['verified', 'unverified', 'contradicted']),
      finding: z.string().describe('What we found, one or two short sentences'),
      evidenceKeys: z.array(z.string()),
    }),
  ),
  strengths: z.array(z.object({ text: z.string(), evidenceKeys: z.array(z.string()) })),
  questions: z.array(z.string()).describe('Questions for the seller that the evidence raises'),
})
export type SpecialistOut = z.infer<typeof SpecialistZ>

export const SkepticZ = z.object({
  decisions: z.array(
    z.object({
      key: z.string().describe('Finding key, e.g. F3'),
      action: z.enum(['keep', 'downgrade', 'drop']),
      severity: SeverityZ.describe('Final severity (same as proposed when keeping)'),
      title: z.string().describe('Final title (fix overstatement if needed)'),
      detail: z.string().describe('Final detail (fix overstatement if needed)'),
      reason: z.string().describe('Why, citing evidence keys'),
    }),
  ),
  claimDecisions: z.array(
    z.object({
      key: z.string().describe('Claim check key, e.g. C2'),
      status: z.enum(['verified', 'unverified', 'contradicted']),
      finding: z.string(),
      reason: z.string(),
    }),
  ),
})
export type SkepticOut = z.infer<typeof SkepticZ>

export const WriterZ = z.object({
  headline: z.string().describe('One sentence verdict a buyer can repeat, under 20 words'),
  summary: z.array(z.string()).describe('3 to 5 short lines: would we keep looking at this deal, and why'),
  questions: z.array(z.string()).describe('5 to 8 questions for the seller, most important first, deduplicated'),
  verifyBeforeClosing: z.array(z.string()).describe('3 to 6 items to verify with seller access before closing'),
  valuation: z.string().describe('2-3 sentences: typical multiples for this kind of business and whether the asking price is in range. Empty string if no price is known.'),
  first30Days: z.array(z.string()).describe('3 to 5 concrete actions for the first 30 days after buying'),
  scoreAdjustment: z.number().int().describe('Between -10 and 10: nudge to the rubric score, 0 unless clearly justified'),
  adjustmentReason: z.string(),
})
export type WriterOut = z.infer<typeof WriterZ>
