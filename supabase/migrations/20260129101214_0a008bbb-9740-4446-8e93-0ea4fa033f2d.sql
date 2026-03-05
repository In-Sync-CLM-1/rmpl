-- Add missing columns for sandwich leave tracking
ALTER TABLE leave_applications 
ADD COLUMN IF NOT EXISTS sandwich_days integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS leave_calculation jsonb;