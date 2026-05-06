-- Add lifecycle state to projects for Plan-mode.
--
-- 'built'    = default; all existing projects (DEFAULT applies to new rows
--              and existing rows since PG ≥11 stores DEFAULT in pg_attribute
--              without a table rewrite).
-- 'planning' = Plan-mode active, no screens yet.
-- 'building' = post-Build click, generation in progress (transient).
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT 'built';

ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_state_check;

ALTER TABLE projects
  ADD CONSTRAINT projects_state_check
  CHECK (state IN ('planning', 'building', 'built'));
