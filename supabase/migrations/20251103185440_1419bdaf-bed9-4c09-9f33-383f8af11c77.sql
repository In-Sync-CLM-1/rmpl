-- Create leave type enum
CREATE TYPE leave_type AS ENUM (
  'sick_leave',
  'casual_leave',
  'earned_leave',
  'unpaid_leave',
  'compensatory_off',
  'maternity_leave',
  'paternity_leave'
);

-- Create leave status enum
CREATE TYPE leave_status AS ENUM (
  'pending',
  'approved',
  'rejected',
  'cancelled'
);

-- Create attendance_records table
CREATE TABLE public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  sign_in_time TIMESTAMP WITH TIME ZONE,
  sign_out_time TIMESTAMP WITH TIME ZONE,
  total_hours NUMERIC(5,2),
  status TEXT NOT NULL DEFAULT 'present',
  location_lat NUMERIC(10,7),
  location_lng NUMERIC(10,7),
  sign_in_device_info JSONB,
  sign_out_device_info JSONB,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX idx_attendance_user_date ON public.attendance_records(user_id, date);
CREATE INDEX idx_attendance_date ON public.attendance_records(date);

-- Enable RLS on attendance_records
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- Attendance RLS policies
CREATE POLICY "Users can view own attendance"
ON public.attendance_records FOR SELECT
USING (auth.uid() = user_id OR can_access_user(auth.uid(), user_id));

CREATE POLICY "Users can sign in/out"
ON public.attendance_records FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own attendance"
ON public.attendance_records FOR UPDATE
USING (auth.uid() = user_id AND date = CURRENT_DATE);

CREATE POLICY "Admins can manage all attendance"
ON public.attendance_records FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'platform_admin'::app_role) OR
  has_role(auth.uid(), 'admin_administration'::app_role)
);

-- Create leave_applications table
CREATE TABLE public.leave_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  leave_type leave_type NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days NUMERIC(3,1) NOT NULL,
  reason TEXT NOT NULL,
  status leave_status NOT NULL DEFAULT 'pending',
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  attachments JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_leave_user ON public.leave_applications(user_id);
CREATE INDEX idx_leave_status ON public.leave_applications(status);
CREATE INDEX idx_leave_dates ON public.leave_applications(start_date, end_date);

-- Enable RLS on leave_applications
ALTER TABLE public.leave_applications ENABLE ROW LEVEL SECURITY;

-- Leave applications RLS policies
CREATE POLICY "Users can view own leaves"
ON public.leave_applications FOR SELECT
USING (auth.uid() = user_id OR can_access_user(auth.uid(), user_id));

CREATE POLICY "Users can apply for leave"
ON public.leave_applications FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update pending leaves"
ON public.leave_applications FOR UPDATE
USING (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Managers can approve leaves"
ON public.leave_applications FOR UPDATE
USING (
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'platform_admin'::app_role) OR
  has_role(auth.uid(), 'admin_administration'::app_role)
);

-- Create leave_balances table
CREATE TABLE public.leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  sick_leave_balance NUMERIC(4,1) DEFAULT 12,
  casual_leave_balance NUMERIC(4,1) DEFAULT 12,
  earned_leave_balance NUMERIC(4,1) DEFAULT 15,
  compensatory_off_balance NUMERIC(4,1) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, year)
);

CREATE INDEX idx_leave_balance_user_year ON public.leave_balances(user_id, year);

-- Enable RLS on leave_balances
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own leave balance"
ON public.leave_balances FOR SELECT
USING (auth.uid() = user_id OR can_access_user(auth.uid(), user_id));

CREATE POLICY "Admins can manage leave balances"
ON public.leave_balances FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'platform_admin'::app_role) OR
  has_role(auth.uid(), 'admin_administration'::app_role)
);

-- Create attendance_policies table
CREATE TABLE public.attendance_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_name TEXT NOT NULL,
  working_hours_per_day NUMERIC(3,1) DEFAULT 8,
  grace_period_minutes INTEGER DEFAULT 15,
  half_day_threshold_hours NUMERIC(3,1) DEFAULT 4,
  overtime_start_after_hours NUMERIC(3,1) DEFAULT 8,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on attendance_policies
