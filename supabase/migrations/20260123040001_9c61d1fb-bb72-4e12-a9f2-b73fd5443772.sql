-- Create storage bucket for HR policy documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('hr-policy-documents', 'hr-policy-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for HR documents
CREATE POLICY "All authenticated users can view HR documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'hr-policy-documents' AND auth.role() = 'authenticated');

CREATE POLICY "HR admins can upload HR documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'hr-policy-documents' 
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('platform_admin', 'super_admin', 'admin_tech', 'admin_administration')
  )
);

CREATE POLICY "HR admins can delete HR documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'hr-policy-documents' 
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('platform_admin', 'super_admin', 'admin_tech', 'admin_administration')
  )
);