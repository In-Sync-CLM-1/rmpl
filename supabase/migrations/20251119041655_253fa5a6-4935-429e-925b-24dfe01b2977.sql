
-- Update role_metadata for new roles
INSERT INTO role_metadata (role, display_name, description, hierarchy_level, can_be_assigned_by, is_visible_in_ui)
VALUES 
  ('csbd', 'CSBD Team', 'Corporate Sales & Business Development team member', 30, ARRAY['admin', 'platform_admin', 'super_admin']::app_role[], true),
  ('leadership', 'Leadership', 'Executive leadership with full visibility', 5, ARRAY['platform_admin', 'super_admin']::app_role[], true)
ON CONFLICT (role) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  hierarchy_level = EXCLUDED.hierarchy_level;

-- Create CSBD Targets Table (Annual Targets)
CREATE TABLE IF NOT EXISTS public.csbd_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  fiscal_year INTEGER NOT NULL,
  annual_target_inr_lacs NUMERIC(10, 2) NOT NULL,
  has_subordinates BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, fiscal_year),
  CHECK (annual_target_inr_lacs > 0),
  CHECK (fiscal_year >= 2020 AND fiscal_year <= 2100)
);

CREATE INDEX IF NOT EXISTS idx_csbd_targets_user_id ON csbd_targets(user_id);
CREATE INDEX IF NOT EXISTS idx_csbd_targets_fiscal_year ON csbd_targets(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_csbd_targets_active ON csbd_targets(is_active) WHERE is_active = true;

DROP TRIGGER IF EXISTS update_csbd_targets_updated_at ON csbd_targets;
CREATE TRIGGER update_csbd_targets_updated_at
  BEFORE UPDATE ON csbd_targets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE csbd_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "CSBD and leadership can view targets" ON csbd_targets;
CREATE POLICY "CSBD and leadership can view targets"
  ON csbd_targets FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'csbd'::app_role) OR
    has_role(auth.uid(), 'leadership'::app_role) OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'platform_admin'::app_role)
  );

DROP POLICY IF EXISTS "Admins can manage targets" ON csbd_targets;
CREATE POLICY "Admins can manage targets"
  ON csbd_targets FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'platform_admin'::app_role)
  );

-- Create CSBD Projections Table (Monthly Projections)
CREATE TABLE IF NOT EXISTS public.csbd_projections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  projection_amount_inr_lacs NUMERIC(10, 2) NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, month),
  CHECK (projection_amount_inr_lacs >= 0),
  CHECK (EXTRACT(DAY FROM month) = 1)
);

CREATE INDEX IF NOT EXISTS idx_csbd_projections_user_id ON csbd_projections(user_id);
CREATE INDEX IF NOT EXISTS idx_csbd_projections_month ON csbd_projections(month);
CREATE INDEX IF NOT EXISTS idx_csbd_projections_user_month ON csbd_projections(user_id, month);

DROP TRIGGER IF EXISTS update_csbd_projections_updated_at ON csbd_projections;
CREATE TRIGGER update_csbd_projections_updated_at
  BEFORE UPDATE ON csbd_projections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE csbd_projections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own projections" ON csbd_projections;
CREATE POLICY "Users can view their own projections"
  ON csbd_projections FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.reports_to = auth.uid() 
      AND profiles.id = csbd_projections.user_id
    ) OR
    has_role(auth.uid(), 'csbd'::app_role) OR
    has_role(auth.uid(), 'leadership'::app_role) OR
    has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "Users can manage their own projections" ON csbd_projections;
CREATE POLICY "Users can manage their own projections"
  ON csbd_projections FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage all projections" ON csbd_projections;
CREATE POLICY "Admins can manage all projections"
  ON csbd_projections FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'platform_admin'::app_role)
  );

-- Create Projection Audit Log
CREATE TABLE IF NOT EXISTS public.csbd_projection_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projection_id UUID NOT NULL REFERENCES csbd_projections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  action TEXT NOT NULL,
  old_value NUMERIC(10, 2),
  new_value NUMERIC(10, 2),
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_csbd_projection_audit_projection_id ON csbd_projection_audit(projection_id);
CREATE INDEX IF NOT EXISTS idx_csbd_projection_audit_user_id ON csbd_projection_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_csbd_projection_audit_changed_at ON csbd_projection_audit(changed_at);

