
-- Create vapi_scheduled_calls table
CREATE TABLE public.vapi_scheduled_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  demandcom_ids UUID[] NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  first_message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  total_contacts INTEGER NOT NULL DEFAULT 0,
  completed_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  activity_name TEXT
);

-- Enable RLS
ALTER TABLE public.vapi_scheduled_calls ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view scheduled calls"
  ON public.vapi_scheduled_calls FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert scheduled calls"
  ON public.vapi_scheduled_calls FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update scheduled calls"
  ON public.vapi_scheduled_calls FOR UPDATE
  TO authenticated
  USING (true);

-- Index for cron polling
CREATE INDEX idx_vapi_scheduled_calls_status_time 
  ON public.vapi_scheduled_calls (status, scheduled_at);

-- Add new columns to vapi_call_logs
ALTER TABLE public.vapi_call_logs 
  ADD COLUMN IF NOT EXISTS sentiment TEXT,
  ADD COLUMN IF NOT EXISTS sentiment_score NUMERIC,
  ADD COLUMN IF NOT EXISTS response_summary TEXT,
  ADD COLUMN IF NOT EXISTS key_topics TEXT[],
  ADD COLUMN IF NOT EXISTS scheduled_call_id UUID REFERENCES public.vapi_scheduled_calls(id);

-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
