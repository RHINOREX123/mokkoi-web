import { generateFlow as apiGenerateFlow, type ComponentNode } from '../utils/api-client.js';
import {
  componentTreeToTSX,
  generateNavigationTSX,
  writeScreenFile,
} from '../utils/file-writer.js';
import { saveFlowToProject, isCanvasSyncEnabled } from '../utils/supabase-client.js';

export const generateFlowTool = {
  name: 'generate_flow',
  description:
    'Generate a multi-screen flow (e.g. onboarding, auth, checkout). Creates separate .tsx files for each screen plus a Navigation.tsx file connecting them.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      prompt: {
        type: 'string',
        description:
          'Description of the flow (e.g. "onboarding flow for a fitness app with welcome, goal selection, and profile setup")',
      },
      outputDir: {
        type: 'string',
        description: 'Directory for generated files (default: ./screens/)',
      },
      screenCount: {
        type: 'number',
        description: 'Desired number of screens (3-5, default: API decides)',
      },
    },
    required: ['prompt'],
  },
};

export async function handleGenerateFlow(args: {
  prompt: string;
  outputDir?: string;
  screenCount?: number;
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  try {
    // Enhance prompt with screen count hint
    let enhancedPrompt = args.prompt;
    if (args.screenCount) {
      enhancedPrompt += `. Generate exactly ${args.screenCount} screens.`;
    }

    // Call mokkoi.com flow API
    const response = await apiGenerateFlow({ prompt: enhancedPrompt });
    const screens = response.screens;

    const outputDir = args.outputDir || 'screens';
    const writtenFiles: string[] = [];
    const screenMeta: Array<{ name: string; fileName: string }> = [];

    // Write each screen as a separate .tsx file
    for (const screen of screens) {
      const safeName = screen.name.replace(/[^a-zA-Z0-9]/g, '');
      const fileName = `${safeName}.tsx`;
      const filePath = `${outputDir}/${fileName}`;

      const tsxContent = componentTreeToTSX(screen.tree, safeName);
      await writeScreenFile(filePath, tsxContent);

      writtenFiles.push(fileName);
      screenMeta.push({ name: screen.name, fileName });
    }

    // Generate Navigation.tsx
    const navContent = generateNavigationTSX(screenMeta);
    const navPath = `${outputDir}/Navigation.tsx`;
    await writeScreenFile(navPath, navContent);

    // Sync to canvas
    let canvasSynced = 0;
    if (isCanvasSyncEnabled()) {
      const saved = await saveFlowToProject(
        screens.map(s => ({
          name: s.name,
          componentTree: s.tree,
          originalPrompt: args.prompt,
        }))
      );
      canvasSynced = saved.length;
    }

    const result = {
      success: true,
      screens: writtenFiles,
      navigation: 'Navigation.tsx',
      outputDir,
      totalScreens: screens.length,
      model: response.modelUsed,
      canvasSynced,
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
