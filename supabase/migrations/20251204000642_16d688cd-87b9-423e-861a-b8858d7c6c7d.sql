-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view their general tasks" ON public.general_tasks;

-- Create updated SELECT policy with is_admin_user for better compatibility
CREATE POLICY "Users can view their general tasks" 
ON public.general_tasks 
FOR SELECT 
USING (
  auth.uid() = assigned_to 
  OR auth.uid() = assigned_by 
  OR is_admin_user(auth.uid())
);