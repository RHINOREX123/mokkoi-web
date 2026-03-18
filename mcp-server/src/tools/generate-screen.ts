import type { ComponentNode } from '../utils/api-client.js';
import { generateScreen as apiGenerateScreen } from '../utils/api-client.js';
import { componentTreeToTSX, writeScreenFile } from '../utils/file-writer.js';
import { saveScreenToProject, isCanvasSyncEnabled } from '../utils/supabase-client.js';

export const generateScreenTool = {
  name: 'generate_screen',
  description:
    'Generate a React Native screen from a text prompt. Creates a .tsx file and optionally syncs to the mokkoi.com canvas.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      prompt: {
        type: 'string',
        description:
          'Description of the screen to generate (e.g. "fitness dashboard with workout stats and progress rings")',
      },
      outputPath: {
        type: 'string',
        description:
          'File path for the generated .tsx file (default: ./screens/[ScreenName].tsx)',
      },
      style: {
        type: 'string',
        enum: ['dark', 'light'],
        description: 'Color theme for the screen (default: dark)',
      },
      platform: {
        type: 'string',
        enum: ['ios', 'android'],
        description: 'Target platform style (default: ios)',
      },
    },
    required: ['prompt'],
  },
};

export async function handleGenerateScreen(args: {
  prompt: string;
  outputPath?: string;
  style?: 'dark' | 'light';
  platform?: 'ios' | 'android';
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  try {
    // Enhance prompt with style/platform preferences
    let enhancedPrompt = args.prompt;
    if (args.style === 'light') {
      enhancedPrompt += '. Use a light/white background with dark text.';
    }
    if (args.platform === 'android') {
      enhancedPrompt += '. Use Material Design style (Android).';
    }

    // Call mokkoi.com API
    const response = await apiGenerateScreen({ prompt: enhancedPrompt });
    const tree: ComponentNode = response.tree;

    // Derive screen name from prompt
    const screenName = deriveScreenName(args.prompt);
    const filePath = args.outputPath || `screens/${screenName}.tsx`;

    // Convert tree to .tsx and write file
    const tsxContent = componentTreeToTSX(tree, screenName);
    const absolutePath = await writeScreenFile(filePath, tsxContent);

    // Sync to canvas if configured
    let canvasSync = false;
    if (isCanvasSyncEnabled()) {
      const saved = await saveScreenToProject({
        name: screenName,
        componentTree: tree,
        originalPrompt: args.prompt,
      });
      canvasSync = !!saved;
    }

    const result = {
      success: true,
      filePath,
      absolutePath,
      screenName,
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

/**
 * Derive a PascalCase screen name from a prompt.
 */
function deriveScreenName(prompt: string): string {
  // Extract key words, limit to 3
  const words = prompt
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w.toLowerCase()))
    .slice(0, 3)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

  if (words.length === 0) return 'GeneratedScreen';
  return words.join('');
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'for', 'with', 'that', 'this',
  'from', 'create', 'make', 'build', 'design', 'generate', 'screen',
  'page', 'app', 'mobile', 'react', 'native', 'please', 'can', 'you',
]);
