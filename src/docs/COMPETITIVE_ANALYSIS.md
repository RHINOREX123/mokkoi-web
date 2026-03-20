# Competitive Analysis — March 2026

## Competitive Matrix

| Feature | Mokkoi | Google Stitch | Rork | v0 (Vercel) | Lovable | Bolt.new |
|---------|--------|---------------|------|-------------|---------|----------|
| **Output format** | RN component tree JSON | HTML/CSS, React, Tailwind, Figma | RN (full app) | React/Next.js/shadcn | React | React |
| **React Native** | Yes (core) | No | Yes (full apps only) | No | No | No |
| **Individual screens** | Yes | Yes | No (full apps) | Yes (web) | No (full apps) | No (full apps) |
| **MCP server** | Yes | Yes | No | No | No | No |
| **Design system** | Enforced tokens + normalizer | DESIGN.md import | No formal system | shadcn/Tailwind | Tailwind | Tailwind |
| **Live preview** | Phone frame | Web preview | App preview | Web preview | Web preview | Web preview |
| **Multi-screen flows** | Yes (3-5 screens) | Yes (infinite canvas) | Yes (full navigation) | No | Yes (full app) | Yes (full app) |
| **Screenshot input** | Yes | Yes | No | Yes | No | No |
| **Design import** | DESIGN.md | DESIGN.md native | No | No | No | No |
| **Voice input** | No | Yes | No | No | No | No |
| **Code export** | JSON tree (RN .tsx planned) | HTML/CSS/React/Figma | Full Expo project | React components | Full codebase | Full codebase |
| **Pricing** | Free-$49/mo | Free | $25-200/mo | Free-$20/mo | Free-$25/mo | Free-$25/mo |
| **Model** | Claude (Haiku/Sonnet) | Gemini | Unknown | Unknown | Claude/GPT | Claude/GPT |

## Detailed Analysis

### Google Stitch
**What it is:** Google Labs' AI UI design tool. Infinite canvas, DESIGN.md support, React/HTML/CSS/Tailwind export, MCP server, voice input.

**March 2026 update:** Massive feature drop — infinite canvas, voice interaction, DESIGN.md as the design system interchange format, MCP server for agentic workflows, instant prototyping, and multi-format export.

**Strengths:**
- Google's AI quality (Gemini models)
- Free to use
- Infinite canvas with multi-screen design
- DESIGN.md as interchange format (becoming a standard)
- Voice-to-UI generation
- Multiple export formats (HTML, React, Tailwind, Figma)
- MCP server for AI agent integration

**Weaknesses:**
- **No React Native output** — this is the critical gap
- Web-focused design language (not iOS/Android native)
- Designs tend toward Material Design aesthetic
- No enforced design system (DESIGN.md is optional)
- Generated code may not be production-ready

**Mokkoi advantage:** React Native output. Stitch users who need RN code must manually convert.

### Rork
**What it is:** AI mobile app builder. Generates full React Native/Expo apps from natural language descriptions. Recently raised $2.8M from a16z. Launched Rork Max (native Swift).

**Strengths:**
- Generates complete apps (navigation, state management, APIs)
- React Native + Expo output
- Swift output (Rork Max)
- Strong VC backing (a16z)
- Active development

**Weaknesses:**
- **Full-app only** — can't generate individual screens for existing projects
- **No MCP server** — no integration with AI coding tools
- **No design system import/export** — no DESIGN.md support
- Expensive ($25-200/month)
- Black box — hard to iterate on specific screens
- Design quality is functional, not polished

**Mokkoi advantage:** Per-screen iteration, MCP integration, design system enforcement, lower price.

### v0 by Vercel
**What it is:** AI code generator for React/Next.js components. Uses shadcn/ui design system.

**Strengths:**
- High design quality (shadcn aesthetic)
- Fast iteration
- Good at web components
- Free tier available
- Strong brand (Vercel)

**Weaknesses:**
- **Web only** — no React Native
- **No MCP server**
- Limited to React/Next.js + shadcn
- No mobile-native design considerations
- No design system customization

**Mokkoi advantage:** React Native output, MCP server, mobile-native design tokens.

### Lovable
**What it is:** AI full-stack web app builder. Generates complete React applications.

**Strengths:**
- Full app generation
- Database + auth integration
- Deployment included
- Good design quality

**Weaknesses:**
- **Web only** — no React Native
- **No MCP server**
- Full app focus (not individual screens)
- Limited customization

**Mokkoi advantage:** React Native, per-screen generation, MCP integration.

### Bolt.new
**What it is:** AI web app builder in the browser. Full-stack generation.

**Strengths:**
- In-browser development
- Multiple framework support
- Fast generation

**Weaknesses:**
- **Web only** — no React Native
- Quality can be inconsistent
- No design system enforcement

### Paper.design
**Status:** Limited information available. Appears to be an early-stage AI design tool.

## Strategic Implications

### Mokkoi's Unique Position
Mokkoi occupies a specific niche that no competitor serves:
**AI-generated individual React Native screens with design system enforcement, accessible via MCP server.**

This is the intersection of:
1. React Native output (only Mokkoi + Rork)
2. Individual screen generation (only Mokkoi, not Rork)
3. MCP server integration (only Mokkoi + Stitch)
4. Design system enforcement (only Mokkoi)

### Threat Assessment

| Threat | Likelihood | Impact | Response |
|--------|-----------|--------|----------|
| Stitch adds RN output | Low (Google pushes Flutter) | High | Deepen MCP + normalizer quality |
| Rork adds MCP server | Medium | Medium | Emphasize per-screen speed + design system |
| v0 adds mobile | Medium | High | Lock in RN-specific features |
| New entrant | High | Medium | Move fast on P1 features |

### Opportunity: Stitch → Mokkoi Pipeline
The biggest near-term opportunity is **interoperability with Stitch**:
1. Designer uses Stitch to explore UI concepts (free, fast, visual)
2. Designer exports DESIGN.md from Stitch
3. Developer imports DESIGN.md into Mokkoi
4. Mokkoi generates React Native screens matching the Stitch design

This makes Mokkoi the **"last mile" converter** from Stitch's web designs to React Native code.