ALTER TABLE public.attendance_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view policies"
ON public.attendance_policies FOR SELECT
USING (true);

CREATE POLICY "Admins can manage policies"
ON public.attendance_policies FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'platform_admin'::app_role) OR
  has_role(auth.uid(), 'admin_administration'::app_role)
);

-- Function to calculate attendance hours
CREATE OR REPLACE FUNCTION public.calculate_attendance_hours()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sign_in_time IS NOT NULL AND NEW.sign_out_time IS NOT NULL THEN
    NEW.total_hours = EXTRACT(EPOCH FROM (NEW.sign_out_time - NEW.sign_in_time)) / 3600;
    
    IF NEW.total_hours >= 8 THEN
      NEW.status = 'present';
    ELSIF NEW.total_hours >= 4 THEN
      NEW.status = 'half_day';
    ELSE
      NEW.status = 'absent';
    END IF;
  END IF;
  
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Trigger to calculate attendance hours
CREATE TRIGGER trigger_calculate_attendance_hours
BEFORE INSERT OR UPDATE ON public.attendance_records
FOR EACH ROW EXECUTE FUNCTION public.calculate_attendance_hours();

-- Function to update leave balance on approval
CREATE OR REPLACE FUNCTION public.update_leave_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When leave is approved, deduct from balance
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    UPDATE public.leave_balances
    SET 
      sick_leave_balance = CASE 
        WHEN NEW.leave_type = 'sick_leave' THEN sick_leave_balance - NEW.total_days
        ELSE sick_leave_balance
      END,
      casual_leave_balance = CASE 
        WHEN NEW.leave_type = 'casual_leave' THEN casual_leave_balance - NEW.total_days
        ELSE casual_leave_balance
      END,
      earned_leave_balance = CASE 
        WHEN NEW.leave_type = 'earned_leave' THEN earned_leave_balance - NEW.total_days
        ELSE earned_leave_balance
      END,
      compensatory_off_balance = CASE 
        WHEN NEW.leave_type = 'compensatory_off' THEN compensatory_off_balance - NEW.total_days
        ELSE compensatory_off_balance
      END,
      updated_at = NOW()
    WHERE user_id = NEW.user_id 
      AND year = EXTRACT(YEAR FROM NEW.start_date);
  END IF;
  
  -- When leave is cancelled or rejected, add back to balance
  IF (NEW.status = 'cancelled' OR NEW.status = 'rejected') AND OLD.status = 'approved' THEN
    UPDATE public.leave_balances
    SET 
      sick_leave_balance = CASE 
        WHEN NEW.leave_type = 'sick_leave' THEN sick_leave_balance + NEW.total_days
        ELSE sick_leave_balance
      END,
      casual_leave_balance = CASE 
        WHEN NEW.leave_type = 'casual_leave' THEN casual_leave_balance + NEW.total_days
        ELSE casual_leave_balance
      END,
      earned_leave_balance = CASE 
        WHEN NEW.leave_type = 'earned_leave' THEN earned_leave_balance + NEW.total_days
        ELSE earned_leave_balance
      END,
      compensatory_off_balance = CASE 
        WHEN NEW.leave_type = 'compensatory_off' THEN compensatory_off_balance + NEW.total_days
        ELSE compensatory_off_balance
      END,
      updated_at = NOW()
    WHERE user_id = NEW.user_id 
      AND year = EXTRACT(YEAR FROM NEW.start_date);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger to update leave balance
CREATE TRIGGER trigger_update_leave_balance
AFTER UPDATE ON public.leave_applications
FOR EACH ROW EXECUTE FUNCTION public.update_leave_balance();

-- Function to initialize leave balance for new users
CREATE OR REPLACE FUNCTION public.initialize_leave_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.leave_balances (user_id, year)
  VALUES (NEW.id, EXTRACT(YEAR FROM CURRENT_DATE))
  ON CONFLICT (user_id, year) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Trigger to initialize leave balance for new users
CREATE TRIGGER trigger_initialize_leave_balance
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.initialize_leave_balance();