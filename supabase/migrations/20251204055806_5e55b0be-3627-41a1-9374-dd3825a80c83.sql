-- Create table for Exotel configuration
CREATE TABLE public.exotel_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exophone TEXT NOT NULL,
  display_name TEXT,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.exotel_config ENABLE ROW LEVEL SECURITY;

-- Only admins can view/manage exotel config
CREATE POLICY "Admins can view exotel config"
ON public.exotel_config
FOR SELECT
USING (public.is_admin_user(auth.uid()));

CREATE POLICY "Admins can manage exotel config"
ON public.exotel_config
FOR ALL
USING (public.is_admin_user(auth.uid()));

-- Ensure only one default at a time
CREATE OR REPLACE FUNCTION public.ensure_single_default_exophone()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.exotel_config
    SET is_default = false
    WHERE id != NEW.id AND is_default = true;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER ensure_single_default_exophone_trigger
BEFORE INSERT OR UPDATE ON public.exotel_config
FOR EACH ROW
EXECUTE FUNCTION public.ensure_single_default_exophone();

-- Insert default from existing secret (will need to be done manually or via initial data)
-- This is just a placeholder to get started