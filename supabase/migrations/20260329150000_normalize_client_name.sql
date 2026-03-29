-- Phase 4: Replace denormalized client_name text with client_id FK

-- 1. Add client_id FK to project_quotations
ALTER TABLE project_quotations
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_project_quotations_client_id ON project_quotations(client_id);

-- Backfill from projects.client_id (text → uuid cast)
UPDATE project_quotations pq
SET client_id = p.client_id::uuid
FROM projects p
WHERE pq.project_id = p.id
  AND p.client_id IS NOT NULL
  AND pq.client_id IS NULL;

-- 2. Add client_id FK to operations_inventory_distribution
ALTER TABLE operations_inventory_distribution
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ops_inv_dist_client_id ON operations_inventory_distribution(client_id);

-- Backfill from projects.client_id
UPDATE operations_inventory_distribution oid
SET client_id = p.client_id::uuid
FROM projects p
WHERE oid.project_id = p.id
  AND p.client_id IS NOT NULL
  AND oid.client_id IS NULL;

-- 3. Drop denormalized client_name columns
ALTER TABLE project_quotations DROP COLUMN IF EXISTS client_name;
ALTER TABLE operations_inventory_distribution DROP COLUMN IF EXISTS client_name;

-- 4. Update get_project_payment_summary RPC to use client FK instead of text field
DROP FUNCTION IF EXISTS get_project_payment_summary(text);
CREATE OR REPLACE FUNCTION get_project_payment_summary(p_project_name text)
RETURNS TABLE (
  quotation_number text,
  client_name text,
  invoice_date date,
  amount numeric,
  paid_amount numeric,
  pending_amount numeric,
  status text,
  payment_count bigint,
  last_payment_date date
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pq.quotation_number,
    c.company_name as client_name,
    pq.invoice_date,
    pq.amount,
    COALESCE(pq.paid_amount, 0) as paid_amount,
    (pq.amount - COALESCE(pq.paid_amount, 0)) as pending_amount,
    pq.status,
    COUNT(qp.id) as payment_count,
    MAX(qp.payment_date) as last_payment_date
  FROM project_quotations pq
  JOIN projects p ON p.id = pq.project_id
  LEFT JOIN clients c ON pq.client_id = c.id
  LEFT JOIN quotation_payments qp ON qp.quotation_id = pq.id
  WHERE p.project_name = p_project_name
  GROUP BY pq.id, pq.quotation_number, c.company_name, pq.invoice_date,
           pq.amount, pq.paid_amount, pq.status
  ORDER BY pq.created_at DESC;
END;
$$;
