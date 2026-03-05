-- Create audit log table for password resets
CREATE TABLE IF NOT EXISTS public.password_reset_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  admin_email text NOT NULL,
  target_email text NOT NULL,
  admin_full_name text,
  target_full_name text,
  action_status text NOT NULL CHECK (action_status IN ('success', 'failed')),
  failure_reason text,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.password_reset_logs ENABLE ROW LEVEL SECURITY;

-- Only admins and super_admins can view logs
CREATE POLICY "Admins can view password reset logs"
  ON public.password_reset_logs
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'platform_admin'::app_role)
  );

-- System can insert logs
CREATE POLICY "System can create password reset logs"
  ON public.password_reset_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = admin_user_id);

-- Create indexes for faster queries
CREATE INDEX idx_password_reset_logs_admin_user ON public.password_reset_logs(admin_user_id);
CREATE INDEX idx_password_reset_logs_target_user ON public.password_reset_logs(target_user_id);
CREATE INDEX idx_password_reset_logs_created_at ON public.password_reset_logs(created_at DESC);