-- Usage Tracking for Mokkoi
-- Run this in the Supabase SQL Editor after schema.sql

-- Usage logs table
CREATE TABLE usage_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  project_id UUID REFERENCES projects(id),
  model_used TEXT NOT NULL,
  tokens_in INTEGER,
  tokens_out INTEGER,
  generation_type TEXT NOT NULL CHECK (generation_type IN ('new_screen', 'edit', 'flow', 'variation', 'regenerate')),
  prompt_preview TEXT,
  success BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own usage
CREATE POLICY "Users can view own usage" ON usage_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own usage (API inserts on behalf of authenticated user)
CREATE POLICY "Users can insert own usage" ON usage_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Index for fast daily lookups (rate limiting)
CREATE INDEX idx_usage_logs_user_date ON usage_logs (user_id, created_at);

-- View for daily usage counts
CREATE VIEW daily_usage AS
SELECT
  user_id,
  DATE(created_at) as date,
  COUNT(*) as generation_count,
  SUM(tokens_in) as total_tokens_in,
  SUM(tokens_out) as total_tokens_out
FROM usage_logs
GROUP BY user_id, DATE(created_at);
