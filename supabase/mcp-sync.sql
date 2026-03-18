-- MCP Sync: Add source column to screens table
-- Tracks whether a screen was created via the web app or MCP server
ALTER TABLE screens ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'web';
-- 'web' = created on mokkoi.com
-- 'mcp' = created via MCP server (Claude Code, Cursor, etc.)

-- Add original_prompt column if it doesn't exist (some older schemas use 'prompt')
-- This ensures MCP-generated screens can store their original prompt
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'screens' AND column_name = 'original_prompt'
  ) THEN
    ALTER TABLE screens ADD COLUMN original_prompt TEXT;
    -- Migrate existing data from prompt column if it exists
    UPDATE screens SET original_prompt = prompt WHERE original_prompt IS NULL AND prompt IS NOT NULL;
  END IF;
END $$;

-- Enable realtime for the screens table so MCP changes appear on the web canvas
ALTER PUBLICATION supabase_realtime ADD TABLE screens;

-- Index for faster queries by source
CREATE INDEX IF NOT EXISTS idx_screens_source ON screens (source);

-- Index for project_id + source queries
CREATE INDEX IF NOT EXISTS idx_screens_project_source ON screens (project_id, source);
