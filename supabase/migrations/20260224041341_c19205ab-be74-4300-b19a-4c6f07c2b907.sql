CREATE OR REPLACE VIEW csbd_actuals AS
SELECT 
  p.project_owner AS user_id,
  date_trunc('month', 
    COALESCE(pq_latest.invoice_date::timestamp, p.invoiced_closed_at, p.updated_at)
  ) AS month,
  sum(COALESCE(p.final_afactor, p.expected_afactor, 0::numeric)) / 100000.0 
    AS actual_amount_inr_lacs,
  count(*) AS deals_closed,
  array_agg(p.project_number ORDER BY 
    COALESCE(pq_latest.invoice_date::timestamp, p.invoiced_closed_at, p.updated_at) DESC
  ) AS project_numbers
FROM projects p
LEFT JOIN LATERAL (
  SELECT MAX(invoice_date) AS invoice_date
  FROM project_quotations
  WHERE project_id = p.id AND invoice_date IS NOT NULL
) pq_latest ON true
WHERE p.status IN ('closed', 'invoiced') 
  AND (p.final_afactor IS NOT NULL OR p.expected_afactor IS NOT NULL)
GROUP BY p.project_owner, 
  date_trunc('month', 
    COALESCE(pq_latest.invoice_date::timestamp, p.invoiced_closed_at, p.updated_at)
  );