-- Step 1: Drop restrictive SELECT policy and create open policy
DROP POLICY IF EXISTS "Users can view candidates based on hierarchy" ON job_seekers;

CREATE POLICY "Authenticated users can view all job seekers"
ON job_seekers
FOR SELECT
TO authenticated
USING (true);

-- Step 2: Update UPDATE policies to allow all authenticated users
DROP POLICY IF EXISTS "Users can update candidates based on hierarchy" ON job_seekers;

CREATE POLICY "Authenticated users can update all job seekers"
ON job_seekers
FOR UPDATE
TO authenticated
USING (true);

-- Step 3: Update existing NULL created_by records to the current user
UPDATE job_seekers 
SET created_by = '70f7619f-1984-4583-9f2f-53cfec733eb5' 
WHERE created_by IS NULL;