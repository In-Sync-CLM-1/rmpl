-- Create navigation_sections table
CREATE TABLE public.navigation_sections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section_key text NOT NULL UNIQUE,
  section_label text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create navigation_items table
CREATE TABLE public.navigation_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id uuid NOT NULL REFERENCES public.navigation_sections(id) ON DELETE CASCADE,
  item_key text NOT NULL UNIQUE,
  item_title text NOT NULL,
  item_url text NOT NULL,
  icon_name text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  requires_auth_only boolean NOT NULL DEFAULT false,
  legacy_permission text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create user_view_permissions table
CREATE TABLE public.user_view_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  navigation_item_id uuid NOT NULL REFERENCES public.navigation_items(id) ON DELETE CASCADE,
  can_view boolean NOT NULL DEFAULT true,
  granted_by uuid REFERENCES public.profiles(id),
  granted_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, navigation_item_id)
);

-- Enable RLS
ALTER TABLE public.navigation_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.navigation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_view_permissions ENABLE ROW LEVEL SECURITY;

-- RLS policies for navigation_sections
CREATE POLICY "Authenticated users can view active sections"
  ON public.navigation_sections FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage sections"
  ON public.navigation_sections FOR ALL
  USING (is_admin_user(auth.uid()));

-- RLS policies for navigation_items
CREATE POLICY "Authenticated users can view active items"
  ON public.navigation_items FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage items"
  ON public.navigation_items FOR ALL
  USING (is_admin_user(auth.uid()));

-- RLS policies for user_view_permissions
CREATE POLICY "Users can view own permissions"
  ON public.user_view_permissions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all permissions"
  ON public.user_view_permissions FOR ALL
  USING (is_admin_user(auth.uid()));

-- Helper function to check if user can view a navigation item
CREATE OR REPLACE FUNCTION public.can_view_navigation_item(_user_id uuid, _item_key text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM user_view_permissions uvp
    JOIN navigation_items ni ON ni.id = uvp.navigation_item_id
    WHERE uvp.user_id = _user_id 
      AND ni.item_key = _item_key
      AND uvp.can_view = true
      AND ni.is_active = true
  )
$$;

-- Seed navigation_sections
INSERT INTO public.navigation_sections (section_key, section_label, display_order) VALUES
  ('DASHBOARDS', 'DASHBOARDS', 1),
  ('DEMANDCOM', 'DEMANDCOM', 2),
  ('LIVECOM', 'LIVECOM', 3),
  ('TASKS', 'TASKS', 4),
  ('CLIENTS', 'CLIENTS', 5),
  ('CSBD', 'CSBD', 6),
  ('INVENTORY', 'INVENTORY', 7),
  ('HR', 'HR', 8),
  ('MARKETING', 'MARKETING', 9),
  ('ADMIN', 'ADMIN', 10);

