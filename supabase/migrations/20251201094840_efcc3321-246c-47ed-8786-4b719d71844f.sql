-- Add images column to operations_inventory_distribution table
ALTER TABLE operations_inventory_distribution
ADD COLUMN images text[] DEFAULT '{}';

-- Create storage bucket for operations distribution images
INSERT INTO storage.buckets (id, name, public)
VALUES ('operations-distribution-images', 'operations-distribution-images', true);

-- RLS policies for operations-distribution-images bucket
CREATE POLICY "Anyone can view distribution images"
ON storage.objects FOR SELECT
USING (bucket_id = 'operations-distribution-images');

CREATE POLICY "Authenticated users can upload distribution images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'operations-distribution-images' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can delete distribution images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'operations-distribution-images' 
  AND auth.role() = 'authenticated'
);