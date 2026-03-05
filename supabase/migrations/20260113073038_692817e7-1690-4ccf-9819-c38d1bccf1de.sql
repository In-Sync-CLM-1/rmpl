-- Add leave limit columns to track yearly allocation per user
ALTER TABLE leave_balances 
  ADD COLUMN IF NOT EXISTS sick_leave_limit NUMERIC DEFAULT 12,
  ADD COLUMN IF NOT EXISTS casual_leave_limit NUMERIC DEFAULT 12,
  ADD COLUMN IF NOT EXISTS earned_leave_limit NUMERIC DEFAULT 15,
  ADD COLUMN IF NOT EXISTS compensatory_off_limit NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS maternity_leave_limit NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paternity_leave_limit NUMERIC DEFAULT 0;

-- Set initial limits equal to current balance defaults for existing records
UPDATE leave_balances 
SET 
  sick_leave_limit = COALESCE(sick_leave_limit, 12),
  casual_leave_limit = COALESCE(casual_leave_limit, 12),
  earned_leave_limit = COALESCE(earned_leave_limit, 15),
  compensatory_off_limit = COALESCE(compensatory_off_limit, 0),
  maternity_leave_limit = COALESCE(maternity_leave_limit, 0),
  paternity_leave_limit = COALESCE(paternity_leave_limit, 0);

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_leave_status_change ON leave_applications;

-- Create or replace the update_leave_balance function with maternity/paternity support
CREATE OR REPLACE FUNCTION update_leave_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- When leave is approved (from pending)
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    UPDATE public.leave_balances
    SET 
      sick_leave_balance = CASE WHEN NEW.leave_type = 'sick_leave' THEN GREATEST(0, sick_leave_balance - NEW.total_days) ELSE sick_leave_balance END,
      casual_leave_balance = CASE WHEN NEW.leave_type = 'casual_leave' THEN GREATEST(0, casual_leave_balance - NEW.total_days) ELSE casual_leave_balance END,
      earned_leave_balance = CASE WHEN NEW.leave_type = 'earned_leave' THEN GREATEST(0, earned_leave_balance - NEW.total_days) ELSE earned_leave_balance END,
      compensatory_off_balance = CASE WHEN NEW.leave_type = 'compensatory_off' THEN GREATEST(0, compensatory_off_balance - NEW.total_days) ELSE compensatory_off_balance END,
      maternity_leave_balance = CASE WHEN NEW.leave_type = 'maternity_leave' THEN GREATEST(0, maternity_leave_balance - NEW.total_days) ELSE maternity_leave_balance END,
      paternity_leave_balance = CASE WHEN NEW.leave_type = 'paternity_leave' THEN GREATEST(0, paternity_leave_balance - NEW.total_days) ELSE paternity_leave_balance END,
      updated_at = NOW()
    WHERE user_id = NEW.user_id AND year = EXTRACT(YEAR FROM NEW.start_date);
  END IF;
  
  -- When approved leave is cancelled or rejected - restore balance
  IF (NEW.status = 'cancelled' OR NEW.status = 'rejected') AND OLD.status = 'approved' THEN
    UPDATE public.leave_balances
    SET 
      sick_leave_balance = CASE WHEN NEW.leave_type = 'sick_leave' THEN sick_leave_balance + NEW.total_days ELSE sick_leave_balance END,
      casual_leave_balance = CASE WHEN NEW.leave_type = 'casual_leave' THEN casual_leave_balance + NEW.total_days ELSE casual_leave_balance END,
      earned_leave_balance = CASE WHEN NEW.leave_type = 'earned_leave' THEN earned_leave_balance + NEW.total_days ELSE earned_leave_balance END,
      compensatory_off_balance = CASE WHEN NEW.leave_type = 'compensatory_off' THEN compensatory_off_balance + NEW.total_days ELSE compensatory_off_balance END,
      maternity_leave_balance = CASE WHEN NEW.leave_type = 'maternity_leave' THEN maternity_leave_balance + NEW.total_days ELSE maternity_leave_balance END,
      paternity_leave_balance = CASE WHEN NEW.leave_type = 'paternity_leave' THEN paternity_leave_balance + NEW.total_days ELSE paternity_leave_balance END,
      updated_at = NOW()
    WHERE user_id = NEW.user_id AND year = EXTRACT(YEAR FROM NEW.start_date);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to auto-deduct balances when leave status changes
CREATE TRIGGER on_leave_status_change
  AFTER UPDATE OF status ON leave_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_leave_balance();

-- Recalculate balances for all users based on approved leaves (fix historical data)
UPDATE leave_balances lb
SET 
  sick_leave_balance = lb.sick_leave_limit - COALESCE((
    SELECT SUM(total_days) FROM leave_applications 
    WHERE user_id = lb.user_id AND leave_type = 'sick_leave' 
    AND status = 'approved' AND EXTRACT(YEAR FROM start_date) = lb.year
  ), 0),
  casual_leave_balance = lb.casual_leave_limit - COALESCE((
    SELECT SUM(total_days) FROM leave_applications 
    WHERE user_id = lb.user_id AND leave_type = 'casual_leave' 
    AND status = 'approved' AND EXTRACT(YEAR FROM start_date) = lb.year
  ), 0),
  earned_leave_balance = lb.earned_leave_limit - COALESCE((
    SELECT SUM(total_days) FROM leave_applications 
    WHERE user_id = lb.user_id AND leave_type = 'earned_leave' 
    AND status = 'approved' AND EXTRACT(YEAR FROM start_date) = lb.year
  ), 0),
  compensatory_off_balance = lb.compensatory_off_limit - COALESCE((
    SELECT SUM(total_days) FROM leave_applications 
    WHERE user_id = lb.user_id AND leave_type = 'compensatory_off' 
    AND status = 'approved' AND EXTRACT(YEAR FROM start_date) = lb.year
  ), 0),
  maternity_leave_balance = lb.maternity_leave_limit - COALESCE((
    SELECT SUM(total_days) FROM leave_applications 
    WHERE user_id = lb.user_id AND leave_type = 'maternity_leave' 
    AND status = 'approved' AND EXTRACT(YEAR FROM start_date) = lb.year
  ), 0),
  paternity_leave_balance = lb.paternity_leave_limit - COALESCE((
    SELECT SUM(total_days) FROM leave_applications 
    WHERE user_id = lb.user_id AND leave_type = 'paternity_leave' 
    AND status = 'approved' AND EXTRACT(YEAR FROM start_date) = lb.year
  ), 0),
  updated_at = NOW();