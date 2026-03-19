import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseConfig } from './auth-helper.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Hardcoded sensible defaults — will be overridden by real data when available
  const defaults = {
    preferredColors: {
      primary: '#6366F1',
      secondary: '#818CF8',
      background: '#0F172A',
      surface: '#1E293B',
      text: '#F1F5F9',
      accent: '#34D399',
    },
    preferredSpacing: {
      cardPadding: 16,
      sectionGap: 24,
      screenPadding: 20,
      elementGap: 12,
    },
    commonlyAdded: ['bottom_tab_bar', 'status_bar', 'back_button', 'search_bar'],
    commonlyRemoved: ['placeholder_image', 'lorem_ipsum_text'],
    source: 'hardcoded_defaults',
  }

  // Try to enrich from design_patterns table
  const { url } = getSupabaseConfig()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (url && serviceKey) {
    try {
      const supabase = createClient(url, serviceKey)
      const { data: patterns } = await supabase
        .from('design_patterns')
        .select('pattern_type, pattern_data, frequency')
        .order('frequency', { ascending: false })
        .limit(50)

      if (patterns && patterns.length > 0) {
        defaults.source = 'learned_from_diffs'

        // Extract top color preferences
        const colorPatterns = patterns.filter(p => p.pattern_type === 'color_change')
        if (colorPatterns.length > 0) {
          const topColor = colorPatterns[0].pattern_data
          if (topColor?.to) {
            defaults.preferredColors.primary = topColor.to
          }
        }

        // Extract top spacing preferences
        const spacingPatterns = patterns.filter(p => p.pattern_type === 'spacing_change')
        if (spacingPatterns.length > 0) {
          const topSpacing = spacingPatterns[0].pattern_data
          if (topSpacing?.property === 'padding' && topSpacing?.to) {
            defaults.preferredSpacing.cardPadding = Number(topSpacing.to)
          }
        }

        // Extract commonly added components
        const addPatterns = patterns.filter(p => p.pattern_type === 'component_add')
        if (addPatterns.length > 0) {
          defaults.commonlyAdded = addPatterns.slice(0, 5).map(p => p.pattern_data?.type || 'unknown')
        }

        // Extract commonly removed components
        const removePatterns = patterns.filter(p => p.pattern_type === 'component_remove')
        if (removePatterns.length > 0) {
          defaults.commonlyRemoved = removePatterns.slice(0, 5).map(p => p.pattern_data?.type || 'unknown')
        }
      }
    } catch (e) {
      console.warn('Failed to load learned defaults from DB, using hardcoded:', e)
    }
  }

  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
  return res.status(200).json(defaults)
}
