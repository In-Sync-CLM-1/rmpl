-- Create daily performance summary table
CREATE TABLE public.demandcom_daily_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  performance_date DATE NOT NULL,
  
  -- Disposition counts (Database team specific)
  disposition_fully_validate INT DEFAULT 0,
  disposition_partially_validate INT DEFAULT 0,
  disposition_company_closed INT DEFAULT 0,
  disposition_cpnf INT DEFAULT 0,
  disposition_ivc INT DEFAULT 0,
  disposition_lto INT DEFAULT 0,
  
  -- Field update counts by category
  company_info_updates INT DEFAULT 0,
  contact_info_updates INT DEFAULT 0,
  location_info_updates INT DEFAULT 0,
  other_field_updates INT DEFAULT 0,
  
  -- Totals
  total_disposition_changes INT DEFAULT 0,
  total_records_updated INT DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, performance_date)
);

-- Enable RLS
ALTER TABLE public.demandcom_daily_performance ENABLE ROW LEVEL SECURITY;

-- RLS policies - allow authenticated users to read
CREATE POLICY "Authenticated users can view performance data"
ON public.demandcom_daily_performance
FOR SELECT
TO authenticated
USING (true);

-- Create trigger function to aggregate performance on field changes
CREATE OR REPLACE FUNCTION public.aggregate_daily_performance()
RETURNS TRIGGER AS $$
DECLARE
  is_disposition_change BOOLEAN;
  disposition_value TEXT;
BEGIN
  -- Skip if no user
  IF NEW.changed_by IS NULL THEN
    RETURN NEW;
  END IF;
  
  is_disposition_change := NEW.field_name IN ('latest_disposition', 'disposition');
  disposition_value := COALESCE(NEW.new_value, '');
  
  INSERT INTO public.demandcom_daily_performance (
    user_id, 
    performance_date, 
    disposition_fully_validate,
    disposition_partially_validate,
    disposition_company_closed,
    disposition_cpnf,
    disposition_ivc,
    disposition_lto,
    company_info_updates,
    contact_info_updates,
    location_info_updates,
    other_field_updates,
    total_disposition_changes,
    total_records_updated
  )
  VALUES (
    NEW.changed_by,
    DATE(NEW.changed_at),
    CASE WHEN is_disposition_change AND disposition_value = 'Fully Validate' THEN 1 ELSE 0 END,
    CASE WHEN is_disposition_change AND disposition_value = 'Partially Validate' THEN 1 ELSE 0 END,
    CASE WHEN is_disposition_change AND disposition_value = 'Company Closed' THEN 1 ELSE 0 END,
    CASE WHEN is_disposition_change AND disposition_value = 'CPNF' THEN 1 ELSE 0 END,
    CASE WHEN is_disposition_change AND disposition_value = 'IVC (invalid criteria)' THEN 1 ELSE 0 END,
    CASE WHEN is_disposition_change AND disposition_value = 'LTO' THEN 1 ELSE 0 END,
    CASE WHEN NEW.field_name IN ('company_name', 'company_linkedin_url', 'website', 'industry_type', 'sub_industry', 'emp_size', 'turnover') THEN 1 ELSE 0 END,
    CASE WHEN NEW.field_name IN ('name', 'mobile_numb', 'mobile2', 'official', 'personal_email_id', 'generic_email_id', 'linkedin', 'designation', 'deppt') THEN 1 ELSE 0 END,
    CASE WHEN NEW.field_name IN ('city', 'state', 'address', 'pincode', 'zone', 'location', 'country', 'head_office_location') THEN 1 ELSE 0 END,
    CASE WHEN NEW.field_name NOT IN ('company_name', 'company_linkedin_url', 'website', 'industry_type', 'sub_industry', 'emp_size', 'turnover', 'name', 'mobile_numb', 'mobile2', 'official', 'personal_email_id', 'generic_email_id', 'linkedin', 'designation', 'deppt', 'city', 'state', 'address', 'pincode', 'zone', 'location', 'country', 'head_office_location', 'latest_disposition', 'disposition') THEN 1 ELSE 0 END,
    CASE WHEN is_disposition_change THEN 1 ELSE 0 END,
    1
  )
  ON CONFLICT (user_id, performance_date) DO UPDATE SET
    disposition_fully_validate = demandcom_daily_performance.disposition_fully_validate + 
      CASE WHEN is_disposition_change AND disposition_value = 'Fully Validate' THEN 1 ELSE 0 END,
    disposition_partially_validate = demandcom_daily_performance.disposition_partially_validate + 
      CASE WHEN is_disposition_change AND disposition_value = 'Partially Validate' THEN 1 ELSE 0 END,
    disposition_company_closed = demandcom_daily_performance.disposition_company_closed + 
      CASE WHEN is_disposition_change AND disposition_value = 'Company Closed' THEN 1 ELSE 0 END,
    disposition_cpnf = demandcom_daily_performance.disposition_cpnf + 
      CASE WHEN is_disposition_change AND disposition_value = 'CPNF' THEN 1 ELSE 0 END,
    disposition_ivc = demandcom_daily_performance.disposition_ivc + 
      CASE WHEN is_disposition_change AND disposition_value = 'IVC (invalid criteria)' THEN 1 ELSE 0 END,
    disposition_lto = demandcom_daily_performance.disposition_lto + 
      CASE WHEN is_disposition_change AND disposition_value = 'LTO' THEN 1 ELSE 0 END,
    company_info_updates = demandcom_daily_performance.company_info_updates + 
      CASE WHEN NEW.field_name IN ('company_name', 'company_linkedin_url', 'website', 'industry_type', 'sub_industry', 'emp_size', 'turnover') THEN 1 ELSE 0 END,
    contact_info_updates = demandcom_daily_performance.contact_info_updates + 
      CASE WHEN NEW.field_name IN ('name', 'mobile_numb', 'mobile2', 'official', 'personal_email_id', 'generic_email_id', 'linkedin', 'designation', 'deppt') THEN 1 ELSE 0 END,
    location_info_updates = demandcom_daily_performance.location_info_updates + 
      CASE WHEN NEW.field_name IN ('city', 'state', 'address', 'pincode', 'zone', 'location', 'country', 'head_office_location') THEN 1 ELSE 0 END,
    other_field_updates = demandcom_daily_performance.other_field_updates + 
      CASE WHEN NEW.field_name NOT IN ('company_name', 'company_linkedin_url', 'website', 'industry_type', 'sub_industry', 'emp_size', 'turnover', 'name', 'mobile_numb', 'mobile2', 'official', 'personal_email_id', 'generic_email_id', 'linkedin', 'designation', 'deppt', 'city', 'state', 'address', 'pincode', 'zone', 'location', 'country', 'head_office_location', 'latest_disposition', 'disposition') THEN 1 ELSE 0 END,
    total_disposition_changes = demandcom_daily_performance.total_disposition_changes + 
      CASE WHEN is_disposition_change THEN 1 ELSE 0 END,
    total_records_updated = demandcom_daily_performance.total_records_updated + 1,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on demandcom_field_changes
