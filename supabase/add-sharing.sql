-- Add sharing support to projects
-- Run this in the Supabase SQL Editor after schema.sql

-- Add is_public column to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

-- Drop existing restrictive policies so we can replace them with sharing-aware ones
DROP POLICY IF EXISTS "Users can manage own projects" ON projects;
DROP POLICY IF EXISTS "Users can manage own screens" ON screens;

-- Projects: owners can do everything, anyone can READ public projects
CREATE POLICY "Users can manage own projects" ON projects
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view public projects" ON projects
  FOR SELECT USING (is_public = true);

-- Screens: owners can do everything, anyone can READ screens of public projects
CREATE POLICY "Users can manage own screens" ON screens
  FOR ALL USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );

CREATE POLICY "Anyone can view public project screens" ON screens
  FOR SELECT USING (
    project_id IN (SELECT id FROM projects WHERE is_public = true)
  );
