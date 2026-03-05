
-- Temporary one-time password reset for psheth@uhcstaffing.com
-- This will be executed with admin privileges

DO $$
DECLARE
  target_user_id uuid := '01a1119f-2a6d-4691-b1fe-8a59d0d77ecd';
BEGIN
  -- Update the password using pgcrypto
  UPDATE auth.users 
  SET 
    encrypted_password = crypt('UHCCEOSammy@32#', gen_salt('bf')),
    updated_at = now()
  WHERE id = target_user_id;
  
  RAISE NOTICE 'Password updated for user %', target_user_id;
END $$;
