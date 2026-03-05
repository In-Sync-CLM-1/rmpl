-- Fix unit conversion: convert absolute rupees to Lacs (1 Lac = 100,000)
CREATE OR REPLACE VIEW csbd_actuals AS
SELECT 
    project_owner AS user_id,
    date_trunc('month', updated_at) AS month,
    sum(COALESCE(final_afactor, expected_afactor, 0)) / 100000.0 AS actual_amount_inr_lacs,
    count(*) AS deals_closed,
    array_agg(project_number ORDER BY updated_at DESC) AS project_numbers
FROM projects
WHERE status IN ('closed', 'invoiced')
  AND (final_afactor IS NOT NULL OR expected_afactor IS NOT NULL)
GROUP BY project_owner, date_trunc('month', updated_at);