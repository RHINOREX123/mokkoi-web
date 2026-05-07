-- Add generation_runs to the supabase_realtime publication so
-- INSERT/UPDATE events propagate to client subscribers. The Phase 1
-- migration that created the table omitted this — clients still got
-- the initial fetch on mount, but subsequent progress updates
-- (current_screen_index ticking from N to N+1, status flipping to
-- 'complete') never reached them, leaving the chat-panel progress UI
-- frozen at whatever value happened to be in the row at fetch time.
--
-- Idempotent — `ADD TABLE` is a no-op if the table is already a member
-- of the publication, so re-running this migration is safe.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'generation_runs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE generation_runs;
  END IF;
END $$;
