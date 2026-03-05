-- Create HR ADMIN section between HR (order 8) and MARKETING (order 9)
-- First shift MARKETING and ADMIN up
UPDATE navigation_sections SET display_order = 11 WHERE section_key = 'ADMIN';
UPDATE navigation_sections SET display_order = 10 WHERE section_key = 'MARKETING';

-- Insert new HR ADMIN section at order 9
INSERT INTO navigation_sections (section_key, section_label, display_order, is_active)
VALUES ('HR_ADMIN', 'HR ADMIN', 9, true);

-- Move admin-only items to the new HR ADMIN section
UPDATE navigation_items 
SET section_id = (SELECT id FROM navigation_sections WHERE section_key = 'HR_ADMIN'),
    display_order = CASE item_key
      WHEN 'attendance_reports' THEN 1
      WHEN 'leave_approvals' THEN 2
      WHEN 'regularization_approvals' THEN 3
      WHEN 'hr-policies' THEN 4
      WHEN 'salary-slips' THEN 5
      WHEN 'my-documents' THEN 6
      WHEN 'employee-directory' THEN 7
      WHEN 'leave-limits' THEN 8
      WHEN 'salary-admin' THEN 9
      WHEN 'employee-onboarding' THEN 10
    END
WHERE item_key IN (
  'attendance_reports', 'leave_approvals', 'regularization_approvals',
  'hr-policies', 'salary-slips', 'my-documents', 'employee-directory',
  'leave-limits', 'salary-admin', 'employee-onboarding'
);

-- Re-order remaining HR items
UPDATE navigation_items SET display_order = 1 WHERE item_key = 'attendance';
UPDATE navigation_items SET display_order = 2 WHERE item_key = 'leave_management';