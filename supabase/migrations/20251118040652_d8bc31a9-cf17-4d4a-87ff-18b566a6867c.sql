-- Add photo and location enhancement columns to attendance_records
ALTER TABLE attendance_records 
ADD COLUMN IF NOT EXISTS sign_in_photo_url TEXT,
ADD COLUMN IF NOT EXISTS sign_out_photo_url TEXT,
ADD COLUMN IF NOT EXISTS sign_in_location_accuracy NUMERIC,
ADD COLUMN IF NOT EXISTS sign_out_location_accuracy NUMERIC,
ADD COLUMN IF NOT EXISTS sign_in_location_city TEXT,
ADD COLUMN IF NOT EXISTS sign_in_location_state TEXT,
ADD COLUMN IF NOT EXISTS sign_out_location_city TEXT,
ADD COLUMN IF NOT EXISTS sign_out_location_state TEXT,
ADD COLUMN IF NOT EXISTS network_status TEXT,
ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'synced';

-- Create storage bucket for attendance photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('attendance-photos', 'attendance-photos', false)
ON CONFLICT (id) DO NOTHING;

-- RLS Policy: Users can upload their own attendance photos
CREATE POLICY "Users can upload own attendance photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'attendance-photos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS Policy: Users can view their own attendance photos
CREATE POLICY "Users can view own attendance photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'attendance-photos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS Policy: Admins can view all attendance photos
CREATE POLICY "Admins can view all attendance photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'attendance-photos' 
  AND (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'super_admin'::app_role) OR
    public.has_role(auth.uid(), 'platform_admin'::app_role) OR
    public.has_role(auth.uid(), 'admin_administration'::app_role)
  )
);