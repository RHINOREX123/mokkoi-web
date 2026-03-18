import { readFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { generateScreen as apiGenerateScreen, type ComponentNode } from '../utils/api-client.js';
import { componentTreeToTSX, writeScreenFile } from '../utils/file-writer.js';
import { updateScreen, findScreenByName, isCanvasSyncEnabled } from '../utils/supabase-client.js';

export const editScreenTool = {
  name: 'edit_screen',
  description:
    'Edit an existing React Native screen by providing an instruction. Reads the current .tsx file, sends it with your edit request, and writes the updated file.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      filePath: {
        type: 'string',
        description: 'Path to the existing .tsx screen file to edit',
      },
      instruction: {
        type: 'string',
        description:
          'What to change (e.g. "make the background white", "add a search bar at the top", "change the button color to green")',
      },
    },
    required: ['filePath', 'instruction'],
  },
};

export async function handleEditScreen(args: {
  filePath: string;
  instruction: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  try {
    const absolutePath = resolve(process.cwd(), args.filePath);

    // Read the existing file
    let existingCode: string;
    try {
      existingCode = await readFile(absolutePath, 'utf-8');
    } catch {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: `File not found: ${args.filePath}`,
            }),
          },
        ],
      };
    }

    // Try to find matching screen in Supabase for the component tree
    const screenName = basename(args.filePath, '.tsx').replace(/Screen$/, '');
    let currentTree: ComponentNode | undefined;
    let screenId: string | undefined;

    if (isCanvasSyncEnabled()) {
      const found = await findScreenByName(screenName);
      if (found) {
        currentTree = found.component_tree;
        screenId = found.id;
      }
    }

    // Call mokkoi.com API with the existing code as context
    const response = await apiGenerateScreen({
      prompt: args.instruction,
      currentScreen: currentTree || existingCode,
      screenId,
      screenName,
    });

    const newTree: ComponentNode = response.tree;

    // Convert and write
    const tsxContent = componentTreeToTSX(newTree, screenName);
    await writeScreenFile(args.filePath, tsxContent);

    // Update canvas if synced
    let canvasSync = false;
    if (isCanvasSyncEnabled() && screenId) {
      canvasSync = await updateScreen(screenId, newTree, args.instruction);
    }

    const result = {
      success: true,
      filePath: args.filePath,
      screenName,
      changes: args.instruction,
      model: response.modelUsed,
      canvasSynced: canvasSync,
    };

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ success: false, error: message }),
        },
      ],
    };
  }
}
