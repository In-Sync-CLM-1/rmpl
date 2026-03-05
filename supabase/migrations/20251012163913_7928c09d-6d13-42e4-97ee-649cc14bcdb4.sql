-- Delete the super admin user so they can sign up fresh
DO $$
DECLARE
  user_to_delete_id uuid := '82d45bf3-18f0-496b-9f3a-baf33a1d1f55';
BEGIN
  -- Delete from user_roles first
  DELETE FROM public.user_roles WHERE user_id = user_to_delete_id;
  
  -- Delete from profiles
  DELETE FROM public.profiles WHERE id = user_to_delete_id;
  
  -- Delete from auth.identities (if exists)
  DELETE FROM auth.identities WHERE user_id = user_to_delete_id;
  
  -- Finally delete from auth.users (this cascades to other auth tables)
  DELETE FROM auth.users WHERE id = user_to_delete_id;
  
  RAISE NOTICE 'Deleted user psheth@uhcstaffing.com successfully';
END $$;