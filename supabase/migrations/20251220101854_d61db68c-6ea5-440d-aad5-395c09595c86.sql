-- Create enum for regularization types
CREATE TYPE public.regularization_type AS ENUM (
  'forgot_signin',
  'forgot_signout',
  'time_correction',
  'location_issue',
  'other'
);

-- Create enum for regularization status
CREATE TYPE public.regularization_status AS ENUM (
  'pending',
  'approved',
  'rejected'
);

-- Create the attendance_regularizations table
CREATE TABLE public.attendance_regularizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  regularization_type regularization_type NOT NULL,
  original_sign_in_time TIMESTAMPTZ,
  original_sign_out_time TIMESTAMPTZ,
  requested_sign_in_time TIMESTAMPTZ,
  requested_sign_out_time TIMESTAMPTZ,
  reason TEXT NOT NULL,
  status regularization_status NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.attendance_regularizations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own regularization requests
CREATE POLICY "Users can view their own regularizations"
ON public.attendance_regularizations
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can create their own regularization requests
CREATE POLICY "Users can create their own regularizations"
ON public.attendance_regularizations
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own pending requests
CREATE POLICY "Users can update own pending regularizations"
ON public.attendance_regularizations
FOR UPDATE
USING (auth.uid() = user_id AND status = 'pending')
WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- Policy: Users can delete their own pending requests
CREATE POLICY "Users can delete own pending regularizations"
ON public.attendance_regularizations
FOR DELETE
USING (auth.uid() = user_id AND status = 'pending');

-- Policy: Managers can view subordinates' regularizations
CREATE POLICY "Managers can view subordinates regularizations"
ON public.attendance_regularizations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = attendance_regularizations.user_id
    AND p.reports_to = auth.uid()
  )
);

-- Policy: Managers can update (approve/reject) subordinates' regularizations
CREATE POLICY "Managers can update subordinates regularizations"
ON public.attendance_regularizations
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = attendance_regularizations.user_id
    AND p.reports_to = auth.uid()
  )
);

-- Policy: Admins can view all regularizations
CREATE POLICY "Admins can view all regularizations"
ON public.attendance_regularizations
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'super_admin') OR
  public.has_role(auth.uid(), 'platform_admin')
);

-- Policy: Admins can update all regularizations
CREATE POLICY "Admins can update all regularizations"
ON public.attendance_regularizations
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'super_admin') OR
  public.has_role(auth.uid(), 'platform_admin')
);

-- Create a trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_attendance_regularizations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_attendance_regularizations_updated_at
BEFORE UPDATE ON public.attendance_regularizations
FOR EACH ROW
EXECUTE FUNCTION public.update_attendance_regularizations_updated_at();

-- Create a function to handle auto-update of attendance_records on approval
CREATE OR REPLACE FUNCTION public.apply_attendance_regularization()
RETURNS TRIGGER AS $$
DECLARE
  v_sign_in_time TIMESTAMPTZ;
  v_sign_out_time TIMESTAMPTZ;
  v_total_hours NUMERIC;
  v_status TEXT;
  v_existing_record_id UUID;
BEGIN
  -- Only process if status changed to approved
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    -- Determine sign in/out times
    v_sign_in_time := COALESCE(NEW.requested_sign_in_time, NEW.original_sign_in_time);
    v_sign_out_time := COALESCE(NEW.requested_sign_out_time, NEW.original_sign_out_time);
    
    -- Calculate total hours if both times are present
    IF v_sign_in_time IS NOT NULL AND v_sign_out_time IS NOT NULL THEN
      v_total_hours := EXTRACT(EPOCH FROM (v_sign_out_time - v_sign_in_time)) / 3600.0;
      -- Determine status based on hours
      IF v_total_hours >= 7 THEN
        v_status := 'present';
      ELSIF v_total_hours >= 4 THEN
        v_status := 'half_day';
      ELSE
        v_status := 'present';
      END IF;
    ELSE
      v_total_hours := NULL;
      v_status := 'present';
    END IF;
    
    -- Check for existing attendance record
    SELECT id INTO v_existing_record_id
    FROM public.attendance_records
    WHERE user_id = NEW.user_id AND date = NEW.attendance_date;
    
    IF v_existing_record_id IS NOT NULL THEN
      -- Update existing record
      UPDATE public.attendance_records
      SET 
        sign_in_time = COALESCE(v_sign_in_time, sign_in_time),
        sign_out_time = COALESCE(v_sign_out_time, sign_out_time),
        total_hours = v_total_hours,
        status = v_status,
        notes = COALESCE(notes, '') || ' [Regularized: ' || NEW.regularization_type::TEXT || ']',
        updated_at = now()
      WHERE id = v_existing_record_id;
    ELSE
      -- Create new attendance record
      INSERT INTO public.attendance_records (
        user_id,
        date,
        sign_in_time,
        sign_out_time,
        total_hours,
        status,
        notes
      ) VALUES (
        NEW.user_id,
        NEW.attendance_date,
        v_sign_in_time,
        v_sign_out_time,
        v_total_hours,
        v_status,
        '[Regularized: ' || NEW.regularization_type::TEXT || '] ' || NEW.reason
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to apply regularization on approval
CREATE TRIGGER apply_attendance_regularization_trigger
AFTER UPDATE ON public.attendance_regularizations
FOR EACH ROW
EXECUTE FUNCTION public.apply_attendance_regularization();