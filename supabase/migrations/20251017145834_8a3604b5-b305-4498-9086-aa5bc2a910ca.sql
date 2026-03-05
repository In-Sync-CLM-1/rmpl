-- Create call_logs table
CREATE TABLE public.call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sid text UNIQUE NOT NULL,
  demandcom_id uuid REFERENCES public.demandcom(id) ON DELETE CASCADE,
  initiated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  from_number text NOT NULL,
  to_number text NOT NULL,
  status text NOT NULL DEFAULT 'initiated',
  direction text DEFAULT 'outbound-api',
  conversation_duration integer DEFAULT 0,
  recording_url text,
  start_time timestamptz,
  end_time timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  exotel_response jsonb DEFAULT '{}'::jsonb,
  
  CONSTRAINT call_logs_status_check CHECK (status IN (
    'initiated', 'ringing', 'in-progress', 'completed', 
    'no-answer', 'busy', 'failed', 'canceled'
  ))
);

-- Enable RLS
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view call logs for accessible demandcom"
  ON public.call_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.demandcom 
      WHERE demandcom.id = call_logs.demandcom_id
    )
  );

CREATE POLICY "Authenticated users can insert call logs"
  ON public.call_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = initiated_by);

CREATE POLICY "System can update call logs"
  ON public.call_logs
  FOR UPDATE
  TO authenticated
  USING (true);

-- Indexes for performance
CREATE INDEX idx_call_logs_demandcom_id ON public.call_logs(demandcom_id);
CREATE INDEX idx_call_logs_initiated_by ON public.call_logs(initiated_by);
CREATE INDEX idx_call_logs_created_at ON public.call_logs(created_at DESC);
CREATE INDEX idx_call_logs_status ON public.call_logs(status);
CREATE INDEX idx_call_logs_call_sid ON public.call_logs(call_sid);

-- Updated_at trigger
CREATE TRIGGER update_call_logs_updated_at 
  BEFORE UPDATE ON public.call_logs 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();