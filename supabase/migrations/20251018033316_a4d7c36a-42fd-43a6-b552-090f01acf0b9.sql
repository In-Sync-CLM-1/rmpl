-- Rename clients table to master
ALTER TABLE public.clients RENAME TO master;

-- Rename the trigger
DROP TRIGGER IF EXISTS update_clients_updated_at ON public.master;
CREATE TRIGGER update_master_updated_at
  BEFORE UPDATE ON public.master
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Rename the index
ALTER INDEX IF EXISTS idx_clients_created_by RENAME TO idx_master_created_by;

-- Drop old RLS policies on clients (now master)
DROP POLICY IF EXISTS "Authenticated users can view clients" ON public.master;
DROP POLICY IF EXISTS "Managers can manage clients" ON public.master;

-- Create new RLS policies on master table
CREATE POLICY "Authenticated users can view master"
  ON public.master
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers can manage master"
  ON public.master
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'manager'::app_role) OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'platform_admin'::app_role)
  );