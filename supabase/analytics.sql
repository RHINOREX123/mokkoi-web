-- Design Patterns Analytics for Mokkoi
-- Stores aggregated patterns extracted from edit_diffs analysis.
-- Run this in the Supabase SQL Editor after edit-diffs.sql.

CREATE TABLE IF NOT EXISTS design_patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pattern_type TEXT NOT NULL,
  pattern_data JSONB NOT NULL,
  frequency INTEGER DEFAULT 1,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Allow service role full access (analytics pipeline runs server-side)
ALTER TABLE design_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on design_patterns" ON design_patterns
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_design_patterns_type ON design_patterns(pattern_type);
CREATE INDEX idx_design_patterns_frequency ON design_patterns(frequency DESC);
