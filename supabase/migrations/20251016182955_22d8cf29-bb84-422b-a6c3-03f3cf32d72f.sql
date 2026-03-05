-- Update jobs table to use mobile_numb as foreign key to clients
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_client_id_fkey;
ALTER TABLE jobs ALTER COLUMN client_id TYPE text;

-- Add foreign key constraint to clients.mobile_numb
ALTER TABLE jobs 
  ADD CONSTRAINT jobs_client_id_fkey 
  FOREIGN KEY (client_id) 
  REFERENCES clients(mobile_numb) 
  ON DELETE SET NULL;