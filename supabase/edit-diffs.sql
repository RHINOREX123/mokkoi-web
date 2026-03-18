-- Edit Diff Tracking for Mokkoi
-- Captures before/after component trees for AI edits, variations, and regenerations.
-- Run this in the Supabase SQL Editor after schema.sql and usage-tracking.sql.

CREATE TABLE edit_diffs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  screen_id UUID NOT NULL,
  project_id UUID REFERENCES projects(id),
  edit_type TEXT NOT NULL CHECK (edit_type IN ('ai_edit', 'direct_edit', 'regenerate', 'variation')),
  prompt TEXT,
  component_tree_before JSONB NOT NULL,
  component_tree_after JSONB NOT NULL,
  model_used TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE edit_diffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own diffs" ON edit_diffs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own diffs" ON edit_diffs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_edit_diffs_user ON edit_diffs(user_id);
CREATE INDEX idx_edit_diffs_screen ON edit_diffs(screen_id);
