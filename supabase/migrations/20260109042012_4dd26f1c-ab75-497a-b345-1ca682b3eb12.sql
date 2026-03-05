-- First, deactivate all existing dispositions
UPDATE public.call_dispositions SET is_active = false;

-- Insert new Connected dispositions (1-4)
INSERT INTO public.call_dispositions (disposition, subdispositions, is_active)
VALUES 
  ('Connected 1', ARRAY[]::text[], true),
  ('Connected 2', ARRAY[]::text[], true),
  ('Connected 3', ARRAY[]::text[], true),
  ('Connected 4', ARRAY[]::text[], true),
  ('NR 1', ARRAY[]::text[], true),
  ('NR 2', ARRAY[]::text[], true),
  ('NR 3', ARRAY[]::text[], true),
  ('NR 4', ARRAY[]::text[], true)
ON CONFLICT (disposition) DO UPDATE SET is_active = true;