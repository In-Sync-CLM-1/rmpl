-- Add contact_status column to contacts table
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS contact_status TEXT NOT NULL DEFAULT 'Active'
  CHECK (contact_status IN ('Active', 'Inactive', 'Mapped'));
