
-- 1. Add column
ALTER TABLE public.projects 
ADD COLUMN invoiced_closed_at timestamptz;

-- 2. Backfill existing records
UPDATE public.projects 
SET invoiced_closed_at = updated_at 
WHERE status IN ('invoiced', 'closed');

-- 3. Create trigger function
CREATE OR REPLACE FUNCTION set_invoiced_closed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('invoiced', 'closed') 
     AND (OLD.status IS NULL OR OLD.status NOT IN ('invoiced', 'closed')) THEN
    NEW.invoiced_closed_at := now();
  ELSIF NEW.status NOT IN ('invoiced', 'closed') 
        AND OLD.status IN ('invoiced', 'closed') THEN
    NEW.invoiced_closed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_set_invoiced_closed_at
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION set_invoiced_closed_at();

-- 4. Recreate view
CREATE OR REPLACE VIEW csbd_actuals AS
SELECT project_owner AS user_id,
    date_trunc('month', COALESCE(invoiced_closed_at, updated_at)) AS month,
    sum(COALESCE(final_afactor, expected_afactor, 0::numeric)) / 100000.0 
      AS actual_amount_inr_lacs,
    count(*) AS deals_closed,
    array_agg(project_number ORDER BY 
      COALESCE(invoiced_closed_at, updated_at) DESC) AS project_numbers
FROM projects
WHERE status IN ('closed', 'invoiced') 
  AND (final_afactor IS NOT NULL OR expected_afactor IS NOT NULL)
GROUP BY project_owner, 
  date_trunc('month', COALESCE(invoiced_closed_at, updated_at));
