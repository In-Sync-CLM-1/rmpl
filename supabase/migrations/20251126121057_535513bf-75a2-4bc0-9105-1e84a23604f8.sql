-- Add description column to project_digicom_checklist
ALTER TABLE project_digicom_checklist 
ADD COLUMN description text;

-- Add description column to project_livecom_checklist
ALTER TABLE project_livecom_checklist 
ADD COLUMN description text;