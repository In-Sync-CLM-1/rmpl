-- Add payment_status column to inventory_items table
ALTER TABLE inventory_items 
ADD COLUMN payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'partially_paid', 'overdue', 'cancelled'));