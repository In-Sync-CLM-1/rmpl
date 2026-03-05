-- Remove existing role for a@in-sync.co.in
DELETE FROM public.user_roles 
WHERE user_id = '70f7619f-1984-4583-9f2f-53cfec733eb5';

-- Assign platform_admin role to a@in-sync.co.in
INSERT INTO public.user_roles (user_id, role)
VALUES ('70f7619f-1984-4583-9f2f-53cfec733eb5', 'platform_admin');