import type { DesignTokens } from '../types/mokkoi'

interface TokenPanelProps {
  tokens: DesignTokens
}

function ColorSwatch({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5 group">
      <div
        className="w-5 h-5 rounded-md ring-1 ring-white/[0.06] shrink-0"
        style={{ backgroundColor: value }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-[12px] text-mokkoi-text-muted truncate">{name}</div>
      </div>
      <code className="text-[10px] font-mono text-mokkoi-text-dim opacity-0 group-hover:opacity-100 transition-opacity">
        {value}
      </code>
    </div>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-medium tracking-wider uppercase text-mokkoi-text-dim mb-2 mt-5 first:mt-0">
      {children}
    </div>
  )
}

export function TokenPanel({ tokens }: TokenPanelProps) {
  return (
    <aside className="w-[280px] min-w-[280px] h-full border-l border-white/[0.06] bg-[#09090b] overflow-y-auto">
      <div className="px-5 pt-6 pb-2">
        <h2 className="text-[13px] font-semibold text-mokkoi-text tracking-[-0.2px]">
          Design Tokens
        </h2>
        <p className="text-[11px] text-mokkoi-text-dim mt-1">
          Active theme configuration
        </p>
      </div>

      <div className="px-5 pb-6">
        {/* Colors */}
        <SectionHeader>Colors</SectionHeader>
        <div className="space-y-0.5">
          {Object.entries(tokens.colors).map(([name, value]) => (
            <ColorSwatch key={name} name={name} value={value} />
          ))}
        </div>

        {/* Typography */}
        <SectionHeader>Typography</SectionHeader>
        <div className="space-y-2">
          {Object.entries(tokens.fonts).map(([role, family]) => (
            <div key={role} className="py-1.5">
              <div className="text-[11px] text-mokkoi-text-dim mb-1">{role}</div>
              <div
                className="text-[13px] text-mokkoi-text"
                style={{ fontFamily: family }}
              >
                {family}
              </div>
            </div>
          ))}
        </div>

        {/* Spacing */}
        <SectionHeader>Spacing</SectionHeader>
        <div className="space-y-1.5">
          {Object.entries(tokens.spacing).map(([name, value]) => (
            <div key={name} className="flex items-center gap-3 py-1">
              <code className="text-[11px] font-mono text-mokkoi-text-dim w-8 shrink-0">
                {name}
              </code>
              <div className="flex-1 flex items-center gap-2">
                <div
                  className="h-2 rounded-sm bg-mokkoi-accent/20"
                  style={{ width: `${Math.min(value * 2, 100)}%` }}
                />
                <span className="text-[10px] font-mono text-mokkoi-text-dim shrink-0">
                  {value}px
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}
