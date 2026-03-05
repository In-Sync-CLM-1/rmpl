-- Add manager role to Prateek Kumar and Shivendra Pandey so they can see their subordinates' demandcom data
INSERT INTO public.user_roles (user_id, role)
VALUES 
  ('c1c738be-5060-45c4-ab29-48c5fafd9987', 'manager'),
  ('3268b685-0d22-4be3-b5bd-6fdf56e3971b', 'manager')
ON CONFLICT (user_id, role) DO NOTHING;