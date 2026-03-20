# Mokkoi — YC S26 Positioning

## One-Line Pitch
The only MCP server that generates production React Native screens with live preview — turning AI coding agents into mobile designers.

## Problem
React Native developers using AI coding tools (Claude Code, Cursor, Windsurf) can generate backend code, API routes, and web components instantly — but mobile UI is still a manual slog. There's no AI tool that outputs **production-quality React Native code** for individual screens.

- **Google Stitch** generates beautiful UI but outputs HTML/CSS, React, and Tailwind — **not React Native**
- **Rork** builds full React Native apps but generates entire apps, not individual screens — unusable for existing projects
- **v0 by Vercel** outputs React/Next.js with shadcn — web only, no mobile
- **Lovable/Bolt.new** generate full web apps — no mobile output at all

A React Native developer who wants to prototype a new screen in their existing Expo app has **zero AI tools** that integrate into their workflow. They either design in Figma and hand-code, or use Stitch and manually rewrite the output to React Native.

## Why Now

1. **MCP is becoming the standard** for AI tool integration. Claude Code, Cursor, Windsurf, and Copilot all support MCP servers. The developer who installs `npx mokkoi-mcp-server` gets AI-generated screens inside their existing workflow — no context switching.

2. **Google Stitch validates the market** but explicitly doesn't serve React Native. Stitch proves developers want AI-generated UI. Mokkoi captures the mobile-native segment Google ignores.

3. **React Native is growing**. Expo's adoption is accelerating. Companies like Shopify, Microsoft, Meta, and Discord use React Native. The ecosystem has millions of developers who need better design tooling.

4. **The "last mile" problem in AI coding** — AI agents can write business logic but struggle with visual design. Mokkoi is the design skill that completes the AI coding agent's capability.

## Moat

**Only MCP server that generates production React Native screens with live preview.**

This creates three interlocking defensibility layers:

1. **Format lock-in**: Our component tree JSON format becomes the interchange standard for AI-generated React Native UI. Every screen generated through Mokkoi uses our format, creating a growing corpus of design patterns.

2. **Design system enforcement**: Our normalizer validates every generated tree against design tokens — spacing, typography, color, touch targets. Competitors that bolt on RN export won't have this quality layer.

3. **MCP network effects**: As developers install mokkoi-mcp-server, their AI agents learn to generate better React Native UI. The more developers use it, the more screen patterns we see, the better we can fine-tune.

## Market Size

- **React Native developers**: ~2M+ active developers (estimated from npm downloads: react-native gets 2M+ weekly downloads)
- **Expo developers**: Growing rapidly, 500K+ monthly active
- **AI coding tool users**: Claude Code, Cursor, and Copilot collectively have millions of users
- **Intersection**: React Native developers using AI coding tools — our core market

**TAM**: $500M (developer tools for mobile)
**SAM**: $50M (AI-assisted React Native development)
**SOM**: $5M (first year, credit-based revenue from pro users)

## Revenue Model

Credit-based SaaS:
- **Free**: 5 screens/day (Haiku model — lower quality, hooks users)
- **Pro ($9/month)**: 50 screens/day (Sonnet model — production quality)
- **Team ($29/month)**: 200 screens/day + shared projects + priority generation
- **Enterprise ($49+/month)**: Unlimited + custom design system training + API access

**Unit economics**: Each screen generation costs ~$0.01-0.05 in API calls. At $9/month with typical usage of 100 screens/month, gross margin is ~90%.

## Competitive Advantages

| | Mokkoi | Google Stitch | Rork | v0 |
|---|---|---|---|---|
| React Native output | **Yes** | No (HTML/React) | Yes (full apps) | No (React/Next.js) |
| MCP server | **Yes** | Yes | No | No |
| Individual screen generation | **Yes** | Yes | No (full apps) | Yes (web only) |
| Design system enforcement | **Yes** (normalizer) | Partial (DESIGN.md) | No | No |
| Live phone preview | **Yes** | Web preview | App preview | Web preview |
| Per-screen editing | **Yes** | Yes | Limited | Yes |
| Price | $0-49/mo | Free | $25-200/mo | $0-20/mo |

## Why Google/Rork Won't Build This

**Google** pushes Flutter/Dart and Material Design. Supporting React Native in Stitch would mean supporting a Meta-owned framework — unlikely to be a priority. Google's strategy is to make Stitch the best web/Flutter design tool, not to serve the React Native ecosystem.

**Rork** builds full apps — their value prop is "describe an app, get an app." Individual screen generation is the opposite of their product strategy. They optimize for app-level generation, not component-level iteration. Adding MCP support would require rearchitecting their entire pipeline.

## Traction (as of March 2026)

- MCP server published on npm (`npx mokkoi-mcp-server`)
- Live web app with phone frame preview
- 26-category content library
- 10 supported React Native component types
- Design system with enforced token scales
- Dark + light theme support
- Multi-screen flow generation
- Screenshot-to-screen generation

## Team

[To be filled]

## Ask

$500K on a SAFE to:
1. Ship P1 features (DESIGN.md ecosystem, code export, quality improvements)
2. Build Expo integration (generate screens directly into Expo projects)
3. Grow MCP server adoption (developer advocacy, documentation, tutorials)
4. Reach 1,000 weekly active MCP users by end of Q3 2026
