-- Fix historically incorrect attendance records from past regularizations
-- These records had IST times stored as UTC (e.g., 09:30 IST stored as 09:30 UTC)
-- We subtract 5:30 to convert them to real UTC so IST display shows correctly

UPDATE attendance_records ar
SET 
  sign_in_time = CASE 
    WHEN ar.sign_in_time IS NOT NULL AND reg.requested_sign_in_time IS NOT NULL 
    THEN ar.sign_in_time - INTERVAL '5 hours 30 minutes'
    ELSE ar.sign_in_time
  END,
  sign_out_time = CASE 
    WHEN ar.sign_out_time IS NOT NULL AND reg.requested_sign_out_time IS NOT NULL 
    THEN ar.sign_out_time - INTERVAL '5 hours 30 minutes'
    ELSE ar.sign_out_time
  END,
  updated_at = now()
FROM attendance_regularizations reg
WHERE ar.notes LIKE '%[Regularized%'
  AND reg.user_id = ar.user_id
  AND reg.attendance_date = ar.date
  AND reg.status = 'approved';