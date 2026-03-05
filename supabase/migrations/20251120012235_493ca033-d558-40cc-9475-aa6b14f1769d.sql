-- Extend inventory_items table with allocation fields
ALTER TABLE inventory_items
ADD COLUMN IF NOT EXISTS serial_number TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS imei TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Available' CHECK (status IN ('Available', 'Allocated', 'Damaged', 'Retired')),
ADD COLUMN IF NOT EXISTS current_condition TEXT DEFAULT 'New' CHECK (current_condition IN ('New', 'Good', 'Used', 'Needs Repair', 'Damaged'));

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory_items(status);
CREATE INDEX IF NOT EXISTS idx_inventory_serial ON inventory_items(serial_number);

-- Create inventory_allocations table
CREATE TABLE IF NOT EXISTS inventory_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  
  allocation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  allocated_condition TEXT NOT NULL CHECK (allocated_condition IN ('New', 'Good', 'Used')),
  expected_return_date DATE,
  allocation_notes TEXT,
  allocated_by UUID REFERENCES profiles(id),
  
  deallocation_date TIMESTAMPTZ,
  returned_condition TEXT CHECK (returned_condition IN ('Good', 'Needs Repair', 'Damaged')),
  return_notes TEXT,
  deallocated_by UUID REFERENCES profiles(id),
  
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'returned')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_allocations_item ON inventory_allocations(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_allocations_user ON inventory_allocations(user_id);
CREATE INDEX IF NOT EXISTS idx_allocations_status ON inventory_allocations(status);
CREATE INDEX IF NOT EXISTS idx_allocations_return_date ON inventory_allocations(expected_return_date);

ALTER TABLE inventory_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own allocations"
  ON inventory_allocations FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'platform_admin'::app_role));

CREATE POLICY "Admins and managers can manage allocations"
  ON inventory_allocations FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'platform_admin'::app_role));

-- Create inventory_audit_log table
CREATE TABLE IF NOT EXISTS inventory_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  allocation_id UUID REFERENCES inventory_allocations(id),
  
  action TEXT NOT NULL CHECK (action IN ('allocated', 'deallocated', 'status_changed', 'condition_changed', 'repaired')),
  
  old_status TEXT,
  new_status TEXT,
  old_condition TEXT,
  new_condition TEXT,
  
  user_id UUID REFERENCES profiles(id),
  notes TEXT,
  
  changed_by UUID REFERENCES profiles(id),
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_item ON inventory_audit_log(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON inventory_audit_log(timestamp DESC);

ALTER TABLE inventory_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view audit logs"
  ON inventory_audit_log FOR SELECT
  USING (true);

-- Function to log inventory changes
CREATE OR REPLACE FUNCTION log_inventory_audit()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO inventory_audit_log (
        inventory_item_id, action, old_status, new_status, changed_by
      ) VALUES (
        NEW.id, 'status_changed', OLD.status, NEW.status, auth.uid()
      );
    END IF;
    
    IF OLD.current_condition IS DISTINCT FROM NEW.current_condition THEN
      INSERT INTO inventory_audit_log (
        inventory_item_id, action, old_condition, new_condition, changed_by
      ) VALUES (
        NEW.id, 'condition_changed', OLD.current_condition, NEW.current_condition, auth.uid()
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS inventory_audit_trigger ON inventory_items;
CREATE TRIGGER inventory_audit_trigger
  AFTER UPDATE ON inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION log_inventory_audit();

-- Function to log allocation events
CREATE OR REPLACE FUNCTION log_allocation_audit()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO inventory_audit_log (
      inventory_item_id, allocation_id, action, user_id, notes, changed_by
    ) VALUES (
      NEW.inventory_item_id, NEW.id, 'allocated', NEW.user_id, NEW.allocation_notes, NEW.allocated_by
    );
    
    UPDATE inventory_items
    SET status = 'Allocated'
    WHERE id = NEW.inventory_item_id;
    
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'returned' AND OLD.status = 'active' THEN
    INSERT INTO inventory_audit_log (
      inventory_item_id, allocation_id, action, user_id, notes, changed_by
    ) VALUES (
      NEW.inventory_item_id, NEW.id, 'deallocated', NEW.user_id, NEW.return_notes, NEW.deallocated_by
    );
    
    UPDATE inventory_items
    SET 
      status = CASE 
        WHEN NEW.returned_condition = 'Good' THEN 'Available'
        WHEN NEW.returned_condition = 'Needs Repair' THEN 'Damaged'
        WHEN NEW.returned_condition = 'Damaged' THEN 'Retired'
      END,
      current_condition = NEW.returned_condition
    WHERE id = NEW.inventory_item_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS allocation_audit_trigger ON inventory_allocations;
CREATE TRIGGER allocation_audit_trigger
  AFTER INSERT OR UPDATE ON inventory_allocations
  FOR EACH ROW
  EXECUTE FUNCTION log_allocation_audit();

-- Create view for summary statistics
CREATE OR REPLACE VIEW inventory_summary_stats AS
SELECT
  COUNT(*) as total_inventory,
  COUNT(*) FILTER (WHERE status = 'Available') as available_count,
  COUNT(*) FILTER (WHERE status = 'Allocated') as allocated_count,
  COUNT(*) FILTER (WHERE status = 'Damaged') as damaged_count,
  COUNT(*) FILTER (WHERE status = 'Retired') as retired_count
FROM inventory_items;