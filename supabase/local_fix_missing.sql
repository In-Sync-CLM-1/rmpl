-- ============================================================
-- Fix missing tables that were created outside of migrations
-- on the remote Supabase instance
-- ============================================================

-- ============================================================
-- 1. Drop job_seeker tables (don't exist on remote)
-- ============================================================
DROP TABLE IF EXISTS public.job_seeker_recommendations CASCADE;
DROP TABLE IF EXISTS public.job_seeker_engagement_summary CASCADE;
DROP TABLE IF EXISTS public.job_seeker_pipeline CASCADE;
DROP TABLE IF EXISTS public.job_seekers CASCADE;

-- ============================================================
-- 2. Create the demandcom table (core table, never in migrations)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.demandcom (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  mobile_numb TEXT,
  mobile2 TEXT,
  official TEXT,
  personal_email_id TEXT,
  generic_email_id TEXT,
  designation TEXT,
  deppt TEXT,
  company_name TEXT,
  industry_type TEXT,
  sub_industry TEXT,
  emp_size TEXT,
  turnover TEXT,
  turnover_link TEXT,
  erp_name TEXT,
  erp_vendor TEXT,
  location TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  zone TEXT,
  pincode TEXT,
  address TEXT,
  head_office_location TEXT,
  website TEXT,
  linkedin TEXT,
  company_linkedin_url TEXT,
  associated_member_linkedin TEXT,
  salutation TEXT,
  tier TEXT,
  source TEXT,
  source_1 TEXT,
  extra TEXT,
  extra_1 TEXT,
  extra_2 TEXT,
  user_id TEXT,
  job_level_updated TEXT,
  activity_name TEXT,
  latest_disposition TEXT,
  latest_subdisposition TEXT,
  last_call_date TIMESTAMPTZ,
  next_call_date TIMESTAMPTZ,
  remarks TEXT,
  assignment_status TEXT,
  assigned_to UUID REFERENCES public.profiles(id),
  assigned_by UUID REFERENCES public.profiles(id),
  assigned_at TIMESTAMPTZ,
  updated_by UUID REFERENCES public.profiles(id),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.demandcom ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies for demandcom
CREATE POLICY "Authenticated users can view demandcom"
  ON public.demandcom FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert demandcom"
  ON public.demandcom FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update demandcom"
  ON public.demandcom FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete demandcom"
  ON public.demandcom FOR DELETE
  TO authenticated
  USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_demandcom_mobile_numb ON public.demandcom(mobile_numb);
CREATE INDEX IF NOT EXISTS idx_demandcom_activity_name ON public.demandcom(activity_name);
CREATE INDEX IF NOT EXISTS idx_demandcom_assigned_to ON public.demandcom(assigned_to);
CREATE INDEX IF NOT EXISTS idx_demandcom_created_at ON public.demandcom(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_demandcom_updated_at ON public.demandcom(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_demandcom_company_name ON public.demandcom(company_name);
CREATE INDEX IF NOT EXISTS idx_demandcom_city ON public.demandcom(city);
CREATE INDEX IF NOT EXISTS idx_demandcom_latest_disposition ON public.demandcom(latest_disposition);

-- Updated_at trigger
CREATE TRIGGER update_demandcom_updated_at
  BEFORE UPDATE ON public.demandcom
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3. Create demandcom_pipeline table (not in any migration)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.demandcom_pipeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demandcom_id UUID REFERENCES public.demandcom(id) ON DELETE CASCADE,
  stage_id UUID REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  moved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT,
  is_current BOOLEAN DEFAULT true,
  entered_at TIMESTAMPTZ DEFAULT now(),
  exited_at TIMESTAMPTZ
);

ALTER TABLE public.demandcom_pipeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view pipeline"
  ON public.demandcom_pipeline FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert pipeline"
  ON public.demandcom_pipeline FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update pipeline"
  ON public.demandcom_pipeline FOR UPDATE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_demandcom_pipeline_demandcom ON public.demandcom_pipeline(demandcom_id);
CREATE INDEX IF NOT EXISTS idx_demandcom_pipeline_stage ON public.demandcom_pipeline(stage_id);
CREATE INDEX IF NOT EXISTS idx_demandcom_pipeline_current ON public.demandcom_pipeline(is_current) WHERE is_current = true;
