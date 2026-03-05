-- Create sync_batches table for batch processing queue
CREATE TABLE IF NOT EXISTS public.sync_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_log_id uuid NOT NULL REFERENCES public.sync_logs(id) ON DELETE CASCADE,
  batch_number integer NOT NULL,
  offset_start integer NOT NULL,
  batch_size integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  records_processed integer DEFAULT 0,
  records_inserted integer DEFAULT 0,
  records_updated integer DEFAULT 0,
  records_failed integer DEFAULT 0,
  error_details jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Index for efficient batch processing
CREATE INDEX idx_sync_batches_status ON public.sync_batches(sync_log_id, status);
CREATE INDEX idx_sync_batches_batch_number ON public.sync_batches(sync_log_id, batch_number);

-- Enable RLS
ALTER TABLE public.sync_batches ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view sync batches"
  ON public.sync_batches FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can insert sync batches"
  ON public.sync_batches FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update sync batches"
  ON public.sync_batches FOR UPDATE
  USING (true);

-- Add total_batches and current_batch to sync_logs for progress tracking
ALTER TABLE public.sync_logs 
ADD COLUMN IF NOT EXISTS total_batches integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_batch integer DEFAULT 0;

-- Enable realtime for sync_logs to track progress
ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_logs;

-- Create helper function to update sync log progress from batches
CREATE OR REPLACE FUNCTION public.update_sync_log_progress(p_sync_log_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_total_processed integer;
  v_total_inserted integer;
  v_total_updated integer;
  v_total_failed integer;
  v_completed_batches integer;
  v_total_batches integer;
  v_all_completed boolean;
  v_has_failed_batches boolean;
BEGIN
  SELECT 
    COALESCE(SUM(records_processed), 0),
    COALESCE(SUM(records_inserted), 0),
    COALESCE(SUM(records_updated), 0),
    COALESCE(SUM(records_failed), 0),
    COUNT(*) FILTER (WHERE status IN ('completed', 'failed')),
    COUNT(*),
    bool_and(status IN ('completed', 'failed')),
    bool_or(status = 'failed')
  INTO v_total_processed, v_total_inserted, v_total_updated, v_total_failed, 
       v_completed_batches, v_total_batches, v_all_completed, v_has_failed_batches
  FROM sync_batches
  WHERE sync_log_id = p_sync_log_id;
  
  UPDATE sync_logs SET
    items_fetched = v_total_processed,
    items_inserted = v_total_inserted,
    items_updated = v_total_updated,
    items_failed = v_total_failed,
    current_batch = v_completed_batches,
    total_batches = v_total_batches,
    status = CASE 
      WHEN v_all_completed AND NOT v_has_failed_batches AND v_total_failed = 0 THEN 'completed'
      WHEN v_all_completed THEN 'partial'
      ELSE 'running'
    END
  WHERE id = p_sync_log_id;
END;
$$;