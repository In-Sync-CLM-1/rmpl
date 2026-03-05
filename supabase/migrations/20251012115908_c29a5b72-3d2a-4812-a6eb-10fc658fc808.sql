-- Create storage bucket for bulk imports
INSERT INTO storage.buckets (id, name, public)
VALUES ('bulk-imports', 'bulk-imports', false);

-- Storage policies for bulk imports bucket
CREATE POLICY "Authenticated users can upload bulk imports"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'bulk-imports' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own bulk import files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'bulk-imports' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own bulk import files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'bulk-imports' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Create import jobs tracking table
CREATE TABLE public.import_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  total_rows INTEGER DEFAULT 0,
  processed_rows INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_details JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

-- RLS policies for import_jobs
CREATE POLICY "Users can view their own import jobs"
ON public.import_jobs
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own import jobs"
ON public.import_jobs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own import jobs"
ON public.import_jobs
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all import jobs"
ON public.import_jobs
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Add trigger for updated_at
CREATE TRIGGER update_import_jobs_updated_at
BEFORE UPDATE ON public.import_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for import_jobs
ALTER PUBLICATION supabase_realtime ADD TABLE public.import_jobs;