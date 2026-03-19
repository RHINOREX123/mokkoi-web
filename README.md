# Mokkoi — AI-Powered React Native Screen Designer

The only design tool where AI agents create mobile screens that appear on a live canvas.

## What is Mokkoi?

Mokkoi is an AI-powered design tool for React Native mobile apps. It combines:
- **Visual Canvas** — Figma-style infinite canvas with phone frame previews
- **AI Generation** — Claude Sonnet/Haiku generates production-ready React Native screens
- **MCP Server** — The only React Native MCP server. Works with Claude Code and Cursor.
- **Bidirectional Sync** — Generate from CLI → edit on canvas → sync back to code

## Quick Start

### Web App (mokkoi.com)
Visit [mokkoi.com](https://mokkoi.com), sign up, and start designing.

### MCP Server (for developers)
```bash
# Add to Claude Code
claude mcp add mokkoi -- npx mokkoi-mcp

# Or run directly
npx mokkoi-mcp
```

Set your Anthropic API key:
```
MOKKOI_API_KEY=sk-ant-your-key
```

Then in Claude Code:
```
> Create a fitness home screen with dark theme and bottom navigation
```

## Features

- AI screen generation from text prompts
- Screenshot-to-screen conversion (drop any screenshot → get RN code)
- Multi-screen flow generation with navigation
- Direct edit mode (click elements to change text, colors, sizes)
- Smart model routing (Sonnet for new screens, Haiku for edits)
- Prompt caching (90% token savings)
- Canvas sync (MCP screens appear on web canvas in real-time)
- Code export (production-ready .tsx files)
- Project sharing with public links

## Tech Stack

- **Frontend:** React + TypeScript + Vite
- **Backend:** Vercel Serverless Functions
- **Database:** Supabase (PostgreSQL + Realtime)
- **AI:** Anthropic Claude (Sonnet 4 + Haiku 4.5)
- **MCP Server:** TypeScript, published as `mokkoi-mcp` on npm
- **Preview:** react-native-web for live phone frame rendering

## MCP Server Tools

| Tool | Description |
|------|-------------|
| generate_screen | Create a screen from text prompt |
| edit_screen | Modify an existing screen |
| screenshot_to_screen | Convert screenshot to RN code |
| generate_flow | Create multi-screen flow with navigation |
| list_templates | Browse 28 templates across 10 categories |
| sync_from_canvas | Pull canvas changes to local files |
| watch_canvas | Check for recent screen changes |

## Open Source

Mokkoi is open source. Self-host with your own API key (BYOK):
```bash
git clone https://github.com/rhinorex123/mokkoi-web.git
cd mokkoi-web
npm install
cp .env.example .env  # Add your keys
npm run dev
```

## License

MIT
