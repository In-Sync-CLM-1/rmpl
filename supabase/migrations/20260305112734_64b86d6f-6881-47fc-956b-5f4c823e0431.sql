
CREATE TABLE public.backup_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type text NOT NULL DEFAULT 'full',
  backup_mode text NOT NULL DEFAULT 'full',
  tables_exported text[] NOT NULL DEFAULT '{}',
  total_rows_exported integer NOT NULL DEFAULT 0,
  since_timestamp timestamptz,
  completed_at timestamptz NOT NULL DEFAULT now(),
  performed_by uuid NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.backup_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage backup_history"
ON public.backup_history
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
);
