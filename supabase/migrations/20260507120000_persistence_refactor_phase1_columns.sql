-- Phase 1 (persistence refactor): align repo schema with what the client writes.
--
-- Audit found that production already has x_pos / y_pos / device_id on both
-- `screens` and `projects` (applied via earlier remote-only migrations:
-- 20260322173036 add_screen_position_columns,
-- 20260323073045 add_device_id_to_projects,
-- 20260323083651 add_device_id_to_screens). They are missing from the repo's
-- SQL files, so a fresh `supabase/schema.sql` setup would produce a DB the
-- client cannot write to. This migration is idempotent — a no-op in prod,
-- a backfill for fresh setups.
--
-- Also adds `screens.image_url` which the client reads
-- (src/hooks/useScreenManagement.ts:132) but no DB column existed for; this
-- prepares the image-only-screen path so reads stop silently returning
-- undefined and writes become possible in subsequent phases.

ALTER TABLE screens ADD COLUMN IF NOT EXISTS x_pos DOUBLE PRECISION;
ALTER TABLE screens ADD COLUMN IF NOT EXISTS y_pos DOUBLE PRECISION;
ALTER TABLE screens ADD COLUMN IF NOT EXISTS device_id TEXT DEFAULT 'iphone-standard';
ALTER TABLE screens ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS device_id TEXT DEFAULT 'iphone-standard';
