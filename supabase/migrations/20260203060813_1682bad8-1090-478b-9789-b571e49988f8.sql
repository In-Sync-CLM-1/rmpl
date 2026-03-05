-- Create employee_personal_details table for HR data
CREATE TABLE public.employee_personal_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  date_of_birth DATE,
  marital_status TEXT CHECK (marital_status IN ('single', 'married', 'divorced', 'widowed')),
  aadhar_number TEXT,
  father_name TEXT,
  mother_name TEXT,
  emergency_contact_number TEXT,
  personal_email TEXT,
  present_address TEXT,
  permanent_address TEXT,
  blood_group TEXT CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.employee_personal_details ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own data
CREATE POLICY "Users can view own personal details"
ON public.employee_personal_details
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can insert their own data
CREATE POLICY "Users can insert own personal details"
ON public.employee_personal_details
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own data
CREATE POLICY "Users can update own personal details"
ON public.employee_personal_details
FOR UPDATE
USING (auth.uid() = user_id);

-- Policy: HR admins can view all employee data
CREATE POLICY "HR admins can view all personal details"
ON public.employee_personal_details
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('platform_admin', 'super_admin', 'admin_administration', 'admin_tech', 'hr_manager')
  )
);

-- Create updated_at trigger
CREATE TRIGGER update_employee_personal_details_updated_at
BEFORE UPDATE ON public.employee_personal_details
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Assign hr_manager role to hr@redefine.in
INSERT INTO public.user_roles (user_id, role)
VALUES ('ae3869ea-b6fc-41e7-8596-f0a90772cc99', 'hr_manager')
ON CONFLICT (user_id, role) DO NOTHING;