/**
 * watch_canvas tool — checks for recent screen changes on the mokkoi.com canvas.
 */

import {
  isCanvasSyncEnabled,
  getRecentlyUpdatedScreens,
} from '../utils/supabase-client.js';

export const watchCanvasTool = {
  name: 'watch_canvas',
  description:
    'Check for recent screen changes on the mokkoi.com canvas. Shows which screens were modified since the last sync.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      sinceMinutes: {
        type: 'number',
        description:
          'Check changes in the last N minutes (default: 30)',
      },
    },
  },
};

export async function handleWatchCanvas(args: {
  sinceMinutes?: number;
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
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

  const sinceMinutes = args.sinceMinutes ?? 30;

  try {
    const changes = await getRecentlyUpdatedScreens(sinceMinutes);

    const recentChanges = changes.map(s => ({
      name: s.name,
      updatedAt: s.updated_at,
      source: s.source || 'web',
      id: s.id,
    }));

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            recentChanges,
            count: recentChanges.length,
            sinceMinutes,
            message: recentChanges.length > 0
              ? `${recentChanges.length} screen${recentChanges.length === 1 ? '' : 's'} changed in the last ${sinceMinutes} minutes.`
              : `No screen changes in the last ${sinceMinutes} minutes.`,
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
            error: 'Failed to check for canvas changes',
            details: String(err),
          }),
        },
      ],
    };
  }
}
