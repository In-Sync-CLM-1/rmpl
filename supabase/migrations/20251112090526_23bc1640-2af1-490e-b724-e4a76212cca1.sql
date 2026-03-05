-- Drop the old constraint
ALTER TABLE projects DROP CONSTRAINT IF EXISTS valid_status;

-- Map old status values to new ones
UPDATE projects SET status = 'pitched' WHERE status = 'new';
UPDATE projects SET status = 'execution' WHERE status = 'active';
UPDATE projects SET status = 'invoiced' WHERE status = 'completed';
UPDATE projects SET status = 'closed_lost' WHERE status = 'cancelled';

-- Add the updated constraint with the correct status values
ALTER TABLE projects ADD CONSTRAINT valid_status 
  CHECK (status IN ('pitched', 'in_discussion', 'estimate_shared', 'po_received', 'execution', 'invoiced', 'closed_lost'));