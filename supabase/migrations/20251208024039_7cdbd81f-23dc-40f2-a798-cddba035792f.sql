-- Add client_name and invoice_date columns to project_quotations
ALTER TABLE public.project_quotations 
ADD COLUMN IF NOT EXISTS client_name text,
ADD COLUMN IF NOT EXISTS invoice_date date;