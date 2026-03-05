-- Create enum for import status
CREATE TYPE import_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');

-- Create bulk_import_history table
CREATE TABLE public.bulk_import_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  table_name TEXT NOT NULL,
  status import_status NOT NULL DEFAULT 'pending',
  total_records INTEGER NOT NULL,
  processed_records INTEGER DEFAULT 0,
  successful_records INTEGER DEFAULT 0,
  failed_records INTEGER DEFAULT 0,
  current_batch INTEGER DEFAULT 0,
  total_batches INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  error_log JSONB DEFAULT '[]'::jsonb,
  can_revert BOOLEAN DEFAULT true,
  reverted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE
);

-- Create bulk_import_records table for tracking imported records
CREATE TABLE public.bulk_import_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID REFERENCES public.bulk_import_history(id) ON DELETE CASCADE NOT NULL,
  record_id UUID NOT NULL,
  table_name TEXT NOT NULL,
  row_number INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_import_history_user ON public.bulk_import_history(user_id, created_at DESC);
CREATE INDEX idx_import_history_status ON public.bulk_import_history(status);
CREATE INDEX idx_import_records_import ON public.bulk_import_records(import_id);
CREATE INDEX idx_import_records_target ON public.bulk_import_records(table_name, record_id);

-- Enable RLS
ALTER TABLE public.bulk_import_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_import_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bulk_import_history
CREATE POLICY "Users can view their own import history"
  ON public.bulk_import_history
  FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'platform_admin'::app_role));

CREATE POLICY "Users can create import history"
  ON public.bulk_import_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own import history"
  ON public.bulk_import_history
  FOR UPDATE
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'platform_admin'::app_role));

-- RLS Policies for bulk_import_records
CREATE POLICY "Users can view their own import records"
  ON public.bulk_import_records
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bulk_import_history
      WHERE id = bulk_import_records.import_id
      AND (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'platform_admin'::app_role))
    )
  );

CREATE POLICY "System can create import records"
  ON public.bulk_import_records
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bulk_import_history
      WHERE id = bulk_import_records.import_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "System can delete import records"
  ON public.bulk_import_records
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.bulk_import_history
      WHERE id = bulk_import_records.import_id
      AND user_id = auth.uid()
    )
  );