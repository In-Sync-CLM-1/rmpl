-- Rename options column to field_options for clarity
ALTER TABLE custom_fields 
RENAME COLUMN options TO field_options;

-- Add validation_rules column for storing field validation rules
ALTER TABLE custom_fields 
ADD COLUMN validation_rules jsonb;