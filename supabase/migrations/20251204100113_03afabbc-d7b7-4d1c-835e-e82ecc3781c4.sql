-- Drop the existing approval policy
DROP POLICY IF EXISTS "Managers can approve leaves" ON public.leave_applications;

-- Create new policy: Reporting manager can approve leaves
-- The reporting manager is the person the user reports_to in profiles
CREATE POLICY "Reporting managers can approve leaves" 
ON public.leave_applications 
FOR UPDATE 
TO authenticated
USING (
  -- Admins can still approve
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'super_admin'::app_role) 
  OR has_role(auth.uid(), 'platform_admin'::app_role)
  -- Reporting manager can approve (user reports_to = current user)
  OR EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = leave_applications.user_id 
    AND profiles.reports_to = auth.uid()
  )
);