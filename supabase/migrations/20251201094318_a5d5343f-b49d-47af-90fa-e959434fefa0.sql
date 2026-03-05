-- Rename returned_count to usage_count in operations_inventory_distribution
ALTER TABLE operations_inventory_distribution 
RENAME COLUMN returned_count TO usage_count;

-- Update the net_quantity calculation to reflect net return
-- (This is a computed field, so we just need to ensure the column naming is clear)