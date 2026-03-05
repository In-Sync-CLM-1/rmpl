-- HR Policy Documents table
CREATE TABLE IF NOT EXISTS public.hr_policy_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL, -- 'HR Policies', 'Leave Policy', 'Attendance Policy', 'Code of Conduct', 'Internal Documents'
  title TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  version TEXT DEFAULT '1.0',
  is_active BOOLEAN DEFAULT true,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.hr_policy_documents ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view active documents
CREATE POLICY "All users can view active HR documents"
ON public.hr_policy_documents FOR SELECT
USING (is_active = true);

-- Only HR admins can manage documents
CREATE POLICY "HR admins can manage documents"
ON public.hr_policy_documents FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('platform_admin', 'super_admin', 'admin_tech', 'admin', 'admin_administration')
  )
);

-- Employee Salary Details table
CREATE TABLE IF NOT EXISTS public.employee_salary_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  employee_code TEXT,
  department TEXT,
  designation TEXT,
  date_of_joining DATE,
  pf_number TEXT,
  esi_number TEXT,
  uan_number TEXT,
  pan_number TEXT,
  bank_name TEXT,
  bank_account_number TEXT,
  ifsc_code TEXT,
  -- Salary components
  basic_salary NUMERIC DEFAULT 0,
  hra NUMERIC DEFAULT 0,
  conveyance_allowance NUMERIC DEFAULT 0,
  medical_allowance NUMERIC DEFAULT 0,
  special_allowance NUMERIC DEFAULT 0,
  other_allowance NUMERIC DEFAULT 0,
  -- Deduction percentages
  epf_percentage NUMERIC DEFAULT 12,
  esic_percentage NUMERIC DEFAULT 0.75,
  professional_tax NUMERIC DEFAULT 200,
  -- Metadata
  effective_from DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employee_salary_details ENABLE ROW LEVEL SECURITY;

-- Users can view their own salary details
CREATE POLICY "Users can view own salary details"
ON public.employee_salary_details FOR SELECT
USING (auth.uid() = user_id);

-- HR admins can manage all salary details
CREATE POLICY "HR admins can manage salary details"
ON public.employee_salary_details FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('platform_admin', 'super_admin', 'admin_tech', 'admin_administration')
  )
);

-- Salary Slips table
CREATE TABLE IF NOT EXISTS public.salary_slips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL,
  paid_days NUMERIC DEFAULT 0,
  loss_of_pay_days NUMERIC DEFAULT 0,
  -- Earnings
  basic_salary NUMERIC DEFAULT 0,
  hra NUMERIC DEFAULT 0,
  conveyance_allowance NUMERIC DEFAULT 0,
  medical_allowance NUMERIC DEFAULT 0,
  special_allowance NUMERIC DEFAULT 0,
  other_allowance NUMERIC DEFAULT 0,
  incentive NUMERIC DEFAULT 0,
  bonus NUMERIC DEFAULT 0,
  total_earnings NUMERIC DEFAULT 0,
  -- Deductions
  epf NUMERIC DEFAULT 0,
  esic NUMERIC DEFAULT 0,
  tds NUMERIC DEFAULT 0,
  professional_tax NUMERIC DEFAULT 0,
  health_insurance NUMERIC DEFAULT 0,
  salary_advance NUMERIC DEFAULT 0,
  other_deductions NUMERIC DEFAULT 0,
  total_deductions NUMERIC DEFAULT 0,
  -- Net
  net_pay NUMERIC DEFAULT 0,
  net_pay_words TEXT,
  -- Metadata
  generated_at TIMESTAMPTZ DEFAULT now(),
  generated_by UUID REFERENCES auth.users(id),
  is_published BOOLEAN DEFAULT false,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, month, year)
);

-- Enable RLS
ALTER TABLE public.salary_slips ENABLE ROW LEVEL SECURITY;

-- Users can view their own published salary slips
CREATE POLICY "Users can view own published slips"
ON public.salary_slips FOR SELECT
USING (auth.uid() = user_id AND is_published = true);

-- HR admins can manage all salary slips
CREATE POLICY "HR admins can manage salary slips"
ON public.salary_slips FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('platform_admin', 'super_admin', 'admin_tech', 'admin_administration')
  )
);

-- Add HR admin role permission check
CREATE OR REPLACE FUNCTION public.is_hr_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = check_user_id
    AND role IN ('platform_admin', 'super_admin', 'admin_tech', 'admin_administration')
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.is_hr_admin(UUID) TO authenticated;