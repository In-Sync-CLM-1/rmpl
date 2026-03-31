-- Add project_type column to projects table
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS project_type text DEFAULT NULL;

-- Add a comment for documentation
COMMENT ON COLUMN projects.project_type IS 'Type of project: integrated, mice, digital_creatives, telecalling, data_services, logistics_gifts';
