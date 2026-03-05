-- Migration to restructure demandcom table to match clients table structure
-- Step 1: Add new columns and migrate data from the existing record
ALTER TABLE public.demandcom ADD COLUMN IF NOT EXISTS name_temp TEXT;
ALTER TABLE public.demandcom ADD COLUMN IF NOT EXISTS mobile_numb_temp TEXT;

-- Migrate existing data: combine first_name + last_name into name
UPDATE public.demandcom 
SET name_temp = COALESCE(first_name || ' ' || last_name, first_name, last_name, ''),
    mobile_numb_temp = COALESCE(phone, '');

-- Step 2: Drop healthcare-specific and obsolete columns
ALTER TABLE public.demandcom 
DROP COLUMN IF EXISTS first_name,
DROP COLUMN IF EXISTS last_name,
DROP COLUMN IF EXISTS email,
DROP COLUMN IF EXISTS phone,
DROP COLUMN IF EXISTS license_type,
DROP COLUMN IF EXISTS license_number,
DROP COLUMN IF EXISTS license_state,
DROP COLUMN IF EXISTS specialty,
DROP COLUMN IF EXISTS availability,
DROP COLUMN IF EXISTS years_experience,
DROP COLUMN IF EXISTS expected_salary,
DROP COLUMN IF EXISTS date_of_birth,
DROP COLUMN IF EXISTS middle_name,
DROP COLUMN IF EXISTS ssn,
DROP COLUMN IF EXISTS work_authorization,
DROP COLUMN IF EXISTS skype_id,
DROP COLUMN IF EXISTS country,
DROP COLUMN IF EXISTS linkedin_url,
DROP COLUMN IF EXISTS job_title,
DROP COLUMN IF EXISTS gender,
DROP COLUMN IF EXISTS preferred_location,
DROP COLUMN IF EXISTS activity_name,
DROP COLUMN IF EXISTS session_1,
DROP COLUMN IF EXISTS session_2,
DROP COLUMN IF EXISTS excelhire_id,
DROP COLUMN IF EXISTS tags,
DROP COLUMN IF EXISTS notes,
DROP COLUMN IF EXISTS source,
DROP COLUMN IF EXISTS status,
DROP COLUMN IF EXISTS latitude,
DROP COLUMN IF EXISTS longitude,
DROP COLUMN IF EXISTS last_contact_date,
DROP COLUMN IF EXISTS is_unsubscribed;

-- Step 3: Rename location-specific columns to match clients structure
ALTER TABLE public.demandcom 
RENAME COLUMN location_city TO city;

ALTER TABLE public.demandcom 
RENAME COLUMN location_state TO state;

ALTER TABLE public.demandcom 
RENAME COLUMN location_zip TO pincode;

-- Step 4: Add the final name and mobile_numb columns with data
ALTER TABLE public.demandcom 
ADD COLUMN name TEXT;

ALTER TABLE public.demandcom 
ADD COLUMN mobile_numb TEXT;

-- Copy data from temp columns
UPDATE public.demandcom 
SET name = name_temp,
    mobile_numb = mobile_numb_temp;

-- Drop temp columns
ALTER TABLE public.demandcom 
DROP COLUMN name_temp,
DROP COLUMN mobile_numb_temp;

-- Step 5: Add NOT NULL constraints to required fields
ALTER TABLE public.demandcom 
ALTER COLUMN name SET NOT NULL,
ALTER COLUMN mobile_numb SET NOT NULL;

-- Step 6: Add linkedin column (without _url suffix)
ALTER TABLE public.demandcom 
ADD COLUMN IF NOT EXISTS linkedin TEXT;