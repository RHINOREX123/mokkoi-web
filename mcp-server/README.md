# Mokkoi MCP Server

AI-powered React Native screen generator for Claude Code and Cursor. Generate production-ready `.tsx` screens from text prompts, screenshots, or multi-screen flows — and optionally sync them to the [mokkoi.com](https://mokkoi.com) canvas in real-time.

## Quick Start

```bash
# Run directly (no install needed)
npx mokkoi-mcp

# Or add to Claude Code
claude mcp add mokkoi -- npx mokkoi-mcp

# Or add to Cursor (settings.json)
{
  "mcpServers": {
    "mokkoi": {
      "command": "npx",
      "args": ["mokkoi-mcp"],
      "env": {
        "MOKKOI_API_KEY": "your-anthropic-api-key"
      }
    }
  }
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MOKKOI_API_KEY` | Yes | Your Anthropic API key (BYOK — Bring Your Own Key) |
| `MOKKOI_API_URL` | No | API endpoint (default: `https://mokkoi.com`) |
| `MOKKOI_PROJECT_ID` | No | Project UUID for canvas sync |
| `MOKKOI_SUPABASE_URL` | No | Supabase URL for canvas sync |
| `MOKKOI_SUPABASE_ANON_KEY` | No | Supabase anon key for canvas sync |

## Tools

### `generate_screen`

Generate a React Native screen from a text description.

**Input:**
- `prompt` (required): Screen description
- `outputPath`: File path (default: `./screens/[Name].tsx`)
- `style`: `"dark"` or `"light"` (default: `"dark"`)
- `platform`: `"ios"` or `"android"` (default: `"ios"`)

**Example:**
```
Generate a fitness dashboard with workout stats, progress rings, and a start workout button
```

**Output:** Creates `screens/FitnessDashboard.tsx` with a complete React Native component.

---

### `edit_screen`

Modify an existing screen with natural language instructions.

**Input:**
- `filePath` (required): Path to the `.tsx` file
- `instruction` (required): What to change

**Example:**
```
filePath: "screens/FitnessDashboard.tsx"
instruction: "change the background to white and make the text dark"
```

---

### `screenshot_to_screen`

Convert a screenshot into a React Native screen.

**Input:**
- `imagePath` (required): Path to screenshot (PNG, JPG, WEBP)
- `outputPath`: Output `.tsx` path
- `additionalInstructions`: Extra styling instructions

**Example:**
```
imagePath: "designs/home-screen.png"
additionalInstructions: "use dark theme and add bottom navigation"
```

---

### `generate_flow`

Generate a multi-screen flow with navigation.

**Input:**
- `prompt` (required): Flow description
- `outputDir`: Output directory (default: `./screens/`)
- `screenCount`: Number of screens (3-5)

**Example:**
```
Generate an onboarding flow for a fitness app: welcome screen, goal selection, profile setup, and success screen
```

**Output:** Creates individual `.tsx` files plus a `Navigation.tsx` with React Navigation stack.

---

### `list_templates`

Browse available screen templates for inspiration.

**Input:**
- `category`: Filter by category

**Categories:** `fitness`, `ecommerce`, `social`, `finance`, `productivity`, `onboarding`, `settings`, `profile`, `dashboard`, `auth`

## Canvas Sync (Optional)

When `MOKKOI_PROJECT_ID`, `MOKKOI_SUPABASE_URL`, and `MOKKOI_SUPABASE_ANON_KEY` are set, screens generated via MCP automatically appear on the mokkoi.com canvas in real-time.

MCP-generated screens show a green "MCP" badge on the canvas to distinguish them from web-created screens.

### Setup

1. Open your project on [mokkoi.com](https://mokkoi.com)
2. Copy the project ID from the URL: `mokkoi.com/app/projects/{PROJECT_ID}`
3. Set the environment variables:

```bash
export MOKKOI_PROJECT_ID="your-project-uuid"
export MOKKOI_SUPABASE_URL="https://your-project.supabase.co"
export MOKKOI_SUPABASE_ANON_KEY="your-anon-key"
```

## BYOK (Bring Your Own Key)

Mokkoi uses your Anthropic API key for AI generation. Your key is sent directly to the Anthropic API via mokkoi.com's serverless functions — it is never stored.

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build
```

## License

MIT
