-- Create webhook_connectors table for storing webhook configurations
CREATE TABLE IF NOT EXISTS public.webhook_connectors (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  connector_type text NOT NULL, -- 'general', 'excelhire', 'custom'
  webhook_token text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  rate_limit_per_minute integer NOT NULL DEFAULT 60,
  webhook_config jsonb DEFAULT '{}'::jsonb, -- Stores field mappings and other config
  target_table text NOT NULL DEFAULT 'candidates', -- 'candidates' or 'jobs'
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create webhook_logs table for tracking webhook requests
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  webhook_connector_id uuid REFERENCES public.webhook_connectors(id) ON DELETE CASCADE,
  request_id text NOT NULL UNIQUE,
  status text NOT NULL, -- 'success', 'duplicate', 'error'
  http_status_code integer NOT NULL,
  request_payload jsonb,
  response_payload jsonb,
  error_message text,
  candidate_id uuid REFERENCES public.candidates(id),
  job_id uuid REFERENCES public.jobs(id),
  ip_address text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.webhook_connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for webhook_connectors
CREATE POLICY "Authenticated users can view webhook connectors"
ON public.webhook_connectors FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can create webhook connectors"
ON public.webhook_connectors FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their webhook connectors"
ON public.webhook_connectors FOR UPDATE
TO authenticated
USING (auth.uid() = created_by);

CREATE POLICY "Admins can delete webhook connectors"
ON public.webhook_connectors FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- RLS policies for webhook_logs
CREATE POLICY "Authenticated users can view webhook logs"
ON public.webhook_logs FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "System can manage webhook logs"
ON public.webhook_logs FOR ALL
TO authenticated
USING (true);

-- Create function to check webhook rate limits
CREATE OR REPLACE FUNCTION public.check_webhook_rate_limit(
  _webhook_id uuid,
  _limit integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_count integer;
BEGIN
  -- Count requests in the last minute for this webhook
  SELECT COUNT(*)
  INTO request_count
  FROM public.webhook_logs
  WHERE webhook_connector_id = _webhook_id
    AND created_at > NOW() - INTERVAL '1 minute';
  
  RETURN request_count < _limit;
END;
$$;

-- Create indexes for better performance
CREATE INDEX idx_webhook_connectors_token ON public.webhook_connectors(webhook_token);
CREATE INDEX idx_webhook_connectors_active ON public.webhook_connectors(is_active);
CREATE INDEX idx_webhook_logs_connector_id ON public.webhook_logs(webhook_connector_id);
CREATE INDEX idx_webhook_logs_created_at ON public.webhook_logs(created_at DESC);
CREATE INDEX idx_webhook_logs_request_id ON public.webhook_logs(request_id);

-- Add trigger for updated_at
CREATE TRIGGER update_webhook_connectors_updated_at
BEFORE UPDATE ON public.webhook_connectors
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();