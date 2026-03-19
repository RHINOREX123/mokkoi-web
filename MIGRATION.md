# mokkoi-mcp-server → mokkoi-mcp Migration

The old `mokkoi-mcp-server` package has been replaced by `mokkoi-mcp`.

## Upgrade

```bash
# Remove old
npm uninstall mokkoi-mcp-server

# Install new
npx mokkoi-mcp

# Or add to Claude Code
claude mcp add mokkoi -- npx mokkoi-mcp
```

The new package includes: 7 tools, canvas sync, screenshot-to-screen, flow generation, and more. See https://www.npmjs.com/package/mokkoi-mcp
