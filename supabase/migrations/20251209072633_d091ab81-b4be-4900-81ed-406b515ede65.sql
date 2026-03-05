-- Create import_batches table for queue system
CREATE TABLE public.import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID NOT NULL REFERENCES bulk_import_history(id) ON DELETE CASCADE,
  batch_number INTEGER NOT NULL,
  offset_start INTEGER NOT NULL,
  batch_size INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  records_processed INTEGER DEFAULT 0,
  records_inserted INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  error_details JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(import_id, batch_number)
);

-- Add indexes for performance
CREATE INDEX idx_import_batches_import_id ON import_batches(import_id);
CREATE INDEX idx_import_batches_status ON import_batches(status);

-- Enable RLS
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for import_batches
CREATE POLICY "Users can view their own import batches"
  ON import_batches
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bulk_import_history
      WHERE bulk_import_history.id = import_batches.import_id
      AND bulk_import_history.user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert import batches"
  ON import_batches
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update import batches"
  ON import_batches
  FOR UPDATE
  USING (true);

-- Add storage_path column to bulk_import_history for CSV data
ALTER TABLE bulk_import_history ADD COLUMN IF NOT EXISTS storage_path TEXT;