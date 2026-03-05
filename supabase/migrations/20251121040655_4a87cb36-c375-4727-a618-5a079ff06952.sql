-- Drop the old constraint that includes 'closed_lost'
ALTER TABLE public.projects
DROP CONSTRAINT IF EXISTS valid_status;

-- Add new constraint with 'closed' and 'lost' as separate values
ALTER TABLE public.projects
ADD CONSTRAINT valid_status
CHECK (
  status IN (
    'pitched',
    'in_discussion',
    'estimate_shared',
    'po_received',
    'execution',
    'invoiced',
    'closed',
    'lost'
  )
);