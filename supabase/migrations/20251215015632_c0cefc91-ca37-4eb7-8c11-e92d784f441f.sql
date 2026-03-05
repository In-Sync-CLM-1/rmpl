-- Reset inventory_type to match the category that was set during entry
-- This respects the entry point selection rather than guessing by item name
UPDATE public.inventory_items 
SET inventory_type = category
WHERE inventory_type IS NOT NULL;