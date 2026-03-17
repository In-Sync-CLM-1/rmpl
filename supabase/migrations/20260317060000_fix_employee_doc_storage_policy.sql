-- Fix: platform_admin and hr_manager cannot preview employee documents
-- The storage SELECT policy only included admin, admin_administration, super_admin
-- Missing: platform_admin, hr_manager

DROP POLICY IF EXISTS "HR can view all employee documents in storage" ON storage.objects;

CREATE POLICY "HR can view all employee documents in storage"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'employee-documents'
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = ANY(ARRAY[
      'platform_admin'::app_role,
      'super_admin'::app_role,
      'admin'::app_role,
      'admin_administration'::app_role,
      'hr_manager'::app_role
    ])
  )
);
