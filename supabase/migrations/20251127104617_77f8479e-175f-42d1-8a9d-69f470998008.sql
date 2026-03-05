-- Create operations_inventory_distribution table
CREATE TABLE public.operations_inventory_distribution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  client_name TEXT,
  inventory_item_id UUID REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  distribution_type TEXT NOT NULL CHECK (distribution_type IN ('gift', 'event_item', 'others')),
  quantity_dispatched INTEGER NOT NULL DEFAULT 1 CHECK (quantity_dispatched > 0),
  despatch_date DATE NOT NULL,
  despatched_to TEXT NOT NULL,
  location TEXT,
  dispatch_mode TEXT NOT NULL CHECK (dispatch_mode IN ('by_hand', 'courier')),
  awb_number TEXT,
  returned_count INTEGER DEFAULT 0 CHECK (returned_count >= 0),
  damaged_lost_count INTEGER DEFAULT 0 CHECK (damaged_lost_count >= 0),
  net_quantity INTEGER GENERATED ALWAYS AS (quantity_dispatched - returned_count - damaged_lost_count) STORED,
  return_location TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add index for better query performance
CREATE INDEX idx_ops_distribution_project ON public.operations_inventory_distribution(project_id);
CREATE INDEX idx_ops_distribution_item ON public.operations_inventory_distribution(inventory_item_id);
CREATE INDEX idx_ops_distribution_date ON public.operations_inventory_distribution(despatch_date);

-- Enable RLS
ALTER TABLE public.operations_inventory_distribution ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view distributions"
  ON public.operations_inventory_distribution
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create distributions"
  ON public.operations_inventory_distribution
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update distributions"
  ON public.operations_inventory_distribution
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and managers can delete distributions"
  ON public.operations_inventory_distribution
  FOR DELETE
  USING (
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'platform_admin'::app_role)
  );

-- Update trigger
CREATE TRIGGER update_ops_distribution_updated_at
  BEFORE UPDATE ON public.operations_inventory_distribution
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();