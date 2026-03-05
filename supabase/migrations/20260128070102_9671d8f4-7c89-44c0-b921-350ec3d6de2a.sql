-- Step 1: Insert leave_balances for 2026 for all active users who don't have one
INSERT INTO leave_balances (
  user_id,
  year,
  sick_leave_balance,
  sick_leave_limit,
  casual_leave_balance,
  casual_leave_limit,
  earned_leave_balance,
  earned_leave_limit,
  compensatory_off_balance,
  compensatory_off_limit,
  maternity_leave_balance,
  maternity_leave_limit,
  paternity_leave_balance,
  paternity_leave_limit,
  optional_holidays_claimed
)
SELECT 
  p.id as user_id,
  2026 as year,
  12 as sick_leave_balance,
  12 as sick_leave_limit,
  12 as casual_leave_balance,
  12 as casual_leave_limit,
  15 as earned_leave_balance,
  15 as earned_leave_limit,
  0 as compensatory_off_balance,
  0 as compensatory_off_limit,
  0 as maternity_leave_balance,
  0 as maternity_leave_limit,
  0 as paternity_leave_balance,
  0 as paternity_leave_limit,
  0 as optional_holidays_claimed
FROM profiles p
WHERE p.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM leave_balances lb 
    WHERE lb.user_id = p.id AND lb.year = 2026
  );

-- Step 2: Deduct approved sick_leave from balances
UPDATE leave_balances lb
SET sick_leave_balance = sick_leave_balance - COALESCE(approved.total_days, 0)
FROM (
  SELECT user_id, SUM(total_days) as total_days
  FROM leave_applications
  WHERE status = 'approved'
    AND leave_type = 'sick_leave'
    AND EXTRACT(YEAR FROM start_date) = 2026
  GROUP BY user_id
) approved
WHERE lb.user_id = approved.user_id AND lb.year = 2026;

-- Step 3: Deduct approved casual_leave from balances
UPDATE leave_balances lb
SET casual_leave_balance = casual_leave_balance - COALESCE(approved.total_days, 0)
FROM (
  SELECT user_id, SUM(total_days) as total_days
  FROM leave_applications
  WHERE status = 'approved'
    AND leave_type = 'casual_leave'
    AND EXTRACT(YEAR FROM start_date) = 2026
  GROUP BY user_id
) approved
WHERE lb.user_id = approved.user_id AND lb.year = 2026;

-- Step 4: Deduct approved earned_leave from balances
UPDATE leave_balances lb
SET earned_leave_balance = earned_leave_balance - COALESCE(approved.total_days, 0)
FROM (
  SELECT user_id, SUM(total_days) as total_days
  FROM leave_applications
  WHERE status = 'approved'
    AND leave_type = 'earned_leave'
    AND EXTRACT(YEAR FROM start_date) = 2026
  GROUP BY user_id
) approved
WHERE lb.user_id = approved.user_id AND lb.year = 2026;