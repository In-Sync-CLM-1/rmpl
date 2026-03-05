-- Create export jobs table for queuing
CREATE TABLE IF NOT EXISTS public.export_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  source TEXT NOT NULL,
  filters JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  total_records INTEGER,
  processed_records INTEGER DEFAULT 0,
  file_url TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.export_jobs ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own export jobs
CREATE POLICY "Users can view own export jobs"
  ON public.export_jobs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow users to create export jobs
CREATE POLICY "Users can create export jobs"
  ON public.export_jobs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create index for better query performance
CREATE INDEX idx_export_jobs_user_status ON public.export_jobs(user_id, status);
CREATE INDEX idx_export_jobs_created_at ON public.export_jobs(created_at DESC);

-- Add trigger to update updated_at
CREATE TRIGGER update_export_jobs_updated_at
  BEFORE UPDATE ON public.export_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();