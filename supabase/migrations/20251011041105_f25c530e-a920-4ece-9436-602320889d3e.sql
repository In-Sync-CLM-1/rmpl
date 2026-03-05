-- Create storage bucket for email template images
INSERT INTO storage.buckets (id, name, public)
VALUES ('email-templates', 'email-templates', true);

-- Allow authenticated users to upload their own images
CREATE POLICY "Users can upload email template images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'email-templates' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow everyone to view images (public bucket)
CREATE POLICY "Anyone can view email template images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'email-templates');

-- Allow users to update their own images
CREATE POLICY "Users can update their own email template images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'email-templates' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to delete their own images
CREATE POLICY "Users can delete their own email template images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'email-templates' AND auth.uid()::text = (storage.foldername(name))[1]);