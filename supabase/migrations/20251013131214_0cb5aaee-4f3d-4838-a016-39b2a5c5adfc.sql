-- Assign admin_administration role to Pinkal Sheth (psheth@uhcstaffing.com)
-- Remove existing 'user' role
DELETE FROM public.user_roles 
WHERE user_id = '01a1119f-2a6d-4691-b1fe-8a59d0d77ecd';

-- Assign 'admin_administration' role
INSERT INTO public.user_roles (user_id, role)
VALUES ('01a1119f-2a6d-4691-b1fe-8a59d0d77ecd', 'admin_administration');