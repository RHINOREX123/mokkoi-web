import type { CSSProperties } from 'react'
import { Terminal } from 'lucide-react'

const COLORS = {
  bg: '#06080D',
  bgCard: '#0D1117',
  bgCardHover: '#151B25',
  border: '#1C2333',
  text: '#E6EDF3',
  textMuted: '#7D8590',
  textDim: '#484F58',
  accent: '#3B82F6',
  teal: '#14B8A6',
} as const

const sectionStyle: CSSProperties = {
  padding: '80px 24px',
  maxWidth: 1100,
  margin: '0 auto',
}

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 48,
  alignItems: 'center',
}

const labelStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: COLORS.teal,
  fontFamily: "'Space Mono', monospace",
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 12,
}

const headingStyle: CSSProperties = {
  fontSize: 32,
  fontWeight: 700,
  color: COLORS.text,
  fontFamily: "'DM Sans', sans-serif",
  lineHeight: 1.2,
  marginBottom: 16,
}

const descriptionStyle: CSSProperties = {
  fontSize: 16,
  lineHeight: 1.7,
  color: COLORS.textMuted,
  fontFamily: "'DM Sans', sans-serif",
  marginBottom: 28,
  maxWidth: 460,
}

const linkButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 15,
  fontWeight: 600,
  color: COLORS.accent,
  fontFamily: "'DM Sans', sans-serif",
  background: 'none',
  border: `1px solid ${COLORS.accent}`,
  borderRadius: 10,
  padding: '10px 20px',
  cursor: 'pointer',
  textDecoration: 'none',
  transition: 'background 0.2s, color 0.2s',
}

const codeBlockStyle: CSSProperties = {
  background: COLORS.bgCard,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 12,
  padding: 0,
  overflow: 'hidden',
}

const codeHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '12px 16px',
  borderBottom: `1px solid ${COLORS.border}`,
  fontSize: 13,
  fontWeight: 500,
  color: COLORS.textMuted,
  fontFamily: "'Space Mono', monospace",
}

const codeBodyStyle: CSSProperties = {
  padding: '20px 20px',
  fontFamily: "'Space Mono', monospace",
  fontSize: 13,
  lineHeight: 1.8,
  overflowX: 'auto',
}

const lineStyle: CSSProperties = {
  margin: 0,
  whiteSpace: 'pre',
}

interface CodeLine {
  parts: Array<{ text: string; color: string }>
}

const codeLines: CodeLine[] = [
  {
    parts: [
      { text: '# Install the MCP server', color: COLORS.textDim },
    ],
  },
  {
    parts: [
      { text: 'npx ', color: COLORS.teal },
      { text: 'mokkoi-mcp', color: COLORS.text },
      { text: ' --install', color: COLORS.accent },
    ],
  },
  { parts: [{ text: '', color: 'transparent' }] },
  {
    parts: [
      { text: '# Generate a screen from your IDE', color: COLORS.textDim },
    ],
  },
  {
    parts: [
      { text: 'npx ', color: COLORS.teal },
      { text: 'mokkoi-mcp', color: COLORS.text },
      { text: ' generate', color: COLORS.accent },
      { text: ' --prompt ', color: COLORS.accent },
      { text: '"fitness dashboard"', color: '#A5D6FF' },
    ],
  },
  { parts: [{ text: '', color: 'transparent' }] },
  {
    parts: [
      { text: '# Import web code to mobile', color: COLORS.textDim },
    ],
  },
  {
    parts: [
      { text: 'npx ', color: COLORS.teal },
      { text: 'mokkoi-mcp', color: COLORS.text },
      { text: ' import', color: COLORS.accent },
      { text: ' --file ', color: COLORS.accent },
      { text: 'Dashboard.tsx', color: '#A5D6FF' },
    ],
  },
]

export function MCPSection() {
  return (
    <section style={sectionStyle} id="mcp">
      <div style={gridStyle}>
        {/* Left column - text */}
        <div>
          <div style={labelStyle}>For Developers</div>
          <h2 style={headingStyle}>
            Build mobile apps
            <br />
            from your IDE
          </h2>
          <p style={descriptionStyle}>
            Use the Mokkoi MCP server with Claude Code, Cursor, or any
            MCP-compatible client. Generate screens, import web components,
            and export full Expo projects without leaving your editor.
          </p>
          <a
            href="https://www.npmjs.com/package/mokkoi-mcp"
            target="_blank"
            rel="noopener noreferrer"
            style={linkButtonStyle}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLElement).style.background =
                'rgba(59,130,246,0.1)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.background = 'none'
            }}
          >
            View on npm &rarr;
          </a>
        </div>

        {/* Right column - code block */}
        <div style={codeBlockStyle}>
          <div style={codeHeaderStyle}>
            <Terminal size={14} color={COLORS.textMuted} />
            Terminal
          </div>
          <div style={codeBodyStyle}>
            {codeLines.map((line, i) => (
              <div key={i} style={lineStyle}>
                {line.parts.map((part, j) => (
                  <span key={j} style={{ color: part.color }}>
                    {part.text}
                  </span>
                ))}
                {line.parts.length === 1 && line.parts[0].text === '' && (
                  <span>&nbsp;</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
