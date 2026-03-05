-- Drop the old 3-parameter version of process_bulk_import_batch that doesn't support upsert
-- This forces all calls to use the 4-parameter version with proper upsert logic
DROP FUNCTION IF EXISTS public.process_bulk_import_batch(uuid, text, uuid);