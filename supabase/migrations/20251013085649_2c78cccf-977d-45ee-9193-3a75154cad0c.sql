-- Update campaigns DELETE policy to allow users to delete their own campaigns
DROP POLICY IF EXISTS "Admins can delete campaigns" ON public.campaigns;

CREATE POLICY "Users can delete their own campaigns or admins can delete any"
ON public.campaigns
FOR DELETE
USING (
  auth.uid() = created_by 
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'super_admin'::app_role)
);