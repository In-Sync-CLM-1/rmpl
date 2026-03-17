-- Fix RLS policies to allow HR admins to bulk-import employee data
-- Currently INSERT/UPDATE on employee_personal_details and profiles UPDATE
-- only allow self-access, blocking the HR import workflow.

-- Allow HR admins to INSERT employee_personal_details for any user
CREATE POLICY "HR admins can insert personal details"
ON employee_personal_details
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = ANY(ARRAY['platform_admin'::app_role, 'super_admin'::app_role, 'admin_administration'::app_role, 'admin_tech'::app_role, 'hr_manager'::app_role])
  )
);

-- Allow HR admins to UPDATE employee_personal_details for any user
CREATE POLICY "HR admins can update personal details"
ON employee_personal_details
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = ANY(ARRAY['platform_admin'::app_role, 'super_admin'::app_role, 'admin_administration'::app_role, 'admin_tech'::app_role, 'hr_manager'::app_role])
  )
);

-- Allow HR admins to UPDATE profiles for any user (name, phone, branch)
CREATE POLICY "HR admins can update profiles"
ON profiles
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = ANY(ARRAY['platform_admin'::app_role, 'super_admin'::app_role, 'admin_administration'::app_role, 'admin_tech'::app_role, 'hr_manager'::app_role])
  )
);
