DROP VIEW IF EXISTS csbd_actuals;

CREATE VIEW csbd_actuals AS
SELECT 
  p.project_owner AS user_id,
  date_trunc('month', pq.invoice_date::timestamp) AS month,
  sum(COALESCE(pq.amount, 0)) / 100000.0 AS actual_amount_inr_lacs,
  count(DISTINCT p.id) AS deals_closed,
  array_agg(DISTINCT p.project_number ORDER BY p.project_number) AS project_numbers
FROM projects p
INNER JOIN project_quotations pq 
  ON pq.project_id = p.id 
  AND pq.invoice_date IS NOT NULL 
  AND pq.amount IS NOT NULL
WHERE p.status IN ('closed', 'invoiced')
GROUP BY p.project_owner, date_trunc('month', pq.invoice_date::timestamp);