-- Seed navigation_items
INSERT INTO public.navigation_items (section_id, item_key, item_title, item_url, icon_name, display_order, requires_auth_only, legacy_permission) VALUES
  -- DASHBOARDS
  ((SELECT id FROM navigation_sections WHERE section_key = 'DASHBOARDS'), 'home', 'Home', '/dashboard', 'LayoutDashboard', 1, true, NULL),
  ((SELECT id FROM navigation_sections WHERE section_key = 'DASHBOARDS'), 'calendar', 'Calendar', '/calendar', 'Calendar', 2, true, NULL),
  ((SELECT id FROM navigation_sections WHERE section_key = 'DASHBOARDS'), 'executive_view', 'Executive View', '/executive-dashboard', 'BarChart3', 3, false, 'canViewCSBDDashboard'),
  -- DEMANDCOM
  ((SELECT id FROM navigation_sections WHERE section_key = 'DEMANDCOM'), 'demandcom_list', 'DemandCom List', '/demandcom', 'Database', 1, false, 'canViewDemandCom'),
  ((SELECT id FROM navigation_sections WHERE section_key = 'DEMANDCOM'), 'demandcom_dashboard', 'DemandCom Dashboard', '/demandcom-dashboard', 'BarChart', 2, false, 'canViewDemandCom'),
  ((SELECT id FROM navigation_sections WHERE section_key = 'DEMANDCOM'), 'daily_targets', 'Daily Targets', '/demandcom-daily-targets', 'Target', 3, false, 'canViewDemandCom'),
  ((SELECT id FROM navigation_sections WHERE section_key = 'DEMANDCOM'), 'advanced_filter', 'Advanced Filter', '/advanced-filter', 'Filter', 4, false, 'canViewDemandCom'),
  -- LIVECOM
  ((SELECT id FROM navigation_sections WHERE section_key = 'LIVECOM'), 'projects', 'Projects', '/projects', 'FolderKanban', 1, false, 'canViewProjects'),
  ((SELECT id FROM navigation_sections WHERE section_key = 'LIVECOM'), 'livecom_dashboard', 'LiveCom Dashboard', '/livecom-dashboard', 'BarChart', 2, false, 'canViewProjects'),
  -- TASKS
  ((SELECT id FROM navigation_sections WHERE section_key = 'TASKS'), 'all_tasks', 'All Tasks', '/tasks', 'ListTodo', 1, true, NULL),
  -- CLIENTS
  ((SELECT id FROM navigation_sections WHERE section_key = 'CLIENTS'), 'clients', 'Clients', '/clients', 'Building', 1, false, 'canViewClients'),
  ((SELECT id FROM navigation_sections WHERE section_key = 'CLIENTS'), 'vendors', 'Vendors', '/vendors', 'Factory', 2, false, 'canViewClients'),
  -- CSBD
  ((SELECT id FROM navigation_sections WHERE section_key = 'CSBD'), 'csbd_projections', 'CSBD Projections', '/csbd-projections', 'TrendingUp', 1, false, 'canViewCSBDDashboard'),
  -- INVENTORY
  ((SELECT id FROM navigation_sections WHERE section_key = 'INVENTORY'), 'inventory_list', 'Inventory', '/inventory', 'Package', 1, false, 'canViewInventory'),
  ((SELECT id FROM navigation_sections WHERE section_key = 'INVENTORY'), 'inventory_dashboard', 'Inventory Dashboard', '/inventory-dashboard', 'BarChart3', 2, false, 'canViewInventory'),
  ((SELECT id FROM navigation_sections WHERE section_key = 'INVENTORY'), 'ops_dashboard', 'Ops Dashboard', '/operations-inventory-dashboard', 'LayoutDashboard', 3, false, 'canViewInventory'),
  ((SELECT id FROM navigation_sections WHERE section_key = 'INVENTORY'), 'allocations', 'Allocations', '/inventory-allocation', 'UserPlus', 4, false, 'canViewInventory'),
  ((SELECT id FROM navigation_sections WHERE section_key = 'INVENTORY'), 'distribution', 'Distribution', '/operations-distribution', 'Truck', 5, false, 'canViewInventory'),
  -- HR
  ((SELECT id FROM navigation_sections WHERE section_key = 'HR'), 'attendance', 'Attendance', '/attendance', 'Clock', 1, true, NULL),
  ((SELECT id FROM navigation_sections WHERE section_key = 'HR'), 'attendance_reports', 'Attendance Reports', '/attendance-reports', 'FileText', 2, false, 'canViewAttendance'),
  ((SELECT id FROM navigation_sections WHERE section_key = 'HR'), 'leave_management', 'Leave Management', '/leave-management', 'CalendarOff', 3, true, NULL),
  ((SELECT id FROM navigation_sections WHERE section_key = 'HR'), 'leave_approvals', 'Leave Approvals', '/leave-approvals', 'CheckSquare', 4, false, 'canApproveLeave'),
  -- MARKETING
  ((SELECT id FROM navigation_sections WHERE section_key = 'MARKETING'), 'campaigns', 'Campaigns', '/campaigns', 'Mail', 1, false, 'canViewCampaigns'),
  ((SELECT id FROM navigation_sections WHERE section_key = 'MARKETING'), 'templates', 'Templates', '/templates', 'FileText', 2, false, 'canViewCampaigns'),
  -- ADMIN
  ((SELECT id FROM navigation_sections WHERE section_key = 'ADMIN'), 'users', 'Users', '/users', 'Users', 1, false, 'canViewUsers'),
  ((SELECT id FROM navigation_sections WHERE section_key = 'ADMIN'), 'teams', 'Teams', '/teams', 'UserCog', 2, false, 'canViewUsers'),
  ((SELECT id FROM navigation_sections WHERE section_key = 'ADMIN'), 'designations', 'Designations', '/designations', 'Award', 3, false, 'canViewUsers'),
  ((SELECT id FROM navigation_sections WHERE section_key = 'ADMIN'), 'dispositions', 'Dispositions', '/call-dispositions', 'Phone', 4, false, 'canManageDispositions'),
  ((SELECT id FROM navigation_sections WHERE section_key = 'ADMIN'), 'pipeline_stages', 'Pipeline Stages', '/pipeline-stages', 'GitBranch', 5, false, 'canManagePipeline'),
  ((SELECT id FROM navigation_sections WHERE section_key = 'ADMIN'), 'announcements', 'Announcements', '/announcements', 'Megaphone', 6, false, 'canViewUsers'),
  ((SELECT id FROM navigation_sections WHERE section_key = 'ADMIN'), 'webhooks', 'Webhooks', '/webhooks', 'Webhook', 7, false, 'canViewUsers'),
  ((SELECT id FROM navigation_sections WHERE section_key = 'ADMIN'), 'view_controller', 'View Controller', '/view-controller', 'Eye', 8, false, 'canViewUsers');