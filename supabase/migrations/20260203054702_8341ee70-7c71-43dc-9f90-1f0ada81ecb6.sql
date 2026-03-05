-- First, add hr_manager to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'hr_manager';

-- Create leave_balance_adjustments table for audit trail
CREATE TABLE public.leave_balance_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  adjusted_by UUID NOT NULL,
  leave_type TEXT NOT NULL,
  adjustment_type TEXT NOT NULL,
  days NUMERIC NOT NULL,
  previous_balance NUMERIC,
  new_balance NUMERIC,
  reason TEXT NOT NULL,
  year INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add validation trigger for adjustment_type
CREATE OR REPLACE FUNCTION public.validate_adjustment_type()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.adjustment_type NOT IN ('add', 'deduct') THEN
    RAISE EXCEPTION 'adjustment_type must be either add or deduct';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_leave_adjustment_type
  BEFORE INSERT OR UPDATE ON public.leave_balance_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_adjustment_type();

-- Enable RLS
ALTER TABLE public.leave_balance_adjustments ENABLE ROW LEVEL SECURITY;

-- Policy: HR admins can manage adjustments (using existing roles only)
CREATE POLICY "hr_admins_manage_adjustments" ON public.leave_balance_adjustments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role::text IN ('platform_admin', 'super_admin', 'admin_administration', 'admin_tech', 'hr_manager')
    )
  );

-- Create index for faster queries
CREATE INDEX idx_leave_balance_adjustments_user_year 
  ON public.leave_balance_adjustments(user_id, year);

CREATE INDEX idx_leave_balance_adjustments_created 
  ON public.leave_balance_adjustments(created_at DESC);