-- Create export_batches table for queue-based batch processing
CREATE TABLE public.export_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  export_job_id UUID NOT NULL REFERENCES export_jobs(id) ON DELETE CASCADE,
  batch_number INTEGER NOT NULL,
  offset_start INTEGER NOT NULL,
  batch_size INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  records_processed INTEGER DEFAULT 0,
  csv_content TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(export_job_id, batch_number)
);

-- Add indexes for performance
CREATE INDEX idx_export_batches_job_id ON export_batches(export_job_id);
CREATE INDEX idx_export_batches_status ON export_batches(status);

-- Enable RLS
ALTER TABLE export_batches ENABLE ROW LEVEL SECURITY;

-- RLS policies for export_batches
CREATE POLICY "Users can view their own export batches"
ON export_batches FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM export_jobs
    WHERE export_jobs.id = export_batches.export_job_id
    AND export_jobs.user_id = auth.uid()
  )
);

CREATE POLICY "System can insert export batches"
ON export_batches FOR INSERT
WITH CHECK (true);

CREATE POLICY "System can update export batches"
ON export_batches FOR UPDATE
USING (true);

-- Add current_batch and total_batches columns to export_jobs
ALTER TABLE export_jobs ADD COLUMN IF NOT EXISTS current_batch INTEGER DEFAULT 0;
ALTER TABLE export_jobs ADD COLUMN IF NOT EXISTS total_batches INTEGER DEFAULT 0;

-- Allow system to update export_jobs (needed for batch processing)
DROP POLICY IF EXISTS "System can update export jobs" ON export_jobs;
CREATE POLICY "System can update export jobs"
ON export_jobs FOR UPDATE
USING (true);