-- Update process_bulk_import_batch function to add missing fields to Master import
-- This makes Master and DemandCom bulk import templates identical

CREATE OR REPLACE FUNCTION public.process_bulk_import_batch(
  p_import_id uuid,
  p_table_name text,
  p_user_id uuid,
  p_batch_size integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_processed integer := 0;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_failed integer := 0;
  v_errors jsonb := '[]'::jsonb;
  v_staging_record RECORD;
  v_raw_data jsonb;
  v_mobile text;
  v_existing_id uuid;
  v_assigned_to_id uuid;
  v_assigned_to_email text;
BEGIN
  -- Process records from staging table
  FOR v_staging_record IN
    SELECT id, raw_data, row_number
    FROM import_staging
    WHERE import_id = p_import_id
      AND processed = false
    ORDER BY row_number
    LIMIT p_batch_size
  LOOP
    BEGIN
      v_raw_data := v_staging_record.raw_data;
      v_mobile := TRIM(v_raw_data->>'mobile_numb');
      
      -- Skip if no mobile number
      IF v_mobile IS NULL OR v_mobile = '' THEN
        v_failed := v_failed + 1;
        v_errors := v_errors || jsonb_build_object(
          'row', v_staging_record.row_number,
          'error', 'Missing mobile number'
        );
        
        UPDATE import_staging
        SET processed = true, error_message = 'Missing mobile number'
        WHERE id = v_staging_record.id;
        
        CONTINUE;
      END IF;
      
      -- Resolve assigned_to email to UUID
      v_assigned_to_id := NULL;
      v_assigned_to_email := TRIM(v_raw_data->>'assigned_to');
      
      IF v_assigned_to_email IS NOT NULL AND v_assigned_to_email != '' THEN
        SELECT id INTO v_assigned_to_id 
        FROM profiles 
        WHERE LOWER(email) = LOWER(v_assigned_to_email)
        LIMIT 1;
      END IF;
      
      IF p_table_name = 'demandcom' THEN
        -- Check if record exists
        SELECT id INTO v_existing_id
        FROM demandcom
        WHERE mobile_numb = v_mobile
        LIMIT 1;
        
        IF v_existing_id IS NOT NULL THEN
          -- Update existing record
          UPDATE demandcom SET
            name = COALESCE(NULLIF(TRIM(v_raw_data->>'name'), ''), name),
            salutation = COALESCE(NULLIF(TRIM(v_raw_data->>'salutation'), ''), salutation),
            company_name = COALESCE(NULLIF(TRIM(v_raw_data->>'company_name'), ''), company_name),
            designation = COALESCE(NULLIF(TRIM(v_raw_data->>'designation'), ''), designation),
            deppt = COALESCE(NULLIF(TRIM(v_raw_data->>'deppt'), ''), deppt),
            official = COALESCE(NULLIF(TRIM(v_raw_data->>'official'), ''), official),
            personal_email_id = COALESCE(NULLIF(TRIM(v_raw_data->>'personal_email_id'), ''), personal_email_id),
            generic_email_id = COALESCE(NULLIF(TRIM(v_raw_data->>'generic_email_id'), ''), generic_email_id),
            mobile2 = COALESCE(NULLIF(TRIM(v_raw_data->>'mobile2'), ''), mobile2),
            linkedin = COALESCE(NULLIF(TRIM(v_raw_data->>'linkedin'), ''), linkedin),
            company_linkedin_url = COALESCE(NULLIF(TRIM(v_raw_data->>'company_linkedin_url'), ''), company_linkedin_url),
            associated_member_linkedin = COALESCE(NULLIF(TRIM(v_raw_data->>'associated_member_linkedin'), ''), associated_member_linkedin),
            website = COALESCE(NULLIF(TRIM(v_raw_data->>'website'), ''), website),
            address = COALESCE(NULLIF(TRIM(v_raw_data->>'address'), ''), address),
            city = COALESCE(NULLIF(TRIM(v_raw_data->>'city'), ''), city),
            state = COALESCE(NULLIF(TRIM(v_raw_data->>'state'), ''), state),
            pincode = COALESCE(NULLIF(TRIM(v_raw_data->>'pincode'), ''), pincode),
            country = COALESCE(NULLIF(TRIM(v_raw_data->>'country'), ''), country),
            zone = COALESCE(NULLIF(TRIM(v_raw_data->>'zone'), ''), zone),
            location = COALESCE(NULLIF(TRIM(v_raw_data->>'location'), ''), location),
            head_office_location = COALESCE(NULLIF(TRIM(v_raw_data->>'head_office_location'), ''), head_office_location),
            industry_type = COALESCE(NULLIF(TRIM(v_raw_data->>'industry_type'), ''), industry_type),
            sub_industry = COALESCE(NULLIF(TRIM(v_raw_data->>'sub_industry'), ''), sub_industry),
            emp_size = COALESCE(NULLIF(TRIM(v_raw_data->>'emp_size'), ''), emp_size),
            turnover = COALESCE(NULLIF(TRIM(v_raw_data->>'turnover'), ''), turnover),
            turnover_link = COALESCE(NULLIF(TRIM(v_raw_data->>'turnover_link'), ''), turnover_link),
            tier = COALESCE(NULLIF(TRIM(v_raw_data->>'tier'), ''), tier),
            erp_name = COALESCE(NULLIF(TRIM(v_raw_data->>'erp_name'), ''), erp_name),
            erp_vendor = COALESCE(NULLIF(TRIM(v_raw_data->>'erp_vendor'), ''), erp_vendor),
            job_level_updated = COALESCE(NULLIF(TRIM(v_raw_data->>'job_level_updated'), ''), job_level_updated),
            source = COALESCE(NULLIF(TRIM(v_raw_data->>'source'), ''), source),
            source_1 = COALESCE(NULLIF(TRIM(v_raw_data->>'source_1'), ''), source_1),
            activity_name = COALESCE(NULLIF(TRIM(v_raw_data->>'activity_name'), ''), activity_name),
            remarks = COALESCE(NULLIF(TRIM(v_raw_data->>'remarks'), ''), remarks),
            extra = COALESCE(NULLIF(TRIM(v_raw_data->>'extra'), ''), extra),
            extra_1 = COALESCE(NULLIF(TRIM(v_raw_data->>'extra_1'), ''), extra_1),
            extra_2 = COALESCE(NULLIF(TRIM(v_raw_data->>'extra_2'), ''), extra_2),
            assigned_to = CASE WHEN v_assigned_to_id IS NOT NULL THEN v_assigned_to_id ELSE assigned_to END,
            assigned_by = CASE WHEN v_assigned_to_id IS NOT NULL THEN p_user_id ELSE assigned_by END,
            assigned_at = CASE WHEN v_assigned_to_id IS NOT NULL THEN NOW() ELSE assigned_at END,
            assignment_status = CASE WHEN v_assigned_to_id IS NOT NULL THEN 'assigned' ELSE assignment_status END,
            updated_by = p_user_id,
            updated_at = NOW()
          WHERE id = v_existing_id;
          
          v_updated := v_updated + 1;
        ELSE
          -- Insert new record
          INSERT INTO demandcom (
            mobile_numb, name, salutation, company_name, designation, deppt,
            official, personal_email_id, generic_email_id, mobile2, linkedin,
            company_linkedin_url, associated_member_linkedin, website, address,
            city, state, pincode, country, zone, location, head_office_location,
            industry_type, sub_industry, emp_size, turnover, turnover_link, tier,
            erp_name, erp_vendor, job_level_updated, source, source_1, activity_name,
            remarks, extra, extra_1, extra_2,
            assigned_to, assigned_by, assigned_at, assignment_status,
            created_by, updated_by, created_at, updated_at
          ) VALUES (
            v_mobile,
            NULLIF(TRIM(v_raw_data->>'name'), ''),
            NULLIF(TRIM(v_raw_data->>'salutation'), ''),
            NULLIF(TRIM(v_raw_data->>'company_name'), ''),
            NULLIF(TRIM(v_raw_data->>'designation'), ''),
            NULLIF(TRIM(v_raw_data->>'deppt'), ''),
            NULLIF(TRIM(v_raw_data->>'official'), ''),
            NULLIF(TRIM(v_raw_data->>'personal_email_id'), ''),
            NULLIF(TRIM(v_raw_data->>'generic_email_id'), ''),
            NULLIF(TRIM(v_raw_data->>'mobile2'), ''),
            NULLIF(TRIM(v_raw_data->>'linkedin'), ''),
            NULLIF(TRIM(v_raw_data->>'company_linkedin_url'), ''),
            NULLIF(TRIM(v_raw_data->>'associated_member_linkedin'), ''),
            NULLIF(TRIM(v_raw_data->>'website'), ''),
            NULLIF(TRIM(v_raw_data->>'address'), ''),
            NULLIF(TRIM(v_raw_data->>'city'), ''),
            NULLIF(TRIM(v_raw_data->>'state'), ''),
            NULLIF(TRIM(v_raw_data->>'pincode'), ''),
            NULLIF(TRIM(v_raw_data->>'country'), ''),
            NULLIF(TRIM(v_raw_data->>'zone'), ''),
            NULLIF(TRIM(v_raw_data->>'location'), ''),
            NULLIF(TRIM(v_raw_data->>'head_office_location'), ''),
            NULLIF(TRIM(v_raw_data->>'industry_type'), ''),
            NULLIF(TRIM(v_raw_data->>'sub_industry'), ''),
            NULLIF(TRIM(v_raw_data->>'emp_size'), ''),
            NULLIF(TRIM(v_raw_data->>'turnover'), ''),
            NULLIF(TRIM(v_raw_data->>'turnover_link'), ''),
            NULLIF(TRIM(v_raw_data->>'tier'), ''),
            NULLIF(TRIM(v_raw_data->>'erp_name'), ''),
            NULLIF(TRIM(v_raw_data->>'erp_vendor'), ''),
            NULLIF(TRIM(v_raw_data->>'job_level_updated'), ''),
            NULLIF(TRIM(v_raw_data->>'source'), ''),
            NULLIF(TRIM(v_raw_data->>'source_1'), ''),
            NULLIF(TRIM(v_raw_data->>'activity_name'), ''),
            NULLIF(TRIM(v_raw_data->>'remarks'), ''),
            NULLIF(TRIM(v_raw_data->>'extra'), ''),
            NULLIF(TRIM(v_raw_data->>'extra_1'), ''),
            NULLIF(TRIM(v_raw_data->>'extra_2'), ''),
            v_assigned_to_id,
            CASE WHEN v_assigned_to_id IS NOT NULL THEN p_user_id ELSE NULL END,
            CASE WHEN v_assigned_to_id IS NOT NULL THEN NOW() ELSE NULL END,
            CASE WHEN v_assigned_to_id IS NOT NULL THEN 'assigned' ELSE 'unassigned' END,
            p_user_id,
            p_user_id,
            NOW(),
            NOW()
          );
          
          v_inserted := v_inserted + 1;
        END IF;
        
      ELSIF p_table_name = 'master' THEN
        -- Check if record exists
        SELECT id INTO v_existing_id
        FROM master
        WHERE mobile_numb = v_mobile
        LIMIT 1;
        
        IF v_existing_id IS NOT NULL THEN
          -- Update existing record with ALL fields (same as demandcom)
          UPDATE master SET
            name = COALESCE(NULLIF(TRIM(v_raw_data->>'name'), ''), name),
            salutation = COALESCE(NULLIF(TRIM(v_raw_data->>'salutation'), ''), salutation),
            company_name = COALESCE(NULLIF(TRIM(v_raw_data->>'company_name'), ''), company_name),
            designation = COALESCE(NULLIF(TRIM(v_raw_data->>'designation'), ''), designation),
            deppt = COALESCE(NULLIF(TRIM(v_raw_data->>'deppt'), ''), deppt),
            official = COALESCE(NULLIF(TRIM(v_raw_data->>'official'), ''), official),
            personal_email_id = COALESCE(NULLIF(TRIM(v_raw_data->>'personal_email_id'), ''), personal_email_id),
            generic_email_id = COALESCE(NULLIF(TRIM(v_raw_data->>'generic_email_id'), ''), generic_email_id),
            mobile2 = COALESCE(NULLIF(TRIM(v_raw_data->>'mobile2'), ''), mobile2),
            linkedin = COALESCE(NULLIF(TRIM(v_raw_data->>'linkedin'), ''), linkedin),
            company_linkedin_url = COALESCE(NULLIF(TRIM(v_raw_data->>'company_linkedin_url'), ''), company_linkedin_url),
            associated_member_linkedin = COALESCE(NULLIF(TRIM(v_raw_data->>'associated_member_linkedin'), ''), associated_member_linkedin),
            website = COALESCE(NULLIF(TRIM(v_raw_data->>'website'), ''), website),
            address = COALESCE(NULLIF(TRIM(v_raw_data->>'address'), ''), address),
            city = COALESCE(NULLIF(TRIM(v_raw_data->>'city'), ''), city),
            state = COALESCE(NULLIF(TRIM(v_raw_data->>'state'), ''), state),
            pincode = COALESCE(NULLIF(TRIM(v_raw_data->>'pincode'), ''), pincode),
            country = COALESCE(NULLIF(TRIM(v_raw_data->>'country'), ''), country),
            zone = COALESCE(NULLIF(TRIM(v_raw_data->>'zone'), ''), zone),
            location = COALESCE(NULLIF(TRIM(v_raw_data->>'location'), ''), location),
            head_office_location = COALESCE(NULLIF(TRIM(v_raw_data->>'head_office_location'), ''), head_office_location),
            industry_type = COALESCE(NULLIF(TRIM(v_raw_data->>'industry_type'), ''), industry_type),
            sub_industry = COALESCE(NULLIF(TRIM(v_raw_data->>'sub_industry'), ''), sub_industry),
            emp_size = COALESCE(NULLIF(TRIM(v_raw_data->>'emp_size'), ''), emp_size),
            turnover = COALESCE(NULLIF(TRIM(v_raw_data->>'turnover'), ''), turnover),
            turnover_link = COALESCE(NULLIF(TRIM(v_raw_data->>'turnover_link'), ''), turnover_link),
            tier = COALESCE(NULLIF(TRIM(v_raw_data->>'tier'), ''), tier),
            erp_name = COALESCE(NULLIF(TRIM(v_raw_data->>'erp_name'), ''), erp_name),
            erp_vendor = COALESCE(NULLIF(TRIM(v_raw_data->>'erp_vendor'), ''), erp_vendor),
            job_level_updated = COALESCE(NULLIF(TRIM(v_raw_data->>'job_level_updated'), ''), job_level_updated),
            source = COALESCE(NULLIF(TRIM(v_raw_data->>'source'), ''), source),
            source_1 = COALESCE(NULLIF(TRIM(v_raw_data->>'source_1'), ''), source_1),
            activity_name = COALESCE(NULLIF(TRIM(v_raw_data->>'activity_name'), ''), activity_name),
            remarks = COALESCE(NULLIF(TRIM(v_raw_data->>'remarks'), ''), remarks),
            extra = COALESCE(NULLIF(TRIM(v_raw_data->>'extra'), ''), extra),
            extra_1 = COALESCE(NULLIF(TRIM(v_raw_data->>'extra_1'), ''), extra_1),
            extra_2 = COALESCE(NULLIF(TRIM(v_raw_data->>'extra_2'), ''), extra_2),
            assigned_to = CASE WHEN v_assigned_to_id IS NOT NULL THEN v_assigned_to_id ELSE assigned_to END,
            assigned_by = CASE WHEN v_assigned_to_id IS NOT NULL THEN p_user_id ELSE assigned_by END,
            assigned_at = CASE WHEN v_assigned_to_id IS NOT NULL THEN NOW() ELSE assigned_at END,
            assignment_status = CASE WHEN v_assigned_to_id IS NOT NULL THEN 'assigned' ELSE assignment_status END,
            updated_by = p_user_id,
            updated_at = NOW()
          WHERE id = v_existing_id;
          
          v_updated := v_updated + 1;
        ELSE
          -- Insert new record with ALL fields (same as demandcom)
          INSERT INTO master (
            mobile_numb, name, salutation, company_name, designation, deppt,
            official, personal_email_id, generic_email_id, mobile2, linkedin,
            company_linkedin_url, associated_member_linkedin, website, address,
            city, state, pincode, country, zone, location, head_office_location,
            industry_type, sub_industry, emp_size, turnover, turnover_link, tier,
            erp_name, erp_vendor, job_level_updated, source, source_1, activity_name,
            remarks, extra, extra_1, extra_2,
            assigned_to, assigned_by, assigned_at, assignment_status,
            created_by, updated_by, created_at, updated_at
          ) VALUES (
            v_mobile,
            NULLIF(TRIM(v_raw_data->>'name'), ''),
            NULLIF(TRIM(v_raw_data->>'salutation'), ''),
            NULLIF(TRIM(v_raw_data->>'company_name'), ''),
            NULLIF(TRIM(v_raw_data->>'designation'), ''),
            NULLIF(TRIM(v_raw_data->>'deppt'), ''),
            NULLIF(TRIM(v_raw_data->>'official'), ''),
            NULLIF(TRIM(v_raw_data->>'personal_email_id'), ''),
            NULLIF(TRIM(v_raw_data->>'generic_email_id'), ''),
            NULLIF(TRIM(v_raw_data->>'mobile2'), ''),
            NULLIF(TRIM(v_raw_data->>'linkedin'), ''),
            NULLIF(TRIM(v_raw_data->>'company_linkedin_url'), ''),
            NULLIF(TRIM(v_raw_data->>'associated_member_linkedin'), ''),
            NULLIF(TRIM(v_raw_data->>'website'), ''),
            NULLIF(TRIM(v_raw_data->>'address'), ''),
            NULLIF(TRIM(v_raw_data->>'city'), ''),
            NULLIF(TRIM(v_raw_data->>'state'), ''),
            NULLIF(TRIM(v_raw_data->>'pincode'), ''),
            NULLIF(TRIM(v_raw_data->>'country'), ''),
            NULLIF(TRIM(v_raw_data->>'zone'), ''),
            NULLIF(TRIM(v_raw_data->>'location'), ''),
            NULLIF(TRIM(v_raw_data->>'head_office_location'), ''),
            NULLIF(TRIM(v_raw_data->>'industry_type'), ''),
            NULLIF(TRIM(v_raw_data->>'sub_industry'), ''),
            NULLIF(TRIM(v_raw_data->>'emp_size'), ''),
            NULLIF(TRIM(v_raw_data->>'turnover'), ''),
            NULLIF(TRIM(v_raw_data->>'turnover_link'), ''),
            NULLIF(TRIM(v_raw_data->>'tier'), ''),
            NULLIF(TRIM(v_raw_data->>'erp_name'), ''),
            NULLIF(TRIM(v_raw_data->>'erp_vendor'), ''),
            NULLIF(TRIM(v_raw_data->>'job_level_updated'), ''),
            NULLIF(TRIM(v_raw_data->>'source'), ''),
            NULLIF(TRIM(v_raw_data->>'source_1'), ''),
            NULLIF(TRIM(v_raw_data->>'activity_name'), ''),
            NULLIF(TRIM(v_raw_data->>'remarks'), ''),
            NULLIF(TRIM(v_raw_data->>'extra'), ''),
            NULLIF(TRIM(v_raw_data->>'extra_1'), ''),
            NULLIF(TRIM(v_raw_data->>'extra_2'), ''),
            v_assigned_to_id,
            CASE WHEN v_assigned_to_id IS NOT NULL THEN p_user_id ELSE NULL END,
            CASE WHEN v_assigned_to_id IS NOT NULL THEN NOW() ELSE NULL END,
            CASE WHEN v_assigned_to_id IS NOT NULL THEN 'assigned' ELSE 'unassigned' END,
            p_user_id,
            p_user_id,
            NOW(),
            NOW()
          );
          
          v_inserted := v_inserted + 1;
        END IF;
      END IF;
      
      -- Mark staging record as processed
      UPDATE import_staging
      SET processed = true
      WHERE id = v_staging_record.id;
      
      v_processed := v_processed + 1;
      
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      v_errors := v_errors || jsonb_build_object(
        'row', v_staging_record.row_number,
        'error', SQLERRM
      );
      
      UPDATE import_staging
      SET processed = true, error_message = SQLERRM
      WHERE id = v_staging_record.id;
    END;
  END LOOP;
  
  RETURN jsonb_build_object(
    'processed', v_processed,
    'inserted', v_inserted,
    'updated', v_updated,
    'failed', v_failed,
    'errors', v_errors
  );
END;
$$;