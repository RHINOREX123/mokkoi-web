import { Check, X } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'

interface RowData {
  capability: string
  mokkoi: boolean | string
  lovable: boolean | string
  rork: boolean | string
}

const rows: RowData[] = [
  {
    capability: 'React Native / Expo output',
    mokkoi: true,
    lovable: 'Web only',
    rork: true,
  },
  {
    capability: 'MCP integration (Claude Code / Cursor)',
    mokkoi: true,
    lovable: false,
    rork: false,
  },
  {
    capability: 'Multi-screen app generation',
    mokkoi: true,
    lovable: 'Web',
    rork: true,
  },
  {
    capability: 'Web-to-mobile import',
    mokkoi: true,
    lovable: 'N/A',
    rork: false,
  },
  {
    capability: 'Figma-style canvas',
    mokkoi: true,
    lovable: false,
    rork: false,
  },
  {
    capability: 'Screenshot to code',
    mokkoi: true,
    lovable: false,
    rork: false,
  },
  {
    capability: 'Export full Expo project',
    mokkoi: true,
    lovable: 'Web deploys',
    rork: true,
  },
]

const COLORS = {
  bg: '#06080D',
  bgCard: '#0D1117',
  bgCardHover: '#151B25',
  border: '#1C2333',
  text: '#E6EDF3',
  textMuted: '#7D8590',
  textDim: '#484F58',
  accent: '#2563EB',
  teal: '#14B8A6',
} as const

function CellValue({ value }: { value: boolean | string }): ReactNode {
  if (value === true) {
    return <Check size={18} color={COLORS.teal} strokeWidth={3} />
  }
  if (value === false) {
    return <X size={18} color={COLORS.textDim} strokeWidth={2} />
  }
  return (
    <span style={{ color: COLORS.textDim, fontSize: 13 }}>{value}</span>
  )
}

const containerStyle: CSSProperties = {
  width: '100%',
  maxWidth: 900,
  margin: '0 auto',
  background: COLORS.bgCard,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 16,
  overflow: 'hidden',
}

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontFamily: "'DM Sans', sans-serif",
}

const thBaseStyle: CSSProperties = {
  padding: '14px 20px',
  fontSize: 13,
  fontWeight: 600,
  textAlign: 'center',
  borderBottom: `1px solid ${COLORS.border}`,
  color: COLORS.textMuted,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const thCapabilityStyle: CSSProperties = {
  ...thBaseStyle,
  textAlign: 'left',
  color: COLORS.textMuted,
}

const thMokkoi: CSSProperties = {
  ...thBaseStyle,
  color: COLORS.text,
  background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(20,184,166,0.10))',
}

const tdBaseStyle: CSSProperties = {
  padding: '14px 20px',
  fontSize: 14,
  textAlign: 'center',
  borderBottom: `1px solid ${COLORS.border}`,
  color: COLORS.text,
}

const tdCapabilityStyle: CSSProperties = {
  ...tdBaseStyle,
  textAlign: 'left',
  fontWeight: 500,
}

export function ComparisonTable() {
  return (
    <section style={{ padding: '80px 24px' }}>
      <h2
        style={{
          textAlign: 'center',
          fontSize: 32,
          fontWeight: 700,
          color: COLORS.text,
          fontFamily: "'DM Sans', sans-serif",
          marginBottom: 12,
        }}
      >
        How Mokkoi compares
      </h2>
      <p
        style={{
          textAlign: 'center',
          fontSize: 16,
          color: COLORS.textMuted,
          fontFamily: "'DM Sans', sans-serif",
          marginBottom: 40,
          maxWidth: 520,
          marginLeft: 'auto',
          marginRight: 'auto',
        }}
      >
        The only AI tool built specifically for React Native mobile development.
      </p>

      <div style={containerStyle}>
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thCapabilityStyle}>Capability</th>
                <th style={thMokkoi}>Mokkoi</th>
                <th style={thBaseStyle}>Lovable / Bolt / v0</th>
                <th style={thBaseStyle}>Rork</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const isLast = i === rows.length - 1
                const rowBorder = isLast
                  ? { borderBottom: 'none' }
                  : {}

                return (
                  <tr
                    key={row.capability}
                    style={{
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      ;(e.currentTarget as HTMLElement).style.background =
                        COLORS.bgCardHover
                    }}
                    onMouseLeave={(e) => {
                      ;(e.currentTarget as HTMLElement).style.background =
                        'transparent'
                    }}
                  >
                    <td style={{ ...tdCapabilityStyle, ...rowBorder }}>
                      {row.capability}
                    </td>
                    <td
                      style={{
                        ...tdBaseStyle,
                        ...rowBorder,
                        background:
                          'linear-gradient(135deg, rgba(59,130,246,0.04), rgba(20,184,166,0.03))',
                      }}
                    >
                      <CellValue value={row.mokkoi} />
                    </td>
                    <td style={{ ...tdBaseStyle, ...rowBorder }}>
                      <CellValue value={row.lovable} />
                    </td>
                    <td style={{ ...tdBaseStyle, ...rowBorder }}>
                      <CellValue value={row.rork} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
