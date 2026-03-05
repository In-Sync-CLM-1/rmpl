-- Fix table policy: add WITH CHECK for INSERT
DROP POLICY IF EXISTS "HR admins can manage documents" ON public.hr_policy_documents;

CREATE POLICY "HR admins can manage documents"
ON public.hr_policy_documents
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

-- Fix storage INSERT policy: add 'admin' role
DROP POLICY IF EXISTS "HR admins can upload HR documents" ON storage.objects;

CREATE POLICY "HR admins can upload HR documents"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'hr-policy-documents'
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = ANY (ARRAY['platform_admin'::app_role, 'super_admin'::app_role, 'admin_tech'::app_role, 'admin'::app_role, 'admin_administration'::app_role])
  )
);

-- Add UPDATE policy for storage
CREATE POLICY "HR admins can update HR documents storage"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'hr-policy-documents'
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = ANY (ARRAY['platform_admin'::app_role, 'super_admin'::app_role, 'admin_tech'::app_role, 'admin'::app_role, 'admin_administration'::app_role])
  )
);