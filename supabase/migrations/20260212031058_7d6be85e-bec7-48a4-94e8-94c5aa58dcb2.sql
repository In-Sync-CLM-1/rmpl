
-- Credit allocation table for CSBD
CREATE TABLE public.csbd_credit_allocations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by_user_id UUID NOT NULL REFERENCES public.profiles(id),
  credit_to_user_id UUID NOT NULL REFERENCES public.profiles(id),
  percentage NUMERIC(5,2) NOT NULL CHECK (percentage > 0 AND percentage <= 100),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(created_by_user_id, credit_to_user_id)
);

ALTER TABLE public.csbd_credit_allocations ENABLE ROW LEVEL SECURITY;

-- Admin roles can manage
CREATE POLICY "Admins can manage credit allocations"
ON public.csbd_credit_allocations
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = ANY (ARRAY['platform_admin'::app_role, 'super_admin'::app_role, 'admin_tech'::app_role, 'admin'::app_role, 'admin_administration'::app_role])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = ANY (ARRAY['platform_admin'::app_role, 'super_admin'::app_role, 'admin_tech'::app_role, 'admin'::app_role, 'admin_administration'::app_role])
  )
);

-- All authenticated users can read (needed for metrics calculation)
CREATE POLICY "Authenticated users can read credit allocations"
ON public.csbd_credit_allocations
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Trigger for updated_at
CREATE TRIGGER update_csbd_credit_allocations_updated_at
BEFORE UPDATE ON public.csbd_credit_allocations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
