-- Create the sync_demandcom_to_master function
CREATE OR REPLACE FUNCTION public.sync_demandcom_to_master()
RETURNS TABLE(
  total_processed INTEGER,
  total_inserted INTEGER,
  total_updated INTEGER,
  total_failed INTEGER,
  failed_records JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_processed INTEGER := 0;
  v_total_inserted INTEGER := 0;
  v_total_updated INTEGER := 0;
  v_total_failed INTEGER := 0;
  v_failed_records JSONB := '[]'::JSONB;
  v_record RECORD;
  v_exists BOOLEAN;
BEGIN
  -- Loop through demandcom records with valid mobile numbers and names
  FOR v_record IN 
    SELECT * FROM demandcom 
    WHERE mobile_numb IS NOT NULL 
      AND mobile_numb != '' 
      AND name IS NOT NULL 
      AND name != ''
  LOOP
    v_total_processed := v_total_processed + 1;
    
    BEGIN
      -- Check if record exists in master
      SELECT EXISTS(SELECT 1 FROM master WHERE mobile_numb = v_record.mobile_numb) INTO v_exists;
      
      IF v_exists THEN
        -- Update existing record
        UPDATE master SET
          name = COALESCE(v_record.name, master.name),
          designation = COALESCE(v_record.designation, master.designation),
          deppt = COALESCE(v_record.deppt, master.deppt),
          job_level_updated = COALESCE(v_record.job_level_updated, master.job_level_updated),
          linkedin = COALESCE(v_record.linkedin, master.linkedin),
          mobile2 = COALESCE(v_record.mobile2, master.mobile2),
          official = COALESCE(v_record.official, master.official),
          personal_email_id = COALESCE(v_record.personal_email_id, master.personal_email_id),
          generic_email_id = COALESCE(v_record.generic_email_id, master.generic_email_id),
          industry_type = COALESCE(v_record.industry_type, master.industry_type),
          sub_industry = COALESCE(v_record.sub_industry, master.sub_industry),
          company_name = COALESCE(v_record.company_name, master.company_name),
          address = COALESCE(v_record.address, master.address),
          location = COALESCE(v_record.location, master.location),
          city = COALESCE(v_record.city, master.city),
          state = COALESCE(v_record.state, master.state),
          zone = COALESCE(v_record.zone, master.zone),
          tier = COALESCE(v_record.tier, master.tier),
          pincode = COALESCE(v_record.pincode, master.pincode),
          website = COALESCE(v_record.website, master.website),
          turnover = COALESCE(v_record.turnover, master.turnover),
          emp_size = COALESCE(v_record.emp_size, master.emp_size),
          erp_name = COALESCE(v_record.erp_name, master.erp_name),
          erp_vendor = COALESCE(v_record.erp_vendor, master.erp_vendor),
          country = COALESCE(v_record.country, master.country),
          source = COALESCE(v_record.source, master.source),
          source_1 = COALESCE(v_record.source_1, master.source_1),
          extra = COALESCE(v_record.extra, master.extra),
          extra_1 = COALESCE(v_record.extra_1, master.extra_1),
          extra_2 = COALESCE(v_record.extra_2, master.extra_2),
          user_id = COALESCE(v_record.user_id, master.user_id),
          salutation = COALESCE(v_record.salutation, master.salutation),
          turnover_link = COALESCE(v_record.turnover_link, master.turnover_link),
          company_linkedin_url = COALESCE(v_record.company_linkedin_url, master.company_linkedin_url),
          associated_member_linkedin = COALESCE(v_record.associated_member_linkedin, master.associated_member_linkedin),
          activity_name = COALESCE(v_record.activity_name, master.activity_name),
          latest_disposition = COALESCE(v_record.latest_disposition, master.latest_disposition),
          latest_subdisposition = COALESCE(v_record.latest_subdisposition, master.latest_subdisposition),
          last_call_date = COALESCE(v_record.last_call_date, master.last_call_date),
          next_call_date = COALESCE(v_record.next_call_date, master.next_call_date),
          assigned_to = COALESCE(v_record.assigned_to, master.assigned_to),
          assigned_by = COALESCE(v_record.assigned_by, master.assigned_by),
          assigned_at = COALESCE(v_record.assigned_at, master.assigned_at),
          assignment_status = COALESCE(v_record.assignment_status, master.assignment_status),
          updated_at = NOW()
        WHERE mobile_numb = v_record.mobile_numb;
        
        v_total_updated := v_total_updated + 1;
      ELSE
        -- Insert new record
        INSERT INTO master (
          mobile_numb, name, designation, deppt, job_level_updated,
          linkedin, mobile2, official, personal_email_id, generic_email_id,
          industry_type, sub_industry, company_name, address, location,
          city, state, zone, tier, pincode, website, turnover, emp_size,
          erp_name, erp_vendor, country, source, source_1, extra, extra_1, extra_2,
          user_id, salutation, turnover_link, company_linkedin_url,
          associated_member_linkedin, activity_name, latest_disposition,
          latest_subdisposition, last_call_date, next_call_date,
          assigned_to, assigned_by, assigned_at, assignment_status,
          created_at, updated_at
        ) VALUES (
          v_record.mobile_numb, v_record.name, v_record.designation, v_record.deppt,
          v_record.job_level_updated, v_record.linkedin, v_record.mobile2,
          v_record.official, v_record.personal_email_id, v_record.generic_email_id,
          v_record.industry_type, v_record.sub_industry, v_record.company_name,
          v_record.address, v_record.location, v_record.city, v_record.state,
          v_record.zone, v_record.tier, v_record.pincode, v_record.website,
          v_record.turnover, v_record.emp_size, v_record.erp_name, v_record.erp_vendor,
          v_record.country, v_record.source, v_record.source_1, v_record.extra,
          v_record.extra_1, v_record.extra_2, v_record.user_id, v_record.salutation,
          v_record.turnover_link, v_record.company_linkedin_url,
          v_record.associated_member_linkedin, v_record.activity_name,
          v_record.latest_disposition, v_record.latest_subdisposition,
          v_record.last_call_date, v_record.next_call_date,
          v_record.assigned_to, v_record.assigned_by, v_record.assigned_at,
          v_record.assignment_status, NOW(), NOW()
        );
        
        v_total_inserted := v_total_inserted + 1;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      v_total_failed := v_total_failed + 1;
      v_failed_records := v_failed_records || jsonb_build_object(
        'mobile_numb', v_record.mobile_numb,
        'name', v_record.name,
        'error', SQLERRM
      );
    END;
  END LOOP;
  
  RETURN QUERY SELECT v_total_processed, v_total_inserted, v_total_updated, v_total_failed, v_failed_records;
END;
$$;