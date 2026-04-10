create table public.project_expense_submissions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  expense_category text not null,
  excel_url text,
  excel_filename text,
  invoice_urls jsonb default '[]'::jsonb,
  ai_summary jsonb,
  total_amount numeric,
  submitted_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.project_expense_submissions enable row level security;

create policy "Authenticated users can manage project expense submissions"
  on public.project_expense_submissions
  for all
  to authenticated
  using (true)
  with check (true);
