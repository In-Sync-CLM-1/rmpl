-- Update csbd_actuals view to use 'closed' status instead of 'invoiced'
CREATE OR REPLACE VIEW csbd_actuals AS
SELECT 
    created_by AS user_id,
    date_trunc('month', updated_at) AS month,
    SUM(COALESCE(final_afactor, expected_afactor, 0)) AS actual_amount_inr_lacs,
    COUNT(*) AS deals_closed,
    array_agg(project_number ORDER BY updated_at DESC) AS project_numbers
FROM projects
WHERE status = 'closed'
  AND (final_afactor IS NOT NULL OR expected_afactor IS NOT NULL)
GROUP BY created_by, date_trunc('month', updated_at);

-- Create function to get all subordinates recursively
CREATE OR REPLACE FUNCTION get_all_subordinate_ids(manager_id uuid)
RETURNS uuid[] AS $$
  WITH RECURSIVE subordinates AS (
    -- Direct reports
    SELECT id FROM profiles WHERE reports_to = manager_id
    UNION ALL
    -- Recursive: subordinates of subordinates
    SELECT p.id FROM profiles p
    INNER JOIN subordinates s ON p.reports_to = s.id
  )
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) FROM subordinates;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public';

-- Update Dilip Bist's has_subordinates flag
UPDATE csbd_targets 
SET has_subordinates = true 
WHERE user_id = 'abf0cb30-d00d-46bd-af88-829381676010'
  AND fiscal_year = 2025;