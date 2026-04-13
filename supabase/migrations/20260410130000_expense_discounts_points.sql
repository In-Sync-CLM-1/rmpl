alter table public.project_expense_submissions
  add column if not exists discounts_received boolean not null default false,
  add column if not exists vendor_discounts jsonb default '[]'::jsonb,
  add column if not exists points_received boolean not null default false,
  add column if not exists loyalty_points jsonb default '[]'::jsonb;
