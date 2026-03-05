-- Create custom_fields table
CREATE TABLE IF NOT EXISTS public.custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_label TEXT NOT NULL,
  field_name TEXT NOT NULL,
  field_type TEXT NOT NULL,
  applies_to_table TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  options JSONB DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(field_name, applies_to_table)
);

-- Enable RLS
ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view custom fields"
  ON public.custom_fields FOR SELECT
  USING (true);

CREATE POLICY "Users can create custom fields"
  ON public.custom_fields FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update custom fields"
  ON public.custom_fields FOR UPDATE
  USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'platform_admin'::app_role));

CREATE POLICY "Admins can delete custom fields"
  ON public.custom_fields FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'platform_admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_custom_fields_updated_at
  BEFORE UPDATE ON public.custom_fields
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();