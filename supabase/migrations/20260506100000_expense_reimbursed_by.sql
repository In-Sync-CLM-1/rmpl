-- Track who marked an expense claim as reimbursed (accounts processing)
ALTER TABLE public.travel_expense_claims
  ADD COLUMN IF NOT EXISTS reimbursed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_travel_expense_claims_status_reimbursed_by
  ON public.travel_expense_claims(status, reimbursed_by);