ALTER TABLE csbd_projection_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leadership can view audit logs" ON csbd_projection_audit;
CREATE POLICY "Leadership can view audit logs"
  ON csbd_projection_audit FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'leadership'::app_role) OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'platform_admin'::app_role)
  );

-- Audit trigger function
CREATE OR REPLACE FUNCTION log_csbd_projection_change()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO csbd_projection_audit (projection_id, user_id, action, new_value, changed_by)
    VALUES (NEW.id, NEW.user_id, 'created', NEW.projection_amount_inr_lacs, auth.uid());
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (OLD.projection_amount_inr_lacs != NEW.projection_amount_inr_lacs) THEN
      INSERT INTO csbd_projection_audit (projection_id, user_id, action, old_value, new_value, changed_by)
      VALUES (NEW.id, NEW.user_id, 'updated', OLD.projection_amount_inr_lacs, NEW.projection_amount_inr_lacs, auth.uid());
    END IF;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO csbd_projection_audit (projection_id, user_id, action, old_value, changed_by)
    VALUES (OLD.id, OLD.user_id, 'deleted', OLD.projection_amount_inr_lacs, auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS csbd_projection_audit_trigger ON csbd_projections;
CREATE TRIGGER csbd_projection_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON csbd_projections
  FOR EACH ROW
  EXECUTE FUNCTION log_csbd_projection_change();

-- Create view for CSBD actuals from projects
CREATE OR REPLACE VIEW public.csbd_actuals AS
SELECT 
  created_by as user_id,
  DATE_TRUNC('month', updated_at) as month,
  SUM(COALESCE(final_afactor, expected_afactor, 0)) as actual_amount_inr_lacs,
  COUNT(*) as deals_closed,
  ARRAY_AGG(project_number ORDER BY updated_at DESC) as project_numbers
FROM projects
WHERE status = 'invoiced'
  AND (final_afactor IS NOT NULL OR expected_afactor IS NOT NULL)
GROUP BY created_by, DATE_TRUNC('month', updated_at);

-- Assign CSBD roles
INSERT INTO user_roles (user_id, role)
VALUES 
  ('534e7e23-0148-44e3-8a0b-63e300f524cb', 'csbd'),
  ('534e7e23-0148-44e3-8a0b-63e300f524cb', 'leadership'),
  ('abf0cb30-d00d-46bd-af88-829381676010', 'csbd'),
  ('37623f10-3d6c-496f-a63e-3655609d604c', 'csbd'),
  ('522d9cb4-ada4-45ea-896b-1c42381e231c', 'csbd'),
  ('58c3d693-4569-4022-a101-7f5c7d25410d', 'csbd'),
  ('07b06fca-df81-48fc-8837-7ab513a1832e', 'csbd')
ON CONFLICT (user_id, role) DO NOTHING;

-- Seed CSBD targets for FY 2025
INSERT INTO csbd_targets (user_id, fiscal_year, annual_target_inr_lacs, has_subordinates, created_by)
VALUES 
  ('534e7e23-0148-44e3-8a0b-63e300f524cb', 2025, 500.00, true, '534e7e23-0148-44e3-8a0b-63e300f524cb'),
  ('abf0cb30-d00d-46bd-af88-829381676010', 2025, 280.00, false, '534e7e23-0148-44e3-8a0b-63e300f524cb'),
  ('37623f10-3d6c-496f-a63e-3655609d604c', 2025, 270.00, false, '534e7e23-0148-44e3-8a0b-63e300f524cb'),
  ('522d9cb4-ada4-45ea-896b-1c42381e231c', 2025, 300.00, false, '534e7e23-0148-44e3-8a0b-63e300f524cb'),
  ('58c3d693-4569-4022-a101-7f5c7d25410d', 2025, 60.00, false, '534e7e23-0148-44e3-8a0b-63e300f524cb'),
  ('07b06fca-df81-48fc-8837-7ab513a1832e', 2025, 85.00, false, '534e7e23-0148-44e3-8a0b-63e300f524cb')
ON CONFLICT (user_id, fiscal_year) DO NOTHING;