CREATE TRIGGER trg_aggregate_daily_performance
AFTER INSERT ON public.demandcom_field_changes
FOR EACH ROW
EXECUTE FUNCTION public.aggregate_daily_performance();

-- Backfill existing data from demandcom_field_changes
INSERT INTO public.demandcom_daily_performance (
  user_id,
  performance_date,
  disposition_fully_validate,
  disposition_partially_validate,
  disposition_company_closed,
  disposition_cpnf,
  disposition_ivc,
  disposition_lto,
  company_info_updates,
  contact_info_updates,
  location_info_updates,
  other_field_updates,
  total_disposition_changes,
  total_records_updated
)
SELECT 
  changed_by,
  DATE(changed_at),
  SUM(CASE WHEN field_name IN ('latest_disposition', 'disposition') AND new_value = 'Fully Validate' THEN 1 ELSE 0 END),
  SUM(CASE WHEN field_name IN ('latest_disposition', 'disposition') AND new_value = 'Partially Validate' THEN 1 ELSE 0 END),
  SUM(CASE WHEN field_name IN ('latest_disposition', 'disposition') AND new_value = 'Company Closed' THEN 1 ELSE 0 END),
  SUM(CASE WHEN field_name IN ('latest_disposition', 'disposition') AND new_value = 'CPNF' THEN 1 ELSE 0 END),
  SUM(CASE WHEN field_name IN ('latest_disposition', 'disposition') AND new_value = 'IVC (invalid criteria)' THEN 1 ELSE 0 END),
  SUM(CASE WHEN field_name IN ('latest_disposition', 'disposition') AND new_value = 'LTO' THEN 1 ELSE 0 END),
  SUM(CASE WHEN field_name IN ('company_name', 'company_linkedin_url', 'website', 'industry_type', 'sub_industry', 'emp_size', 'turnover') THEN 1 ELSE 0 END),
  SUM(CASE WHEN field_name IN ('name', 'mobile_numb', 'mobile2', 'official', 'personal_email_id', 'generic_email_id', 'linkedin', 'designation', 'deppt') THEN 1 ELSE 0 END),
  SUM(CASE WHEN field_name IN ('city', 'state', 'address', 'pincode', 'zone', 'location', 'country', 'head_office_location') THEN 1 ELSE 0 END),
  SUM(CASE WHEN field_name NOT IN ('company_name', 'company_linkedin_url', 'website', 'industry_type', 'sub_industry', 'emp_size', 'turnover', 'name', 'mobile_numb', 'mobile2', 'official', 'personal_email_id', 'generic_email_id', 'linkedin', 'designation', 'deppt', 'city', 'state', 'address', 'pincode', 'zone', 'location', 'country', 'head_office_location', 'latest_disposition', 'disposition') THEN 1 ELSE 0 END),
  SUM(CASE WHEN field_name IN ('latest_disposition', 'disposition') THEN 1 ELSE 0 END),
  COUNT(*)
FROM public.demandcom_field_changes
WHERE changed_by IS NOT NULL
GROUP BY changed_by, DATE(changed_at)
ON CONFLICT (user_id, performance_date) DO NOTHING;