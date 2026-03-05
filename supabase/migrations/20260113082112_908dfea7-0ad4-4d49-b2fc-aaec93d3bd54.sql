-- Create employee documents table to store references to uploaded files
CREATE TABLE public.employee_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL,
    document_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    verified_at TIMESTAMP WITH TIME ZONE,
    verified_by UUID REFERENCES auth.users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_employee_documents_user_id ON public.employee_documents(user_id);
CREATE INDEX idx_employee_documents_type ON public.employee_documents(document_type);

-- Enable RLS
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

-- Users can view their own documents
CREATE POLICY "Users can view own documents"
ON public.employee_documents
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own documents
CREATE POLICY "Users can upload own documents"
ON public.employee_documents
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own documents (only unverified ones)
CREATE POLICY "Users can delete own unverified documents"
ON public.employee_documents
FOR DELETE
USING (auth.uid() = user_id AND verified_at IS NULL);

-- HR (admin_administration) and Admin can view all documents
CREATE POLICY "HR can view all documents"
ON public.employee_documents
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
        AND role IN ('admin', 'admin_administration', 'super_admin')
    )
);

-- HR and Admin can update documents (for verification)
CREATE POLICY "HR can update documents"
ON public.employee_documents
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
        AND role IN ('admin', 'admin_administration', 'super_admin')
    )
);

-- Create storage bucket for employee documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-documents', 'employee-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for employee documents bucket
CREATE POLICY "Users can upload own documents to storage"
ON storage.objects
FOR INSERT
WITH CHECK (
    bucket_id = 'employee-documents' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view own documents in storage"
ON storage.objects
FOR SELECT
USING (
    bucket_id = 'employee-documents' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own documents in storage"
ON storage.objects
FOR DELETE
USING (
    bucket_id = 'employee-documents' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "HR can view all employee documents in storage"
ON storage.objects
FOR SELECT
USING (
    bucket_id = 'employee-documents'
    AND EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
        AND role IN ('admin', 'admin_administration', 'super_admin')
    )
);

-- Update trigger for updated_at
CREATE TRIGGER update_employee_documents_updated_at
BEFORE UPDATE ON public.employee_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();