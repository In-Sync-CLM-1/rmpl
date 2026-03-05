-- Add missing columns to master table that exist in demandcom
ALTER TABLE public.master ADD COLUMN IF NOT EXISTS head_office_location TEXT;
ALTER TABLE public.master ADD COLUMN IF NOT EXISTS remarks TEXT;