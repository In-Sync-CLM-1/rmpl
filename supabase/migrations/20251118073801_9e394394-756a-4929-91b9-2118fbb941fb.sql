-- Create vendors table
CREATE TABLE IF NOT EXISTS public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_name TEXT NOT NULL,
  vendor_type TEXT NOT NULL CHECK (vendor_type IN ('IT', 'Operations', 'HRAF', 'Others')),
  contact_person TEXT,
  contact_no TEXT,
  email_id TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  pin_code TEXT,
  gst TEXT,
  department TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX idx_vendors_vendor_name ON public.vendors(vendor_name);
CREATE INDEX idx_vendors_vendor_type ON public.vendors(vendor_type);
CREATE INDEX idx_vendors_created_by ON public.vendors(created_by);
CREATE INDEX idx_vendors_department ON public.vendors(department);

-- Add trigger for updated_at
CREATE TRIGGER update_vendors_updated_at
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view vendors"
  ON public.vendors FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create vendors"
  ON public.vendors FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update vendors"
  ON public.vendors FOR UPDATE
  USING (true);

CREATE POLICY "Admins and managers can delete vendors"
  ON public.vendors FOR DELETE
  USING (
    has_role(auth.uid(), 'manager'::app_role) OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'platform_admin'::app_role)
  );