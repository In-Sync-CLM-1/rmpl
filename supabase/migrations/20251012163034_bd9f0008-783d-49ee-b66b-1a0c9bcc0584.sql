-- Create super admin user Pinkal Sheth
DO $$
DECLARE
  new_user_id uuid;
BEGIN
  -- Insert auth user (this will trigger profile creation via handle_new_user)
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'psheth@uhcstaffing.com',
    crypt('TempPassword123!', gen_salt('bf')), -- Temporary password, user should reset
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Pinkal Sheth"}',
    now(),
    now(),
    '',
    ''
  )
  RETURNING id INTO new_user_id;

  -- Update profile with additional info
  UPDATE public.profiles
  SET 
    phone = '+1 (408) 813-1984',
    reports_to = '70f7619f-1984-4583-9f2f-53cfec733eb5'
  WHERE id = new_user_id;

  -- Assign super_admin role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new_user_id, 'super_admin');

  RAISE NOTICE 'Super admin user created with ID: %', new_user_id;
END $$;