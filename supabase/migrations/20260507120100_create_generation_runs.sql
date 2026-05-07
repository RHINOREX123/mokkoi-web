-- Phase 1 (persistence refactor): generation_runs table.
--
-- Tracks an in-flight or finished generation for a project. The SSE-streaming
-- endpoints write progress here so a navigation away mid-stream no longer
-- loses state. The unique partial index enforces "at most one running run
-- per project" at the DB level — paired with UI button-disable, this is the
-- concurrency story.
--
-- RLS: ownership-based — a user can read/write only runs whose project they
-- own (projects.user_id = auth.uid()). Service-role still bypasses RLS for
-- internal cleanup, but Phase 1 Step 3 switches /api/generate-flow off the
-- service role onto the user's JWT, so these policies become load-bearing.

CREATE TABLE IF NOT EXISTS generation_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('app', 'flow', 'plan')),
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'complete', 'failed', 'aborted')),
  plan_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  current_screen_index INT NOT NULL DEFAULT 0,
  total_screens INT,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_generation_runs_project
  ON generation_runs (project_id);

-- At most one running run per project. Paired with UI button-disable; the
-- index is the durable backstop against double-click / multi-tab racing.
CREATE UNIQUE INDEX IF NOT EXISTS one_running_run_per_project
  ON generation_runs (project_id) WHERE status = 'running';

ALTER TABLE generation_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can select runs" ON generation_runs;
CREATE POLICY "Owners can select runs" ON generation_runs
  FOR SELECT USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Owners can insert runs" ON generation_runs;
CREATE POLICY "Owners can insert runs" ON generation_runs
  FOR INSERT WITH CHECK (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Owners can update runs" ON generation_runs;
CREATE POLICY "Owners can update runs" ON generation_runs
  FOR UPDATE USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  ) WITH CHECK (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Owners can delete runs" ON generation_runs;
CREATE POLICY "Owners can delete runs" ON generation_runs
  FOR DELETE USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );
