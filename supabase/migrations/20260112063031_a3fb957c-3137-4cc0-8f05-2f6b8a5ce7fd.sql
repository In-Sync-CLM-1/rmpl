-- Add database_update_target column to demandcom_daily_targets
ALTER TABLE public.demandcom_daily_targets 
ADD COLUMN database_update_target integer DEFAULT 0;

-- Update Nazim Khan to report to Vibhor (making them a TL)
UPDATE public.profiles 
SET reports_to = 'e0261662-aff9-4e08-8ede-0aadad826d4d'
WHERE id = '42c09e78-d63c-4031-b038-35a490ed7732';

-- Update Kanchan Yadav to report to Vibhor (making them a TL)
UPDATE public.profiles 
SET reports_to = 'e0261662-aff9-4e08-8ede-0aadad826d4d'
WHERE id = '75efa6c9-ce9c-4efe-912e-a79cd873d34f';

-- Update Mukesh Sharma to report to Vibhor (making them a TL)
UPDATE public.profiles 
SET reports_to = 'e0261662-aff9-4e08-8ede-0aadad826d4d'
WHERE id = 'fa3ea3ec-f80e-49cc-9cd7-ef5e78d7581b';