import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { generateScreen as apiGenerateScreen, type ComponentNode } from '../utils/api-client.js';
import { componentTreeToTSX, writeScreenFile } from '../utils/file-writer.js';
import { saveScreenToProject, isCanvasSyncEnabled } from '../utils/supabase-client.js';

export const screenshotToScreenTool = {
  name: 'screenshot_to_screen',
  description:
    'Convert a screenshot/image into a React Native screen. Reads the image file, sends it to the AI, and generates a matching .tsx component.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      imagePath: {
        type: 'string',
        description: 'Path to the screenshot image file (PNG, JPG, WEBP)',
      },
      outputPath: {
        type: 'string',
        description:
          'Output path for the generated .tsx file (default: ./screens/ScreenFromImage.tsx)',
      },
      additionalInstructions: {
        type: 'string',
        description:
          'Extra instructions for the AI (e.g. "use dark theme", "make it more modern")',
      },
    },
    required: ['imagePath'],
  },
};

const MIME_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

export async function handleScreenshotToScreen(args: {
  imagePath: string;
  outputPath?: string;
  additionalInstructions?: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  try {
    const absoluteImagePath = resolve(process.cwd(), args.imagePath);

    // Read image and convert to base64
    let imageBuffer: Buffer;
    try {
      imageBuffer = await readFile(absoluteImagePath);
    } catch {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: `Image file not found: ${args.imagePath}`,
            }),
          },
        ],
      };
    }

    const ext = extname(args.imagePath).toLowerCase();
    const mimeType = MIME_MAP[ext] || 'image/png';
    const base64 = imageBuffer.toString('base64');

    // Build prompt
    const prompt = args.additionalInstructions
      ? `Recreate this screenshot as a React Native screen. ${args.additionalInstructions}`
      : 'Recreate this screenshot as a React Native screen. Match the layout, colors, and typography as closely as possible.';

    // Call API with image
    const response = await apiGenerateScreen({
      prompt,
      imageData: base64,
      imageMimeType: mimeType,
    });

    const tree: ComponentNode = response.tree;
    const screenName = 'ScreenFromImage';
    const filePath = args.outputPath || `screens/${screenName}.tsx`;

    // Convert and write
    const tsxContent = componentTreeToTSX(tree, screenName);
    const writtenPath = await writeScreenFile(filePath, tsxContent);

    // Sync to canvas
    let canvasSync = false;
    if (isCanvasSyncEnabled()) {
      const saved = await saveScreenToProject({
        name: screenName,
        componentTree: tree,
        originalPrompt: prompt,
      });
      canvasSync = !!saved;
    }

    const result = {
      success: true,
      filePath,
      absolutePath: writtenPath,
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
