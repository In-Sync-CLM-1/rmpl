
DROP POLICY IF EXISTS "HR admins can manage salary details" ON public.employee_salary_details;
CREATE POLICY "HR admins can manage salary details"
ON public.employee_salary_details FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('platform_admin','super_admin','admin_tech','admin_administration','hr_manager')
  )
);
