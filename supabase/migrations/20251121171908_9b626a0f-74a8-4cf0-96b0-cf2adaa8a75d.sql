-- Remove unique constraint on contact_name to allow duplicate names
DROP INDEX IF EXISTS public.idx_clients_contact_name;