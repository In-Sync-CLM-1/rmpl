-- Create sync_status table for sync locking and tracking
CREATE TABLE IF NOT EXISTS public.sync_status (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_type text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  started_by uuid REFERENCES auth.users(id),
  total_items integer DEFAULT 0,
  processed_items integer DEFAULT 0,
  error_message text
);

-- Create sync_logs table for monitoring and alerting
CREATE TABLE IF NOT EXISTS public.sync_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_type text NOT NULL,
  sync_id uuid REFERENCES public.sync_status(id) ON DELETE CASCADE,
  status text NOT NULL,
  items_fetched integer DEFAULT 0,
  items_inserted integer DEFAULT 0,
  items_updated integer DEFAULT 0,
  items_failed integer DEFAULT 0,
  duration_seconds numeric,
  error_details jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sync_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for sync_status
CREATE POLICY "Authenticated users can view sync status"
ON public.sync_status FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can create sync status"
ON public.sync_status FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = started_by);

CREATE POLICY "Users can update their sync status"
ON public.sync_status FOR UPDATE
TO authenticated
USING (auth.uid() = started_by);

-- RLS policies for sync_logs
CREATE POLICY "Authenticated users can view sync logs"
ON public.sync_logs FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "System can manage sync logs"
ON public.sync_logs FOR ALL
TO authenticated
USING (true);

-- Create index for faster queries
CREATE INDEX idx_sync_status_type_status ON public.sync_status(sync_type, status);
CREATE INDEX idx_sync_logs_created_at ON public.sync_logs(created_at DESC);