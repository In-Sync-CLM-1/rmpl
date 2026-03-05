-- Create project-quotations storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-quotations', 'project-quotations', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
CREATE POLICY "Allow authenticated uploads" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'project-quotations');

-- Allow authenticated users to read files
CREATE POLICY "Allow authenticated reads" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'project-quotations');

-- Allow public read access for parsing
CREATE POLICY "Allow public reads for project-quotations" ON storage.objects
FOR SELECT TO anon
USING (bucket_id = 'project-quotations');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Allow authenticated deletes" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'project-quotations');