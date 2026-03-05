
DROP POLICY IF EXISTS "Admins and managers can manage allocations" ON public.inventory_allocations;

CREATE POLICY "Admins and managers can manage allocations"
ON public.inventory_allocations
FOR ALL
USING (
  has_role(auth.uid(), 'admin') OR
  has_role(auth.uid(), 'manager') OR
  has_role(auth.uid(), 'super_admin') OR
  has_role(auth.uid(), 'platform_admin') OR
  has_role(auth.uid(), 'admin_tech') OR
  has_role(auth.uid(), 'admin_administration')
);

DROP POLICY IF EXISTS "Users can view their own allocations" ON public.inventory_allocations;

CREATE POLICY "Users can view their own allocations"
ON public.inventory_allocations
FOR SELECT
USING (
  auth.uid() = user_id OR
  has_role(auth.uid(), 'admin') OR
  has_role(auth.uid(), 'manager') OR
  has_role(auth.uid(), 'super_admin') OR
  has_role(auth.uid(), 'platform_admin') OR
  has_role(auth.uid(), 'admin_tech') OR
  has_role(auth.uid(), 'admin_administration')
);
