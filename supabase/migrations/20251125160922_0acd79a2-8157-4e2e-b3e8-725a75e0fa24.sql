-- Make project_owner NOT NULL (all projects already have owners)
ALTER TABLE projects 
ALTER COLUMN project_owner SET NOT NULL;

-- Update csbd_actuals view to use project_owner instead of created_by
CREATE OR REPLACE VIEW csbd_actuals AS
SELECT 
    project_owner AS user_id,
    date_trunc('month', updated_at) AS month,
    sum(COALESCE(final_afactor, expected_afactor, 0)) AS actual_amount_inr_lacs,
    count(*) AS deals_closed,
    array_agg(project_number ORDER BY updated_at DESC) AS project_numbers
FROM projects
WHERE status IN ('closed', 'invoiced')
  AND (final_afactor IS NOT NULL OR expected_afactor IS NOT NULL)
GROUP BY project_owner, date_trunc('month', updated_at);