-- =====================================================
-- Migration: Separate clients (companies) from contacts (people)
-- - Creates new `contacts` table for person-level data
-- - Cleans up `clients` table to be company-only
-- - Adds `assigned_to` on clients for user assignment
-- - Migrates existing data
-- - Updates projects to use UUID references
-- - Recreates views and RPC functions
-- =====================================================

-- Step 1: Create contacts table
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  contact_name TEXT NOT NULL,
  designation TEXT,
  department TEXT,
  contact_number TEXT,
  email_id TEXT,
  residence_address TEXT,
  birthday_date DATE,
  anniversary_date DATE,
  linkedin_id TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Step 2: Migrate contact data from clients to contacts table
-- Map each row to its canonical client (first row per company_name)
INSERT INTO public.contacts (
  client_id, contact_name, contact_number, email_id,
  residence_address, birthday_date, anniversary_date, linkedin_id,
  is_primary, created_by, created_at, updated_at
)
SELECT
  canonical.id AS client_id,
  c.contact_name,
  c.contact_number,
  c.email_id,
  c.residence_address,
  c.birthday_date,
  c.anniversary_date,
  c.linkedin_id,
  (c.id = canonical.id) AS is_primary,
  c.created_by,
  c.created_at,
  c.updated_at
FROM clients c
JOIN (
  SELECT DISTINCT ON (company_name) id, company_name
  FROM clients
  ORDER BY company_name, created_at ASC
) canonical ON canonical.company_name = c.company_name
WHERE c.contact_name IS NOT NULL;

-- Step 3: Update projects.client_id from company_name text to client UUID text
UPDATE projects p
SET client_id = canonical.id::text
FROM (
  SELECT DISTINCT ON (company_name) id, company_name
  FROM clients
  ORDER BY company_name, created_at ASC
) canonical
WHERE p.client_id IS NOT NULL
  AND p.client_id = canonical.company_name;

-- Step 4: Update projects.contact_id from contact_name text to contact UUID text
UPDATE projects p
SET contact_id = ct.id::text
FROM contacts ct
WHERE p.contact_id IS NOT NULL
  AND p.contact_id = ct.contact_name
  AND p.client_id = ct.client_id::text;

-- Step 5: Delete duplicate client rows (keep one per company_name)
DELETE FROM clients
WHERE id NOT IN (
  SELECT DISTINCT ON (company_name) id
  FROM clients
  ORDER BY company_name, created_at ASC
);

-- Step 6: Drop dependent views BEFORE altering the table
DROP VIEW IF EXISTS public.client_pending_summary CASCADE;

-- Step 6b: Drop the unique index on contact_name (it's moving to contacts)
DROP INDEX IF EXISTS idx_clients_contact_name;

-- Step 7: Drop contact-specific columns from clients
ALTER TABLE public.clients
  DROP COLUMN IF EXISTS contact_name,
  DROP COLUMN IF EXISTS residence_address,
  DROP COLUMN IF EXISTS contact_number,
  DROP COLUMN IF EXISTS email_id,
  DROP COLUMN IF EXISTS birthday_date,
  DROP COLUMN IF EXISTS anniversary_date,
  DROP COLUMN IF EXISTS linkedin_id;

-- Step 8: Add new company-level columns to clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS industry TEXT,
  ADD COLUMN IF NOT EXISTS gst_number TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT;

-- Step 9: Add unique constraint on company_name
DROP INDEX IF EXISTS idx_clients_company_name;
CREATE UNIQUE INDEX idx_clients_company_name ON public.clients(company_name);

-- Step 10: Add FK from contacts to clients (with cascade delete)
ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

-- Step 11: Create indexes on contacts
CREATE INDEX idx_contacts_client_id ON public.contacts(client_id);
CREATE INDEX idx_contacts_contact_name ON public.contacts(contact_name);
CREATE INDEX idx_contacts_created_by ON public.contacts(created_by);

-- Step 12: Add index on clients.assigned_to
CREATE INDEX idx_clients_assigned_to ON public.clients(assigned_to);

-- Step 13: Enable RLS on contacts
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view contacts"
  ON public.contacts FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Managers can manage contacts"
  ON public.contacts FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'manager'::app_role) OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'platform_admin'::app_role)
  );

-- Step 14: Recreate client_pending_summary view (no more contact_name)
CREATE OR REPLACE VIEW public.client_pending_summary AS
SELECT
  c.id AS client_id,
  c.company_name,
  COUNT(pq.id) AS invoice_count,
  COALESCE(SUM(pq.amount - COALESCE(pq.paid_amount, 0)), 0) AS pending_amount,
  MIN(pq.created_at) AS oldest_invoice_date
FROM clients c
JOIN projects p ON p.client_id = c.id::text
JOIN project_quotations pq ON pq.project_id = p.id
WHERE pq.amount IS NOT NULL AND pq.amount > 0
  AND (pq.amount - COALESCE(pq.paid_amount, 0)) > 0
GROUP BY c.id, c.company_name;

-- Step 15: Drop and recreate get_top_pending_companies function (return type changed)
DROP FUNCTION IF EXISTS get_top_pending_companies(int);
CREATE OR REPLACE FUNCTION get_top_pending_companies(p_limit int DEFAULT 5)
RETURNS TABLE (
  client_id uuid,
  company_name text,
  total_pending numeric,
  oldest_pending_days int,
  invoice_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    c.id AS client_id,
    c.company_name,
    COALESCE(SUM(pq.amount - COALESCE(pq.paid_amount, 0)), 0) AS total_pending,
    COALESCE(
      EXTRACT(DAY FROM NOW() - MIN(pq.created_at))::int,
      0
    ) AS oldest_pending_days,
    COUNT(DISTINCT pq.id) AS invoice_count
  FROM clients c
  JOIN projects p ON p.client_id = c.id::text
  JOIN project_quotations pq ON pq.project_id = p.id
  WHERE pq.amount > COALESCE(pq.paid_amount, 0)
  GROUP BY c.id, c.company_name
  HAVING SUM(pq.amount - COALESCE(pq.paid_amount, 0)) > 0
  ORDER BY total_pending DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_top_pending_companies(int) TO authenticated;

-- Step 16: Create bulk_delete_contacts function
CREATE OR REPLACE FUNCTION public.bulk_delete_contacts(p_record_ids UUID[])
RETURNS TABLE (deleted_count INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deleted_count INT;
BEGIN
  DELETE FROM contacts WHERE id = ANY(p_record_ids);
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN QUERY SELECT v_deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION bulk_delete_contacts(UUID[]) TO authenticated;
