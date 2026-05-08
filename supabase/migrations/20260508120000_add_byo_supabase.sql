-- BYO-Backend: per-project Supabase connection metadata.
-- Existing project RLS policies cover this column; no new policy required.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS byo_supabase JSONB DEFAULT NULL;

COMMENT ON COLUMN projects.byo_supabase IS
  'BYO-Backend connection metadata. Shape: { url: text, anon_key: text, connected_at: timestamptz }. NULL means not connected. Anon key is public-by-design (Supabase RLS is the security boundary), so plaintext storage is acceptable.';
