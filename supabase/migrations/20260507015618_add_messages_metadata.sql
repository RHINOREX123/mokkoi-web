-- Add metadata JSONB column to messages so Plan-mode can persist chips +
-- extracted snapshot + ready_to_build + summary on assistant turns.
-- Default '{}' so existing rows have a sane shape on read.
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
