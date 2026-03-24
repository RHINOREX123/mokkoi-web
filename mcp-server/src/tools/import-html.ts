import type { ComponentNode } from '../utils/api-client.js';
import { importHtml as apiImportHtml } from '../utils/api-client.js';
import { componentTreeToTSX, writeScreenFile } from '../utils/file-writer.js';
import { saveScreenToProject, isCanvasSyncEnabled } from '../utils/supabase-client.js';

export const importHtmlTool = {
  name: 'import_html',
  description:
    'Convert HTML/CSS/React/Tailwind web code into a React Native mobile screen. Use this when a user has web code from Stitch, v0, Bolt, Lovable, or any web design tool and wants a mobile version.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      code: {
        type: 'string',
        description:
          'The HTML/CSS/React/Tailwind code to convert to React Native',
      },
      source: {
        type: 'string',
        enum: ['stitch', 'v0', 'bolt', 'lovable', 'other'],
        description: 'Which tool the code came from (optional, auto-detected)',
      },
      screenName: {
        type: 'string',
        description: 'Name for the generated screen (optional, auto-detected)',
      },
      outputPath: {
        type: 'string',
        description:
          'File path for the generated .tsx file (default: ./screens/[ScreenName].tsx)',
      },
    },
    required: ['code'],
  },
};

export async function handleImportHtml(args: {
  code: string;
  source?: 'stitch' | 'v0' | 'bolt' | 'lovable' | 'other';
  screenName?: string;
  outputPath?: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  try {
    // Call mokkoi.com API
    const response = await apiImportHtml({
      code: args.code,
      source: args.source,
      screenName: args.screenName,
    });

    const tree: ComponentNode = response.screen.tree;
    const screenName = response.screen.name || 'ImportedScreen';
    const filePath = args.outputPath || `screens/${screenName}.tsx`;

    // Convert tree to .tsx and write file
    const tsxContent = componentTreeToTSX(tree, screenName);
    const absolutePath = await writeScreenFile(filePath, tsxContent);

    // Sync to canvas
    let canvasSync = false;
    let screenId: string | undefined;
    let projectId: string | undefined;
    let viewUrl: string | undefined;

    if (isCanvasSyncEnabled()) {
      const saved = await saveScreenToProject({
        name: screenName,
        componentTree: tree,
        originalPrompt: `[Imported from ${response.screen.detectedSource || 'web'}]`,
      });
      if (saved) {
        canvasSync = true;
        screenId = saved.id;
        projectId = saved.projectId;
        viewUrl = saved.viewUrl;
      }
    }

    const result: Record<string, unknown> = {
      success: true,
      filePath,
      absolutePath,
      screenName,
      detectedSource: response.screen.detectedSource,
      detectedColors: response.screen.detectedColors,
      conversionNotes: response.screen.conversionNotes,
      canvasSynced: canvasSync,
    };

    if (screenId) result.screenId = screenId;
    if (projectId) result.projectId = projectId;
    if (viewUrl) {
      result.viewUrl = viewUrl;
      result.message = `Screen imported and saved to Mokkoi. View it at ${viewUrl}`;
    }

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
