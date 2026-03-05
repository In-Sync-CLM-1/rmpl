-- Create the process_sync_batch function that runs entirely on the database server
CREATE OR REPLACE FUNCTION process_sync_batch(p_batch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sync_log_id uuid;
  v_batch_number integer;
  v_batch_size integer;
  v_offset integer;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_failed integer := 0;
  v_processed integer := 0;
  v_error_details jsonb := '[]'::jsonb;
  v_record RECORD;
  v_exists boolean;
BEGIN
  -- Get batch info
  SELECT sync_log_id, batch_number, batch_size, offset_start
  INTO v_sync_log_id, v_batch_number, v_batch_size, v_offset
  FROM sync_batches WHERE id = p_batch_id;
  
  IF v_sync_log_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Batch not found');
  END IF;
  
  -- Update batch status to processing
  UPDATE sync_batches 
  SET status = 'processing', started_at = NOW() 
  WHERE id = p_batch_id;
  
  -- Process records using the view with OFFSET/LIMIT
  FOR v_record IN 
    SELECT * FROM demandcom_latest_per_mobile
    WHERE mobile_numb IS NOT NULL AND mobile_numb != ''
      AND name IS NOT NULL AND name != ''
    ORDER BY mobile_numb
    OFFSET v_offset LIMIT v_batch_size
  LOOP
    v_processed := v_processed + 1;
    
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
        
        v_updated := v_updated + 1;
      ELSE
        -- Insert new record
        INSERT INTO master (
          mobile_numb, name, designation, deppt, job_level_updated,
          linkedin, mobile2, official, personal_email_id, generic_email_id,
          industry_type, sub_industry, company_name, address, location,
          city, state, zone, tier, pincode, website, turnover, emp_size,
          erp_name, erp_vendor, country, source, source_1, extra, extra_1, extra_2,
          salutation, turnover_link, company_linkedin_url,
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
          v_record.extra_1, v_record.extra_2, v_record.salutation,
          v_record.turnover_link, v_record.company_linkedin_url,
          v_record.associated_member_linkedin, v_record.activity_name,
          v_record.latest_disposition, v_record.latest_subdisposition,
          v_record.last_call_date, v_record.next_call_date,
          v_record.assigned_to, v_record.assigned_by, v_record.assigned_at,
          v_record.assignment_status, NOW(), NOW()
        );
        
        v_inserted := v_inserted + 1;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      v_error_details := v_error_details || jsonb_build_object(
        'mobile_numb', v_record.mobile_numb,
        'name', v_record.name,
        'error', SQLERRM
      );
    END;
  END LOOP;
  
  -- Update batch with results
  UPDATE sync_batches SET
    status = CASE WHEN v_failed > 0 THEN 'partial' ELSE 'completed' END,
    completed_at = NOW(),
    records_processed = v_processed,
    records_inserted = v_inserted,
    records_updated = v_updated,
    records_failed = v_failed,
    error_details = CASE WHEN v_failed > 0 THEN v_error_details ELSE NULL END
  WHERE id = p_batch_id;
  
  -- Update sync log progress
  PERFORM update_sync_log_progress(v_sync_log_id);
  
  RETURN jsonb_build_object(
    'batch_id', p_batch_id,
    'processed', v_processed,
    'inserted', v_inserted,
    'updated', v_updated,
    'failed', v_failed,
    'status', CASE WHEN v_failed > 0 THEN 'partial' ELSE 'completed' END
  );
END;
$$;