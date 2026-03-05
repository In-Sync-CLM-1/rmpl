-- Create CSV row formatter function
CREATE OR REPLACE FUNCTION public.format_master_csv_row(p_row master)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_values text[] := '{}';
  v_val text;
BEGIN
  -- Format each column with CSV escaping
  v_values := ARRAY[
    COALESCE(p_row.id::text, ''),
    CASE WHEN p_row.mobile_numb ~ '[,"\n\r]' THEN '"' || replace(COALESCE(p_row.mobile_numb, ''), '"', '""') || '"' ELSE COALESCE(p_row.mobile_numb, '') END,
    CASE WHEN p_row.name ~ '[,"\n\r]' THEN '"' || replace(COALESCE(p_row.name, ''), '"', '""') || '"' ELSE COALESCE(p_row.name, '') END,
    CASE WHEN p_row.salutation ~ '[,"\n\r]' THEN '"' || replace(COALESCE(p_row.salutation, ''), '"', '""') || '"' ELSE COALESCE(p_row.salutation, '') END,
    CASE WHEN p_row.designation ~ '[,"\n\r]' THEN '"' || replace(COALESCE(p_row.designation, ''), '"', '""') || '"' ELSE COALESCE(p_row.designation, '') END,
    CASE WHEN p_row.deppt ~ '[,"\n\r]' THEN '"' || replace(COALESCE(p_row.deppt, ''), '"', '""') || '"' ELSE COALESCE(p_row.deppt, '') END,
    CASE WHEN p_row.job_level_updated ~ '[,"\n\r]' THEN '"' || replace(COALESCE(p_row.job_level_updated, ''), '"', '""') || '"' ELSE COALESCE(p_row.job_level_updated, '') END,
    CASE WHEN p_row.linkedin ~ '[,"\n\r]' THEN '"' || replace(COALESCE(p_row.linkedin, ''), '"', '""') || '"' ELSE COALESCE(p_row.linkedin, '') END,
    CASE WHEN p_row.mobile2 ~ '[,"\n\r]' THEN '"' || replace(COALESCE(p_row.mobile2, ''), '"', '""') || '"' ELSE COALESCE(p_row.mobile2, '') END,
    CASE WHEN p_row.official ~ '[,"\n\r]' THEN '"' || replace(COALESCE(p_row.official, ''), '"', '""') || '"' ELSE COALESCE(p_row.official, '') END,
    CASE WHEN p_row.personal_email_id ~ '[,"\n\r]' THEN '"' || replace(COALESCE(p_row.personal_email_id, ''), '"', '""') || '"' ELSE COALESCE(p_row.personal_email_id, '') END,
    CASE WHEN p_row.generic_email_id ~ '[,"\n\r]' THEN '"' || replace(COALESCE(p_row.generic_email_id, ''), '"', '""') || '"' ELSE COALESCE(p_row.generic_email_id, '') END,
    CASE WHEN p_row.industry_type ~ '[,"\n\r]' THEN '"' || replace(COALESCE(p_row.industry_type, ''), '"', '""') || '"' ELSE COALESCE(p_row.industry_type, '') END,
    CASE WHEN p_row.sub_industry ~ '[,"\n\r]' THEN '"' || replace(COALESCE(p_row.sub_industry, ''), '"', '""') || '"' ELSE COALESCE(p_row.sub_industry, '') END,
    CASE WHEN p_row.company_name ~ '[,"\n\r]' THEN '"' || replace(COALESCE(p_row.company_name, ''), '"', '""') || '"' ELSE COALESCE(p_row.company_name, '') END,
    CASE WHEN p_row.address ~ '[,"\n\r]' THEN '"' || replace(COALESCE(p_row.address, ''), '"', '""') || '"' ELSE COALESCE(p_row.address, '') END,
    CASE WHEN p_row.location ~ '[,"\n\r]' THEN '"' || replace(COALESCE(p_row.location, ''), '"', '""') || '"' ELSE COALESCE(p_row.location, '') END,
    CASE WHEN p_row.city ~ '[,"\n\r]' THEN '"' || replace(COALESCE(p_row.city, ''), '"', '""') || '"' ELSE COALESCE(p_row.city, '') END,
    CASE WHEN p_row.state ~ '[,"\n\r]' THEN '"' || replace(COALESCE(p_row.state, ''), '"', '""') || '"' ELSE COALESCE(p_row.state, '') END,
    CASE WHEN p_row.country ~ '[,"\n\r]' THEN '"' || replace(COALESCE(p_row.country, ''), '"', '""') || '"' ELSE COALESCE(p_row.country, '') END,
    CASE WHEN p_row.zone ~ '[,"\n\r]' THEN '"' || replace(COALESCE(p_row.zone, ''), '"', '""') || '"' ELSE COALESCE(p_row.zone, '') END,
    CASE WHEN p_row.tier ~ '[,"\n\r]' THEN '"' || replace(COALESCE(p_row.tier, ''), '"', '""') || '"' ELSE COALESCE(p_row.tier, '') END,
    CASE WHEN p_row.pincode ~ '[,"\n\r]' THEN '"' || replace(COALESCE(p_row.pincode, ''), '"', '""') || '"' ELSE COALESCE(p_row.pincode, '') END,
    CASE WHEN p_row.website ~ '[,"\n\r]' THEN '"' || replace(COALESCE(p_row.website, ''), '"', '""') || '"' ELSE COALESCE(p_row.website, '') END,
    CASE WHEN p_row.turnover ~ '[,"\n\r]' THEN '"' || replace(COALESCE(p_row.turnover, ''), '"', '""') || '"' ELSE COALESCE(p_row.turnover, '') END,
    CASE WHEN p_row.turnover_link ~ '[,"\n\r]' THEN '"' || replace(COALESCE(p_row.turnover_link, ''), '"', '""') || '"' ELSE COALESCE(p_row.turnover_link, '') END,
    CASE WHEN p_row.emp_size ~ '[,"\n\r]' THEN '"' || replace(COALESCE(p_row.emp_size, ''), '"', '""') || '"' ELSE COALESCE(p_row.emp_size, '') END,
    CASE WHEN p_row.erp_name ~ '[,"\n\r]' THEN '"' || replace(COALESCE(p_row.erp_name, ''), '"', '""') || '"' ELSE COALESCE(p_row.erp_name, '') END,
    CASE WHEN p_row.erp_vendor ~ '[,"\n\r]' THEN '"' || replace(COALESCE(p_row.erp_vendor, ''), '"', '""') || '"' ELSE COALESCE(p_row.erp_vendor, '') END,
    CASE WHEN p_row.company_linkedin_url ~ '[,"\n\r]' THEN '"' || replace(COALESCE(p_row.company_linkedin_url, ''), '"', '""') || '"' ELSE COALESCE(p_row.company_linkedin_url, '') END,
    CASE WHEN p_row.associated_member_linkedin ~ '[,"\n\r]' THEN '"' || replace(COALESCE(p_row.associated_member_linkedin, ''), '"', '""') || '"' ELSE COALESCE(p_row.associated_member_linkedin, '') END,
    CASE WHEN p_row.assignment_status ~ '[,"\n\r]' THEN '"' || replace(COALESCE(p_row.assignment_status, ''), '"', '""') || '"' ELSE COALESCE(p_row.assignment_status, '') END,
    COALESCE(p_row.assigned_to::text, ''),
    COALESCE(p_row.assigned_by::text, ''),
    COALESCE(p_row.assigned_at::text, ''),
    COALESCE(p_row.last_call_date::text, ''),
    COALESCE(p_row.next_call_date::text, ''),
    CASE WHEN p_row.latest_disposition ~ '[,"\n\r]' THEN '"' || replace(COALESCE(p_row.latest_disposition, ''), '"', '""') || '"' ELSE COALESCE(p_row.latest_disposition, '') END,
    CASE WHEN p_row.latest_subdisposition ~ '[,"\n\r]' THEN '"' || replace(COALESCE(p_row.latest_subdisposition, ''), '"', '""') || '"' ELSE COALESCE(p_row.latest_subdisposition, '') END,
    CASE WHEN p_row.activity_name ~ '[,"\n\r]' THEN '"' || replace(COALESCE(p_row.activity_name, ''), '"', '""') || '"' ELSE COALESCE(p_row.activity_name, '') END,
    CASE WHEN p_row.source ~ '[,"\n\r]' THEN '"' || replace(COALESCE(p_row.source, ''), '"', '""') || '"' ELSE COALESCE(p_row.source, '') END,
    CASE WHEN p_row.source_1 ~ '[,"\n\r]' THEN '"' || replace(COALESCE(p_row.source_1, ''), '"', '""') || '"' ELSE COALESCE(p_row.source_1, '') END,
    CASE WHEN p_row.extra ~ '[,"\n\r]' THEN '"' || replace(COALESCE(p_row.extra, ''), '"', '""') || '"' ELSE COALESCE(p_row.extra, '') END,
    CASE WHEN p_row.extra_1 ~ '[,"\n\r]' THEN '"' || replace(COALESCE(p_row.extra_1, ''), '"', '""') || '"' ELSE COALESCE(p_row.extra_1, '') END,
    CASE WHEN p_row.extra_2 ~ '[,"\n\r]' THEN '"' || replace(COALESCE(p_row.extra_2, ''), '"', '""') || '"' ELSE COALESCE(p_row.extra_2, '') END,
    COALESCE(p_row.created_at::text, ''),
    COALESCE(p_row.updated_at::text, '')
  ];
  
  RETURN array_to_string(v_values, ',');
