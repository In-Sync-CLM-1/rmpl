-- Add project_owner column to projects table
ALTER TABLE projects ADD COLUMN project_owner uuid REFERENCES profiles(id);

-- Add index for better query performance
CREATE INDEX idx_projects_project_owner ON projects(project_owner);

-- Add comment for documentation
COMMENT ON COLUMN projects.project_owner IS 'The user who owns/manages this project';