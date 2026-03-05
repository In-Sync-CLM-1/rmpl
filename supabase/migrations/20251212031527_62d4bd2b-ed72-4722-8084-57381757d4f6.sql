
-- Drop and recreate the process_bulk_import_batch function to track inserted record IDs
CREATE OR REPLACE FUNCTION public.process_bulk_import_batch(p_import_id uuid, p_table_name text, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_inserted INTEGER := 0;
  v_failed INTEGER := 0;
  v_processed INTEGER := 0;
  v_errors JSONB := '[]'::JSONB;
  v_record RECORD;
  v_email_to_id_map JSONB;
  v_assigned_to_id UUID;
  v_raw JSONB;
  v_insert_error TEXT;
  v_new_record_id UUID;
BEGIN
  -- Step 1: Build email-to-UUID lookup map for assigned_to field
  SELECT COALESCE(jsonb_object_agg(LOWER(email), id), '{}'::JSONB)
  INTO v_email_to_id_map
  FROM profiles
  WHERE LOWER(email) IN (
    SELECT DISTINCT LOWER(raw_data->>'assigned_to')
    FROM import_staging
    WHERE import_id = p_import_id 
      AND processed = false
      AND raw_data->>'assigned_to' IS NOT NULL
      AND raw_data->>'assigned_to' != ''
  );

  -- Step 2: Process each staging record
  FOR v_record IN 
    SELECT id, row_number, raw_data 
    FROM import_staging 
    WHERE import_id = p_import_id AND processed = false
    ORDER BY row_number
  LOOP
    v_processed := v_processed + 1;
    v_raw := v_record.raw_data;
    v_new_record_id := NULL;
    
    BEGIN
      -- Validate required fields
      IF p_table_name IN ('demandcom', 'master') THEN
        IF (v_raw->>'name' IS NULL OR TRIM(v_raw->>'name') = '') 
           AND (v_raw->>'mobile_numb' IS NULL OR TRIM(v_raw->>'mobile_numb') = '') THEN
          v_errors := v_errors || jsonb_build_object(
            'row', v_record.row_number,
            'message', 'Missing required fields: name or mobile_numb'
          );
          v_failed := v_failed + 1;
          
          UPDATE import_staging 
          SET processed = true, error_message = 'Missing required fields'
          WHERE id = v_record.id;
          
          CONTINUE;
        END IF;
      END IF;

      -- Resolve assigned_to email to UUID
      v_assigned_to_id := NULL;
      IF v_raw->>'assigned_to' IS NOT NULL AND TRIM(v_raw->>'assigned_to') != '' THEN
        v_assigned_to_id := (v_email_to_id_map->>LOWER(TRIM(v_raw->>'assigned_to')))::UUID;
      END IF;

      -- Insert into target table and capture the new record ID
      IF p_table_name = 'demandcom' THEN
        INSERT INTO demandcom (
          name, mobile_numb, mobile2, designation, deppt, job_level_updated,
          linkedin, official, personal_email_id, generic_email_id,
          company_name, industry_type, sub_industry, address, location,
          city, state, zone, tier, pincode, country, website, turnover, 
          turnover_link, emp_size, erp_name, erp_vendor, company_linkedin_url,
          associated_member_linkedin, source, source_1, extra, extra_1, extra_2,
          salutation, activity_name, remarks, head_office_location,
          assigned_to, assigned_by, assigned_at, assignment_status, created_by
        ) VALUES (
          NULLIF(TRIM(v_raw->>'name'), ''),
          NULLIF(TRIM(v_raw->>'mobile_numb'), ''),
          NULLIF(TRIM(v_raw->>'mobile2'), ''),
          NULLIF(TRIM(v_raw->>'designation'), ''),
          NULLIF(TRIM(v_raw->>'deppt'), ''),
          NULLIF(TRIM(v_raw->>'job_level_updated'), ''),
          NULLIF(TRIM(v_raw->>'linkedin'), ''),
          NULLIF(TRIM(v_raw->>'official'), ''),
          NULLIF(TRIM(v_raw->>'personal_email_id'), ''),
          NULLIF(TRIM(v_raw->>'generic_email_id'), ''),
          NULLIF(TRIM(v_raw->>'company_name'), ''),
          NULLIF(TRIM(v_raw->>'industry_type'), ''),
          NULLIF(TRIM(v_raw->>'sub_industry'), ''),
          NULLIF(TRIM(v_raw->>'address'), ''),
          NULLIF(TRIM(v_raw->>'location'), ''),
          NULLIF(TRIM(v_raw->>'city'), ''),
          NULLIF(TRIM(v_raw->>'state'), ''),
          NULLIF(TRIM(v_raw->>'zone'), ''),
          NULLIF(TRIM(v_raw->>'tier'), ''),
          NULLIF(TRIM(v_raw->>'pincode'), ''),
          NULLIF(TRIM(v_raw->>'country'), ''),
          NULLIF(TRIM(v_raw->>'website'), ''),
          NULLIF(TRIM(v_raw->>'turnover'), ''),
          NULLIF(TRIM(v_raw->>'turnover_link'), ''),
          NULLIF(TRIM(v_raw->>'emp_size'), ''),
          NULLIF(TRIM(v_raw->>'erp_name'), ''),
          NULLIF(TRIM(v_raw->>'erp_vendor'), ''),
          NULLIF(TRIM(v_raw->>'company_linkedin_url'), ''),
          NULLIF(TRIM(v_raw->>'associated_member_linkedin'), ''),
          NULLIF(TRIM(v_raw->>'source'), ''),
          NULLIF(TRIM(v_raw->>'source_1'), ''),
          NULLIF(TRIM(v_raw->>'extra'), ''),
          NULLIF(TRIM(v_raw->>'extra_1'), ''),
          NULLIF(TRIM(v_raw->>'extra_2'), ''),
          NULLIF(TRIM(v_raw->>'salutation'), ''),
          NULLIF(TRIM(v_raw->>'activity_name'), ''),
          NULLIF(TRIM(v_raw->>'remarks'), ''),
          NULLIF(TRIM(v_raw->>'head_office_location'), ''),
          v_assigned_to_id,
          CASE WHEN v_assigned_to_id IS NOT NULL THEN p_user_id ELSE NULL END,
          CASE WHEN v_assigned_to_id IS NOT NULL THEN NOW() ELSE NULL END,
          CASE WHEN v_assigned_to_id IS NOT NULL THEN 'assigned' ELSE 'unassigned' END,
          p_user_id
        )
        RETURNING id INTO v_new_record_id;
        
      ELSIF p_table_name = 'master' THEN
        INSERT INTO master (
          name, mobile_numb, mobile2, designation, deppt, job_level_updated,
          linkedin, official, personal_email_id, generic_email_id,
          company_name, industry_type, sub_industry, address, location,
          city, state, zone, tier, pincode, country, website, turnover, 
          turnover_link, emp_size, erp_name, erp_vendor, company_linkedin_url,
          associated_member_linkedin, source, source_1, extra, extra_1, extra_2,
          salutation, activity_name, assigned_to, assigned_by, assigned_at, 
          assignment_status, created_by
        ) VALUES (
          NULLIF(TRIM(v_raw->>'name'), ''),
          NULLIF(TRIM(v_raw->>'mobile_numb'), ''),
          NULLIF(TRIM(v_raw->>'mobile2'), ''),
          NULLIF(TRIM(v_raw->>'designation'), ''),
          NULLIF(TRIM(v_raw->>'deppt'), ''),
          NULLIF(TRIM(v_raw->>'job_level_updated'), ''),
          NULLIF(TRIM(v_raw->>'linkedin'), ''),
          NULLIF(TRIM(v_raw->>'official'), ''),
          NULLIF(TRIM(v_raw->>'personal_email_id'), ''),
          NULLIF(TRIM(v_raw->>'generic_email_id'), ''),
          NULLIF(TRIM(v_raw->>'company_name'), ''),
          NULLIF(TRIM(v_raw->>'industry_type'), ''),
          NULLIF(TRIM(v_raw->>'sub_industry'), ''),
          NULLIF(TRIM(v_raw->>'address'), ''),
          NULLIF(TRIM(v_raw->>'location'), ''),
          NULLIF(TRIM(v_raw->>'city'), ''),
          NULLIF(TRIM(v_raw->>'state'), ''),
          NULLIF(TRIM(v_raw->>'zone'), ''),
          NULLIF(TRIM(v_raw->>'tier'), ''),
          NULLIF(TRIM(v_raw->>'pincode'), ''),
          NULLIF(TRIM(v_raw->>'country'), ''),
          NULLIF(TRIM(v_raw->>'website'), ''),
          NULLIF(TRIM(v_raw->>'turnover'), ''),
          NULLIF(TRIM(v_raw->>'turnover_link'), ''),
          NULLIF(TRIM(v_raw->>'emp_size'), ''),
          NULLIF(TRIM(v_raw->>'erp_name'), ''),
          NULLIF(TRIM(v_raw->>'erp_vendor'), ''),
          NULLIF(TRIM(v_raw->>'company_linkedin_url'), ''),
          NULLIF(TRIM(v_raw->>'associated_member_linkedin'), ''),
          NULLIF(TRIM(v_raw->>'source'), ''),
          NULLIF(TRIM(v_raw->>'source_1'), ''),
          NULLIF(TRIM(v_raw->>'extra'), ''),
          NULLIF(TRIM(v_raw->>'extra_1'), ''),
          NULLIF(TRIM(v_raw->>'extra_2'), ''),
          NULLIF(TRIM(v_raw->>'salutation'), ''),
          NULLIF(TRIM(v_raw->>'activity_name'), ''),
          v_assigned_to_id,
          CASE WHEN v_assigned_to_id IS NOT NULL THEN p_user_id ELSE NULL END,
          CASE WHEN v_assigned_to_id IS NOT NULL THEN NOW() ELSE NULL END,
          CASE WHEN v_assigned_to_id IS NOT NULL THEN 'assigned' ELSE 'unassigned' END,
          p_user_id
        )
        RETURNING id INTO v_new_record_id;
      END IF;
      
      -- Track the inserted record for revert capability
      IF v_new_record_id IS NOT NULL THEN
        INSERT INTO bulk_import_records (import_id, record_id, table_name, row_number)
        VALUES (p_import_id, v_new_record_id, p_table_name, v_record.row_number);
        
        v_inserted := v_inserted + 1;
        UPDATE import_staging SET processed = true WHERE id = v_record.id;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      v_insert_error := SQLERRM;
      v_failed := v_failed + 1;
      v_errors := v_errors || jsonb_build_object(
        'row', v_record.row_number,
        'message', v_insert_error
      );
      
      UPDATE import_staging 
      SET processed = true, error_message = v_insert_error
      WHERE id = v_record.id;
    END;
  END LOOP;

  -- Return results
  RETURN jsonb_build_object(
    'processed', v_processed,
    'inserted', v_inserted,
    'failed', v_failed,
    'errors', v_errors
  );
END;
$function$;
