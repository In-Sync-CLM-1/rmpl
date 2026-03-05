-- Add remarks column to demandcom table
ALTER TABLE demandcom ADD COLUMN IF NOT EXISTS remarks text;