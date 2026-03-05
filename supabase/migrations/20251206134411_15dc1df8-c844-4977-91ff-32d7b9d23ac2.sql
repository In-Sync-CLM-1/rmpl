-- Create quotation_payments table for tracking payments against quotations/invoices
CREATE TABLE public.quotation_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid NOT NULL REFERENCES project_quotations(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  payment_date date NOT NULL,
  payment_mode text NOT NULL,
  reference_number text,
  bank_name text,
  notes text,
  recorded_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Create payment_proof_images table for storing payment proof images with AI parsing
CREATE TABLE public.payment_proof_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES quotation_payments(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  parsed_data jsonb,
  parse_status text DEFAULT 'pending',
  parse_error text,
  created_at timestamptz DEFAULT now()
);

-- Add paid_amount column to project_quotations for tracking payment progress
ALTER TABLE public.project_quotations 
ADD COLUMN IF NOT EXISTS paid_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS due_date date;

-- Create storage bucket for payment proofs
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on quotation_payments
ALTER TABLE public.quotation_payments ENABLE ROW LEVEL SECURITY;

-- RLS policies for quotation_payments
CREATE POLICY "Users can view payments for accessible projects"
ON public.quotation_payments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM project_quotations pq
    JOIN projects p ON p.id = pq.project_id
    WHERE pq.id = quotation_payments.quotation_id
    AND can_access_project(auth.uid(), p.id)
  )
);

CREATE POLICY "Users can create payments for accessible projects"
ON public.quotation_payments FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM project_quotations pq
    JOIN projects p ON p.id = pq.project_id
    WHERE pq.id = quotation_payments.quotation_id
    AND can_access_project(auth.uid(), p.id)
  )
);

CREATE POLICY "Managers and admins can update payments"
ON public.quotation_payments FOR UPDATE
USING (
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'platform_admin'::app_role)
);

CREATE POLICY "Managers and admins can delete payments"
ON public.quotation_payments FOR DELETE
USING (
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'platform_admin'::app_role)
);

-- Enable RLS on payment_proof_images
ALTER TABLE public.payment_proof_images ENABLE ROW LEVEL SECURITY;

-- RLS policies for payment_proof_images
CREATE POLICY "Users can view payment proofs for accessible payments"
ON public.payment_proof_images FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM quotation_payments qp
    JOIN project_quotations pq ON pq.id = qp.quotation_id
    JOIN projects p ON p.id = pq.project_id
    WHERE qp.id = payment_proof_images.payment_id
    AND can_access_project(auth.uid(), p.id)
  )
);

CREATE POLICY "Users can create payment proofs"
ON public.payment_proof_images FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update payment proofs"
ON public.payment_proof_images FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- Storage policies for payment-proofs bucket
CREATE POLICY "Authenticated users can upload payment proofs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'payment-proofs' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view payment proofs"
ON storage.objects FOR SELECT
USING (bucket_id = 'payment-proofs' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete payment proofs"
ON storage.objects FOR DELETE
USING (bucket_id = 'payment-proofs' AND auth.uid() IS NOT NULL);

-- Create function to update paid_amount on project_quotations
CREATE OR REPLACE FUNCTION public.update_quotation_paid_amount()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE project_quotations
    SET paid_amount = (
      SELECT COALESCE(SUM(amount), 0)
      FROM quotation_payments
      WHERE quotation_id = NEW.quotation_id
    )
    WHERE id = NEW.quotation_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE project_quotations
    SET paid_amount = (
      SELECT COALESCE(SUM(amount), 0)
      FROM quotation_payments
      WHERE quotation_id = OLD.quotation_id
    )
    WHERE id = OLD.quotation_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to auto-update paid_amount
CREATE TRIGGER update_quotation_paid_amount_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.quotation_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_quotation_paid_amount();

-- Create view for cashflow dashboard summary
CREATE OR REPLACE VIEW public.cashflow_summary AS
SELECT 
  COUNT(*) as total_invoices,
  COALESCE(SUM(amount), 0) as total_invoiced,
  COALESCE(SUM(paid_amount), 0) as total_received,
  COALESCE(SUM(amount - COALESCE(paid_amount, 0)), 0) as pending_amount,
  COALESCE(SUM(CASE 
    WHEN due_date < CURRENT_DATE AND (amount - COALESCE(paid_amount, 0)) > 0 
    THEN amount - COALESCE(paid_amount, 0) 
    ELSE 0 
  END), 0) as overdue_amount
FROM project_quotations
WHERE amount IS NOT NULL AND amount > 0;

-- Create view for client-wise pending summary (using text client_id)
CREATE OR REPLACE VIEW public.client_pending_summary AS
SELECT 
  c.id as client_id,
  c.company_name,
  c.contact_name,
  COUNT(pq.id) as invoice_count,
  COALESCE(SUM(pq.amount - COALESCE(pq.paid_amount, 0)), 0) as pending_amount,
  MIN(pq.created_at) as oldest_invoice_date
FROM clients c
JOIN projects p ON p.client_id = c.id::text
JOIN project_quotations pq ON pq.project_id = p.id
WHERE pq.amount IS NOT NULL AND pq.amount > 0
AND (pq.amount - COALESCE(pq.paid_amount, 0)) > 0
GROUP BY c.id, c.company_name, c.contact_name;