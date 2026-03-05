-- Add image_url column to events table
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Create storage bucket for event images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('event-images', 'event-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for authenticated users
CREATE POLICY "Authenticated users can upload event images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'event-images');

CREATE POLICY "Anyone can view event images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'event-images');

CREATE POLICY "Users can delete their own event images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'event-images');