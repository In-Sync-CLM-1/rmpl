-- Add inventory_type column to distinguish IT from Operations inventory
ALTER TABLE public.inventory_items 
ADD COLUMN inventory_type TEXT DEFAULT 'Operations';

-- Create an index for better query performance
CREATE INDEX idx_inventory_items_inventory_type ON public.inventory_items(inventory_type);

-- Update existing IT-related items to have inventory_type = 'IT'
UPDATE public.inventory_items 
SET inventory_type = 'IT'
WHERE LOWER(items) LIKE '%laptop%'
   OR LOWER(items) LIKE '%power bank%'
   OR LOWER(items) LIKE '%hard drive%'
   OR LOWER(items) LIKE '%monitor%'
   OR LOWER(items) LIKE '%keyboard%'
   OR LOWER(items) LIKE '%mouse%'
   OR LOWER(items) LIKE '%headphone%'
   OR LOWER(items) LIKE '%headset%'
   OR LOWER(items) LIKE '%charger%'
   OR LOWER(items) LIKE '%cable%'
   OR LOWER(items) LIKE '%adapter%'
   OR LOWER(items) LIKE '%usb%'
   OR LOWER(items) LIKE '%pen drive%'
   OR LOWER(items) LIKE '%ssd%'
   OR LOWER(items) LIKE '%ram%'
   OR LOWER(items) LIKE '%cpu%'
   OR LOWER(items) LIKE '%processor%'
   OR LOWER(items) LIKE '%webcam%'
   OR LOWER(items) LIKE '%printer%'
   OR LOWER(items) LIKE '%scanner%'
   OR LOWER(items) LIKE '%router%'
   OR LOWER(items) LIKE '%switch%'
   OR LOWER(items) LIKE '%server%'
   OR LOWER(items) LIKE '%ups%'
   OR LOWER(items) LIKE '%desktop%'
   OR LOWER(items) LIKE '%tablet%'
   OR LOWER(items) LIKE '%mobile%'
   OR LOWER(items) LIKE '%phone%';