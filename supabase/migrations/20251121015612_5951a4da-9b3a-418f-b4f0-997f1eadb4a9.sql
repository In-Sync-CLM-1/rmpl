-- Add lost_reason column to projects table
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS lost_reason TEXT;