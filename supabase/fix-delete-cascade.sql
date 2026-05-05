-- Fix delete-projects-come-back bug.
--
-- Root cause: edit_diffs.project_id and usage_logs.project_id reference
-- projects(id) with the default NO ACTION delete rule. As soon as a user
-- generates anything, those tables get rows that block DELETE on projects
-- via FK violation. The frontend wasn't checking the error, so the row
-- looked deleted in local state but reappeared on reload.
--
-- Fix: drop and recreate both FKs with ON DELETE CASCADE so deleting a
-- project also clears its derived analytics/edit-diff rows. screens and
-- messages already cascade — they were never the problem.
--
-- Run in the Supabase SQL Editor.

ALTER TABLE edit_diffs
  DROP CONSTRAINT IF EXISTS edit_diffs_project_id_fkey,
  ADD CONSTRAINT edit_diffs_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

ALTER TABLE usage_logs
  DROP CONSTRAINT IF EXISTS usage_logs_project_id_fkey,
  ADD CONSTRAINT usage_logs_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
