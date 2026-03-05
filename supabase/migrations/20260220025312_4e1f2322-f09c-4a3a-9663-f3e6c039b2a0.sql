
-- Create vapi_call_logs table
CREATE TABLE public.vapi_call_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  demandcom_id UUID REFERENCES public.demandcom(id) ON DELETE SET NULL,
  vapi_call_id TEXT,
  assistant_id TEXT,
  phone_number TEXT,
  contact_name TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  duration_seconds INTEGER,
  transcript TEXT,
  call_summary TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  error_message TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vapi_call_logs ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users can read all logs, insert their own
CREATE POLICY "Authenticated users can view all call logs"
  ON public.vapi_call_logs FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert call logs"
  ON public.vapi_call_logs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update call logs"
  ON public.vapi_call_logs FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Index for faster lookups
CREATE INDEX idx_vapi_call_logs_demandcom ON public.vapi_call_logs(demandcom_id);
CREATE INDEX idx_vapi_call_logs_status ON public.vapi_call_logs(status);
CREATE INDEX idx_vapi_call_logs_created_at ON public.vapi_call_logs(created_at DESC);
