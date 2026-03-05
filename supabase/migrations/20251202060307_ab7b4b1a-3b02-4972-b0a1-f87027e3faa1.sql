-- Add line_number for tracking individual units within same invoice
ALTER TABLE inventory_items ADD COLUMN line_number INTEGER DEFAULT NULL;

-- Add parent_item_id to link expanded items back to original (for reference)
ALTER TABLE inventory_items ADD COLUMN parent_item_id UUID REFERENCES inventory_items(id);

-- Drop the existing unique constraint on invoice_no
ALTER TABLE inventory_items DROP CONSTRAINT IF EXISTS inventory_items_invoice_no_key;

-- Create a new composite unique constraint that allows multiple items with same invoice_no but different line_numbers
CREATE UNIQUE INDEX inventory_items_invoice_line_unique ON inventory_items (invoice_no, COALESCE(line_number, 0));