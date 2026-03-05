-- Add category column to inventory_items table to distinguish between different inventory types
ALTER TABLE inventory_items 
ADD COLUMN category TEXT DEFAULT 'Operations' CHECK (category IN ('Operations', 'General', 'IT', 'Marketing', 'Sales', 'HR'));

-- Create an index for better query performance
CREATE INDEX idx_inventory_items_category ON inventory_items(category);