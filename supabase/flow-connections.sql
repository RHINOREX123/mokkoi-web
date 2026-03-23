-- Add connections column to projects table for manual flow connections
-- connections is a JSONB array of { fromScreenId, toScreenId } objects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS connections JSONB DEFAULT '[]';
