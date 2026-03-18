-- Create approval_tokens table for email-based approvals (no-login approve/reject)
CREATE TABLE IF NOT EXISTS approval_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token UUID DEFAULT gen_random_uuid() NOT NULL UNIQUE,
  request_type TEXT NOT NULL CHECK (request_type IN ('leave', 'regularization')),
  request_id UUID NOT NULL,
  approver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('approve', 'reject')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '72 hours'),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast token lookup
CREATE INDEX idx_approval_tokens_token ON approval_tokens(token);
CREATE INDEX idx_approval_tokens_request ON approval_tokens(request_type, request_id);

-- RLS: only service role should access this table (no public policies)
ALTER TABLE approval_tokens ENABLE ROW LEVEL SECURITY;
