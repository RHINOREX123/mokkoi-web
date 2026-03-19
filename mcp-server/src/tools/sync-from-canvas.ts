/**
 * sync_from_canvas tool — pulls screen data from Supabase and writes local .tsx files.
 */

import { componentTreeToTSX, writeScreenFile } from '../utils/file-writer.js';
import {
  isCanvasSyncEnabled,
  getScreensByProject,
  getScreenByName,
} from '../utils/supabase-client.js';

export const syncFromCanvasTool = {
  name: 'sync_from_canvas',
  description:
    'Sync screens from the mokkoi.com canvas to local .tsx files. Pull the latest changes made on the web canvas and update your local project files.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      screenName: {
        type: 'string',
        description:
          'Optional — sync a specific screen by name. If omitted, all screens in the project are synced.',
      },
      outputDir: {
        type: 'string',
        description:
          'Directory for synced .tsx files (default: "./screens/")',
      },
    },
  },
};

export async function handleSyncFromCanvas(args: {
  screenName?: string;
  outputDir?: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  // Check canvas sync is configured
  if (!isCanvasSyncEnabled()) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            error: 'Canvas sync is not configured. Set MOKKOI_SUPABASE_URL, MOKKOI_SUPABASE_ANON_KEY, and MOKKOI_PROJECT_ID environment variables.',
          }),
        },
      ],
    };
  }

  const outputDir = args.outputDir || './screens/';

  try {
    // Fetch screens from Supabase
    let screens: Array<{ id: string; name: string; component_tree: unknown; updated_at: string; source: string }>;

    if (args.screenName) {
      const screen = await getScreenByName(args.screenName);
      screens = screen ? [screen] : [];
      if (screens.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                error: `No screen found matching "${args.screenName}"`,
                hint: 'Use watch_canvas to see available screens, or omit screenName to sync all.',
              }),
            },
          ],
        };
      }
    } else {
      screens = await getScreensByProject();
      if (screens.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                error: 'No screens found in this project.',
                hint: 'Generate screens on mokkoi.com first, then sync them here.',
              }),
            },
          ],
        };
      }
    }

    // Convert each screen to .tsx and write to disk
    const syncedFiles: string[] = [];

    for (const screen of screens) {
      const safeName = screen.name.replace(/[^a-zA-Z0-9]/g, '');
      const fileName = `${safeName}.tsx`;
      const filePath = `${outputDir.replace(/\/$/, '')}/${fileName}`;

      const tsx = componentTreeToTSX(screen.component_tree as Parameters<typeof componentTreeToTSX>[0], screen.name);
      await writeScreenFile(filePath, tsx);
      syncedFiles.push(filePath);
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            syncedFiles,
            count: syncedFiles.length,
            message: `Synced ${syncedFiles.length} screen${syncedFiles.length === 1 ? '' : 's'} from mokkoi.com canvas.`,
          }),
        },
      ],
    };
  } catch (err) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            error: 'Failed to sync from canvas',
            details: String(err),
          }),
        },
      ],
    };
  }
}
