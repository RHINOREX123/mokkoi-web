-- MCP Projects: Allow MCP-generated projects to exist without a user_id
-- and add source tracking to projects table

-- Make user_id nullable so MCP can create projects without a real user
ALTER TABLE projects ALTER COLUMN user_id DROP NOT NULL;

-- Add source column to projects (same pattern as screens table)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'web';
-- 'web' = created on mokkoi.com by a logged-in user
-- 'mcp' = auto-created by MCP server for imported screens

-- Index for querying MCP projects
CREATE INDEX IF NOT EXISTS idx_projects_source ON projects (source);

-- RLS policy: users can view MCP-imported projects they own or unclaimed ones (null user_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own or unclaimed MCP imports'
  ) THEN
    CREATE POLICY "Users can view own or unclaimed MCP imports" ON projects
      FOR SELECT USING (source = 'mcp' AND (user_id = auth.uid() OR user_id IS NULL));
  END IF;
END $$;

-- RLS policy: users can manage MCP-imported projects they own or unclaimed ones
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage own or unclaimed MCP imports'
  ) THEN
    CREATE POLICY "Users can manage own or unclaimed MCP imports" ON projects
      FOR ALL USING (source = 'mcp' AND (user_id = auth.uid() OR user_id IS NULL));
  END IF;
END $$;

-- Unique constraint to prevent duplicate MCP projects per user
-- (user_id can be null, so we need a partial index for null case)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_mcp_project_per_user
  ON projects (name, user_id) WHERE source = 'mcp' AND user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_mcp_project_null_user
  ON projects (name) WHERE source = 'mcp' AND user_id IS NULL;
