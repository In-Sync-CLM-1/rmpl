-- Delete user psheth@uhcstaffing.com and all associated data
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Find the user ID from email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'psheth@uhcstaffing.com';

  -- If user exists, delete all associated records
  IF v_user_id IS NOT NULL THEN
    -- Delete from user_roles
    DELETE FROM public.user_roles WHERE user_id = v_user_id;
    
    -- Delete from user_designations
    DELETE FROM public.user_designations WHERE user_id = v_user_id OR assigned_by = v_user_id;
    
    -- Delete from team_members
    DELETE FROM public.team_members WHERE user_id = v_user_id;
    
    -- Delete from teams (where they are team lead or creator)
    DELETE FROM public.teams WHERE team_lead_id = v_user_id OR created_by = v_user_id;
    
    -- Delete from import_jobs
    DELETE FROM public.import_jobs WHERE user_id = v_user_id;
    
    -- Delete from password_reset_logs
    DELETE FROM public.password_reset_logs WHERE admin_user_id = v_user_id OR target_user_id = v_user_id;
    
    -- Delete from webhook_connectors
    DELETE FROM public.webhook_connectors WHERE created_by = v_user_id;
    
    -- Delete from campaigns
    DELETE FROM public.campaigns WHERE created_by = v_user_id;
    
    -- Delete from email_templates
    DELETE FROM public.email_templates WHERE created_by = v_user_id;
    
    -- Delete from sms_templates
    DELETE FROM public.sms_templates WHERE created_by = v_user_id;
    
    -- Delete from job_seekers
    DELETE FROM public.job_seekers WHERE created_by = v_user_id;
    
    -- Delete from clients
    DELETE FROM public.clients WHERE created_by = v_user_id;
    
    -- Delete from jobs
    DELETE FROM public.jobs WHERE created_by = v_user_id;
    
    -- Delete from job_seeker_pipeline
    DELETE FROM public.job_seeker_pipeline WHERE moved_by = v_user_id;
    
    -- Delete from job_seeker_recommendations
    DELETE FROM public.job_seeker_recommendations WHERE created_by = v_user_id;
    
    -- Update profiles to remove references
    UPDATE public.profiles SET reports_to = NULL WHERE reports_to = v_user_id;
    
    -- Finally, delete from auth.users (this will cascade to profiles)
    DELETE FROM auth.users WHERE id = v_user_id;
    
    RAISE NOTICE 'User psheth@uhcstaffing.com and all associated data deleted successfully';
  ELSE
    RAISE NOTICE 'User psheth@uhcstaffing.com not found';
  END IF;
END $$;