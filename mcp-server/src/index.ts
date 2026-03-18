#!/usr/bin/env node

/**
 * Mokkoi MCP Server
 *
 * AI-powered React Native screen generator for Claude Code and Cursor.
 * Generates production-ready .tsx files from text prompts, screenshots, or multi-screen flows.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { generateScreenTool, handleGenerateScreen } from './tools/generate-screen.js';
import { editScreenTool, handleEditScreen } from './tools/edit-screen.js';
import { screenshotToScreenTool, handleScreenshotToScreen } from './tools/screenshot-to-screen.js';
import { generateFlowTool, handleGenerateFlow } from './tools/generate-flow.js';
import { listTemplatesTool, handleListTemplates } from './tools/list-templates.js';

const server = new Server(
  {
    name: 'mokkoi-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// All registered tools
const TOOLS = [
  generateScreenTool,
  editScreenTool,
  screenshotToScreenTool,
  generateFlowTool,
  listTemplatesTool,
];

// Handle tools/list
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

// Handle tools/call
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'generate_screen':
      return handleGenerateScreen(args as Parameters<typeof handleGenerateScreen>[0]);

    case 'edit_screen':
      return handleEditScreen(args as Parameters<typeof handleEditScreen>[0]);

    case 'screenshot_to_screen':
      return handleScreenshotToScreen(args as Parameters<typeof handleScreenshotToScreen>[0]);

    case 'generate_flow':
      return handleGenerateFlow(args as Parameters<typeof handleGenerateFlow>[0]);

    case 'list_templates':
      return handleListTemplates(args as Parameters<typeof handleListTemplates>[0]);

    default:
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              error: `Unknown tool: ${name}`,
              availableTools: TOOLS.map(t => t.name),
            }),
          },
        ],
      };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Mokkoi MCP Server running on stdio');
  console.error(`API URL: ${process.env.MOKKOI_API_URL || 'https://mokkoi.com'}`);
  console.error(`Canvas sync: ${process.env.MOKKOI_PROJECT_ID ? 'enabled' : 'disabled'}`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
