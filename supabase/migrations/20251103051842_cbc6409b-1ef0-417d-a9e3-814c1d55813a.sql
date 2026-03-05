-- Remove foreign key constraints from projects table
-- This allows client_id to store company names and contact_id to store mobile numbers
-- without requiring them to exist in the master table

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_client_id_fkey;
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_contact_id_fkey;

-- Add comments to clarify what these fields store
COMMENT ON COLUMN projects.client_id IS 'Company name from master table (stored as text for flexibility)';
COMMENT ON COLUMN projects.contact_id IS 'Contact mobile number from master table (stored as text for flexibility)';