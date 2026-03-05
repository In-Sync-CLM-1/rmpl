-- Add image_url, button_text, and button_url columns to email_templates table
ALTER TABLE public.email_templates
ADD COLUMN image_url TEXT,
ADD COLUMN button_text TEXT,
ADD COLUMN button_url TEXT;