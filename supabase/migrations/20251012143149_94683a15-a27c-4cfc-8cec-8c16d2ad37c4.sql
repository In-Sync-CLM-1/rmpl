-- Create role_metadata table to store role information and assignment rules
CREATE TABLE IF NOT EXISTS public.role_metadata (
  role app_role PRIMARY KEY,
  display_name text NOT NULL,
  description text,
  can_be_assigned_by app_role[] NOT NULL DEFAULT '{}',
  is_visible_in_ui boolean NOT NULL DEFAULT true,
  hierarchy_level integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on role_metadata
ALTER TABLE public.role_metadata ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to view role metadata
CREATE POLICY "Authenticated users can view role metadata"
ON public.role_metadata
FOR SELECT
TO authenticated
USING (true);

-- Seed role_metadata table with initial roles
INSERT INTO public.role_metadata (role, display_name, description, can_be_assigned_by, is_visible_in_ui, hierarchy_level) VALUES
  ('platform_admin', 'Platform Admin', 'Highest level admin with full system access', '{}', false, 1),
  ('super_admin', 'Super Admin', 'System administrator with full access', '{platform_admin}', false, 2),
  ('admin_administration', 'Administration Admin', 'Manages users, teams, and HR functions', '{platform_admin, super_admin}', true, 3),
  ('admin_tech', 'Tech Admin', 'Manages system configuration and integrations', '{platform_admin, super_admin}', true, 3),
  ('admin', 'Admin', 'General administrative access', '{platform_admin, super_admin}', true, 4),
  ('manager', 'Manager', 'Team lead, manages clients and jobs', '{platform_admin, super_admin, admin_administration}', true, 5),
  ('agent', 'Agent', 'Regular user, handles candidates and daily operations', '{platform_admin, super_admin, admin_administration, manager}', true, 6),
  ('user', 'User', 'Basic access (legacy role)', '{platform_admin, super_admin, admin_administration}', true, 7),
  ('client', 'Client', 'External client access', '{platform_admin, super_admin, admin}', true, 8)
ON CONFLICT (role) DO NOTHING;