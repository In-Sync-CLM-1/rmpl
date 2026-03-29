-- Add indexes to tables that only had a primary key

-- attendance_regularizations
CREATE INDEX IF NOT EXISTS idx_attendance_reg_user_id ON attendance_regularizations (user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_reg_status ON attendance_regularizations (status);
CREATE INDEX IF NOT EXISTS idx_attendance_reg_date ON attendance_regularizations (attendance_date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_reg_approved_by ON attendance_regularizations (approved_by);

-- email_activity_log
CREATE INDEX IF NOT EXISTS idx_email_activity_sent_by ON email_activity_log (sent_by);
CREATE INDEX IF NOT EXISTS idx_email_activity_demandcom_id ON email_activity_log (demandcom_id);
CREATE INDEX IF NOT EXISTS idx_email_activity_sent_at ON email_activity_log (sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_activity_status ON email_activity_log (status);
CREATE INDEX IF NOT EXISTS idx_email_activity_to_email ON email_activity_log (to_email);

-- onboarding_submissions
CREATE INDEX IF NOT EXISTS idx_onboarding_sub_form_id ON onboarding_submissions (form_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_sub_status ON onboarding_submissions (status);
CREATE INDEX IF NOT EXISTS idx_onboarding_sub_reviewed_by ON onboarding_submissions (reviewed_by);
CREATE INDEX IF NOT EXISTS idx_onboarding_sub_created_at ON onboarding_submissions (created_at DESC);

-- onboarding_documents
CREATE INDEX IF NOT EXISTS idx_onboarding_docs_submission_id ON onboarding_documents (submission_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_docs_document_type ON onboarding_documents (document_type);

-- quotation_payments
CREATE INDEX IF NOT EXISTS idx_quotation_payments_quotation_id ON quotation_payments (quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_payments_payment_date ON quotation_payments (payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_quotation_payments_recorded_by ON quotation_payments (recorded_by);

-- payment_proof_images
CREATE INDEX IF NOT EXISTS idx_payment_proof_payment_id ON payment_proof_images (payment_id);

-- csbd_credit_allocations
CREATE INDEX IF NOT EXISTS idx_csbd_credits_created_by ON csbd_credit_allocations (created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_csbd_credits_credit_to ON csbd_credit_allocations (credit_to_user_id);

-- call_dispositions
CREATE INDEX IF NOT EXISTS idx_call_dispositions_active ON call_dispositions (is_active);
