-- Add service_type column to vendors table
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS service_type text;