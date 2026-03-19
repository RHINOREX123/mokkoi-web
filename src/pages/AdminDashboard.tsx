import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface Stats {
  totalGenerations: number
  totalEdits: number
  activeUsers: number
  generationsPerDay: { date: string; count: number }[]
  topPatterns: { pattern_type: string; pattern_data: any; frequency: number }[]
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    if (!supabase) {
      setError('Supabase not configured')
      setLoading(false)
      return
    }

    try {
      const [genResult, editResult, usersResult, dailyResult, patternsResult] = await Promise.all([
        supabase.from('usage_logs').select('*', { count: 'exact', head: true }),
        supabase.from('edit_diffs').select('*', { count: 'exact', head: true }),
        supabase.from('subscriptions').select('*', { count: 'exact', head: true }),
        supabase.from('usage_logs').select('created_at').order('created_at', { ascending: false }).limit(500),
        supabase.from('design_patterns').select('pattern_type, pattern_data, frequency').order('frequency', { ascending: false }).limit(10),
      ])

      // Aggregate generations per day
      const dayCounts = new Map<string, number>()
      if (dailyResult.data) {
        for (const row of dailyResult.data) {
          const day = new Date(row.created_at).toISOString().slice(0, 10)
          dayCounts.set(day, (dayCounts.get(day) || 0) + 1)
        }
      }
      const generationsPerDay = Array.from(dayCounts.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-14) // Last 14 days

      setStats({
        totalGenerations: genResult.count ?? 0,
        totalEdits: editResult.count ?? 0,
        activeUsers: usersResult.count ?? 0,
        generationsPerDay,
        topPatterns: patternsResult.data ?? [],
      })
    } catch (e: any) {
      setError(e.message || 'Failed to load stats')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0A0A0A', color: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ opacity: 0.6 }}>Loading analytics...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#0A0A0A', color: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#EF4444' }}>{error}</p>
      </div>
    )
  }

  const maxDailyCount = Math.max(1, ...((stats?.generationsPerDay ?? []).map(d => d.count)))

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0A', color: '#F1F5F9', padding: 32 }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Mokkoi Admin</h1>
        <p style={{ opacity: 0.5, marginBottom: 32, fontSize: 14 }}>Internal analytics dashboard</p>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 40 }}>
          <StatCard label="Total Generations" value={stats?.totalGenerations ?? 0} />
          <StatCard label="Total Edits Captured" value={stats?.totalEdits ?? 0} />
          <StatCard label="Active Users" value={stats?.activeUsers ?? 0} />
          <StatCard label="Revenue" value="Connect Stripe" isPlaceholder />
        </div>

        {/* Generations per day chart */}
        <div style={{ background: '#111', borderRadius: 12, padding: 24, marginBottom: 32, border: '1px solid #222' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Generations per Day</h2>
          {(stats?.generationsPerDay ?? []).length === 0 ? (
            <p style={{ opacity: 0.4, fontSize: 14 }}>No data yet</p>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 160 }}>
              {(stats?.generationsPerDay ?? []).map((d) => (
                <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 10, opacity: 0.6 }}>{d.count}</span>
                  <div
                    style={{
                      width: '100%',
                      maxWidth: 40,
                      height: `${(d.count / maxDailyCount) * 120}px`,
                      minHeight: 4,
                      background: 'linear-gradient(to top, #6366F1, #818CF8)',
                      borderRadius: 4,
                    }}
                  />
                  <span style={{ fontSize: 9, opacity: 0.4, whiteSpace: 'nowrap' }}>
                    {d.date.slice(5)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top edit patterns */}
        <div style={{ background: '#111', borderRadius: 12, padding: 24, border: '1px solid #222' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Top Edit Patterns</h2>
          {(stats?.topPatterns ?? []).length === 0 ? (
            <p style={{ opacity: 0.4, fontSize: 14 }}>No patterns extracted yet. Run the analyze-diffs endpoint first.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(stats?.topPatterns ?? []).map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: '#1A1A1A', borderRadius: 8 }}>
                  <PatternBadge type={p.pattern_type} />
                  <span style={{ flex: 1, fontSize: 13, fontFamily: 'monospace' }}>
                    {formatPatternData(p.pattern_data)}
                  </span>
                  <span style={{ fontSize: 13, opacity: 0.6 }}>{p.frequency}x</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <p style={{ marginTop: 32, opacity: 0.3, fontSize: 12, textAlign: 'center' }}>
          Mokkoi Admin &middot; Internal use only
        </p>
      </div>
    </div>
  )
}

function StatCard({ label, value, isPlaceholder }: { label: string; value: number | string; isPlaceholder?: boolean }) {
  return (
    <div style={{ background: '#111', borderRadius: 12, padding: 20, border: '1px solid #222' }}>
      <p style={{ fontSize: 12, opacity: 0.5, marginBottom: 4 }}>{label}</p>
      <p style={{
        fontSize: isPlaceholder ? 14 : 28,
        fontWeight: 700,
        color: isPlaceholder ? '#818CF8' : '#F1F5F9',
        opacity: isPlaceholder ? 0.7 : 1,
      }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
    </div>
  )
}

function PatternBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    color_change: '#818CF8',
    spacing_change: '#34D399',
    component_add: '#60A5FA',
    component_remove: '#F87171',
  }
  return (
    <span style={{
      fontSize: 11,
      padding: '2px 8px',
      borderRadius: 6,
      background: (colors[type] || '#888') + '22',
      color: colors[type] || '#888',
      whiteSpace: 'nowrap',
    }}>
      {type.replace('_', ' ')}
    </span>
  )
}

function formatPatternData(data: any): string {
  if (!data) return '—'
  if (data.from && data.to && data.property) return `${data.property}: ${data.from} → ${data.to}`
  if (data.from && data.to) return `${data.from} → ${data.to}`
  if (data.type) return data.type + (data.name ? ` (${data.name})` : '')
  return JSON.stringify(data)
}
