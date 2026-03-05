-- Create inventory_items table
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no TEXT UNIQUE NOT NULL,
  date_of_purchase DATE NOT NULL,
  vendor_name TEXT NOT NULL,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  invoice_date DATE NOT NULL,
  items TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  item_description TEXT,
  quantity NUMERIC NOT NULL CHECK (quantity >= 1),
  rate NUMERIC(10, 2) NOT NULL CHECK (rate >= 0),
  units TEXT NOT NULL,
  total_price NUMERIC(10, 2) GENERATED ALWAYS AS (quantity * rate) STORED,
  gst_slab NUMERIC(5, 2) NOT NULL DEFAULT 18.00 CHECK (gst_slab IN (0, 5, 12, 18, 28, 40)),
  gst_amount NUMERIC(10, 2) GENERATED ALWAYS AS (quantity * rate * gst_slab / 100) STORED,
  total_cost NUMERIC(10, 2) GENERATED ALWAYS AS (quantity * rate * (1 + gst_slab / 100)) STORED,
  invoice_file_url TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_inventory_invoice_no ON public.inventory_items(invoice_no);
CREATE INDEX idx_inventory_vendor_name ON public.inventory_items(vendor_name);
CREATE INDEX idx_inventory_date_of_purchase ON public.inventory_items(date_of_purchase);
CREATE INDEX idx_inventory_invoice_date ON public.inventory_items(invoice_date);
CREATE INDEX idx_inventory_gst_slab ON public.inventory_items(gst_slab);
CREATE INDEX idx_inventory_created_by ON public.inventory_items(created_by);

-- Add trigger for updated_at
CREATE TRIGGER update_inventory_items_updated_at
  BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view inventory"
  ON public.inventory_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create inventory items"
  ON public.inventory_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update inventory items"
  ON public.inventory_items FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Admins and managers can delete inventory items"
  ON public.inventory_items FOR DELETE
  TO authenticated
  USING (
    has_role(auth.uid(), 'manager'::app_role) OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'platform_admin'::app_role)
  );

-- Create storage bucket for invoice files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'inventory-invoices',
  'inventory-invoices',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
)
ON CONFLICT (id) DO NOTHING;

-- RLS for storage bucket
CREATE POLICY "Authenticated users can upload invoices"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'inventory-invoices' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Authenticated users can view invoices"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'inventory-invoices');

CREATE POLICY "Users can update their own invoices"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'inventory-invoices' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can delete invoices"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'inventory-invoices' AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'super_admin'::app_role) OR
      has_role(auth.uid(), 'platform_admin'::app_role)
    )
  );