END;
$$;

-- Create the main export batch generator function
CREATE OR REPLACE FUNCTION public.generate_master_export_batch(
  p_batch_size integer DEFAULT 50000,
  p_offset integer DEFAULT 0,
  p_include_header boolean DEFAULT false
)
RETURNS TABLE(csv_content text, records_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_csv text := '';
  v_row master%ROWTYPE;
  v_count integer := 0;
  v_header text := 'id,mobile_numb,name,salutation,designation,deppt,job_level_updated,linkedin,mobile2,official,personal_email_id,generic_email_id,industry_type,sub_industry,company_name,address,location,city,state,country,zone,tier,pincode,website,turnover,turnover_link,emp_size,erp_name,erp_vendor,company_linkedin_url,associated_member_linkedin,assignment_status,assigned_to,assigned_by,assigned_at,last_call_date,next_call_date,latest_disposition,latest_subdisposition,activity_name,source,source_1,extra,extra_1,extra_2,created_at,updated_at';
BEGIN
  -- Add header for first batch
  IF p_include_header THEN
    v_csv := v_header || E'\n';
  END IF;
  
  -- Loop through records and build CSV using cursor for memory efficiency
  FOR v_row IN 
    SELECT * FROM master 
    ORDER BY id 
    OFFSET p_offset 
    LIMIT p_batch_size
  LOOP
    v_csv := v_csv || format_master_csv_row(v_row) || E'\n';
    v_count := v_count + 1;
  END LOOP;
  
  RETURN QUERY SELECT v_csv, v_count;
END;
$$;

-- Create function to process export batch and return result
CREATE OR REPLACE FUNCTION public.process_export_batch(
  p_job_id uuid,
  p_batch_num integer,
  p_batch_size integer DEFAULT 50000
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_csv text;
  v_count integer;
  v_offset integer;
  v_include_header boolean;
BEGIN
  v_offset := p_batch_num * p_batch_size;
  v_include_header := (p_batch_num = 0);
  
  -- Generate the CSV batch
  SELECT csv_content, records_count 
  INTO v_csv, v_count
  FROM generate_master_export_batch(p_batch_size, v_offset, v_include_header);
  
  -- Update job progress
  UPDATE export_jobs SET
    current_batch = p_batch_num + 1,
    processed_records = COALESCE(processed_records, 0) + v_count,
    updated_at = NOW()
  WHERE id = p_job_id;
  
  RETURN jsonb_build_object(
    'batch_num', p_batch_num,
    'records_count', v_count,
    'csv_content', v_csv,
    'offset', v_offset
  );
END;
$$;