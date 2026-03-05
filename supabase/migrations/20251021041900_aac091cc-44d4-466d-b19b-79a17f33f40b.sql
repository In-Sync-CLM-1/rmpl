-- Drop import tracking tables and related objects

-- Drop foreign key from profiles to user_import_jobs
ALTER TABLE IF EXISTS public.profiles DROP CONSTRAINT IF EXISTS profiles_import_job_id_fkey;

-- Drop the import_job_id column from profiles
ALTER TABLE IF EXISTS public.profiles DROP COLUMN IF EXISTS import_job_id;

-- Drop tables
DROP TABLE IF EXISTS public.import_jobs CASCADE;
DROP TABLE IF EXISTS public.user_import_jobs CASCADE;
DROP TABLE IF EXISTS public.client_import_jobs CASCADE;
DROP TABLE IF EXISTS public.master_import_jobs CASCADE;