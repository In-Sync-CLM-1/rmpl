-- Update the process_bulk_import_batch function to handle assigned_to field
CREATE OR REPLACE FUNCTION public.process_bulk_import_batch(
  p_import_id UUID,
  p_batch_number INTEGER,
  p_records JSONB,
  p_table_name TEXT,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record JSONB;
  v_inserted INTEGER := 0;
  v_updated INTEGER := 0;
  v_failed INTEGER := 0;
  v_errors JSONB := '[]'::jsonb;
  v_existing_id UUID;
  v_mobile TEXT;
  v_assigned_to_id UUID;
  v_assigned_to_email TEXT;
  v_import_status TEXT;
BEGIN
  -- Check if import was cancelled
  SELECT status INTO v_import_status FROM bulk_import_history WHERE id = p_import_id;
  IF v_import_status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Import was cancelled',
      'inserted', 0,
      'updated', 0,
      'failed', 0
    );
  END IF;

  -- Update import status to processing if first batch
  IF p_batch_number = 1 THEN
    UPDATE bulk_import_history 
    SET status = 'processing', current_batch = 1
    WHERE id = p_import_id;
  END IF;

  -- Process each record
  FOR v_record IN SELECT * FROM jsonb_array_elements(p_records)
  LOOP
    BEGIN
      IF p_table_name = 'demandcom' THEN
        -- Get mobile number for duplicate check
        v_mobile := TRIM(v_record->>'mobile_numb');
        
        -- Resolve assigned_to email to UUID
        v_assigned_to_id := NULL;
        v_assigned_to_email := TRIM(v_record->>'assigned_to');
        
        IF v_assigned_to_email IS NOT NULL AND v_assigned_to_email != '' THEN
          -- Check if it's already a UUID
          BEGIN
            v_assigned_to_id := v_assigned_to_email::UUID;
          EXCEPTION WHEN others THEN
            -- Not a UUID, try to look up by email
            SELECT id INTO v_assigned_to_id 
            FROM profiles 
            WHERE LOWER(email) = LOWER(v_assigned_to_email)
            LIMIT 1;
            
            IF v_assigned_to_id IS NULL THEN
              -- Log warning but continue processing
              v_errors := v_errors || jsonb_build_object(
                'row', v_record,
                'warning', 'User not found for assigned_to: ' || v_assigned_to_email
              );
            END IF;
          END;
        END IF;
        
        -- Check for existing record by mobile number
        IF v_mobile IS NOT NULL AND v_mobile != '' THEN
          SELECT id INTO v_existing_id 
          FROM demandcom 
          WHERE mobile_numb = v_mobile 
          LIMIT 1;
        ELSE
          v_existing_id := NULL;
        END IF;
        
        IF v_existing_id IS NOT NULL THEN
          -- Update existing record
          UPDATE demandcom SET
            name = COALESCE(NULLIF(TRIM(v_record->>'name'), ''), name),
            company_name = COALESCE(NULLIF(TRIM(v_record->>'company_name'), ''), company_name),
            designation = COALESCE(NULLIF(TRIM(v_record->>'designation'), ''), designation),
            deppt = COALESCE(NULLIF(TRIM(v_record->>'deppt'), ''), deppt),
            official = COALESCE(NULLIF(TRIM(v_record->>'official'), ''), official),
            personal_email_id = COALESCE(NULLIF(TRIM(v_record->>'personal_email_id'), ''), personal_email_id),
            generic_email_id = COALESCE(NULLIF(TRIM(v_record->>'generic_email_id'), ''), generic_email_id),
            mobile2 = COALESCE(NULLIF(TRIM(v_record->>'mobile2'), ''), mobile2),
            linkedin = COALESCE(NULLIF(TRIM(v_record->>'linkedin'), ''), linkedin),
            city = COALESCE(NULLIF(TRIM(v_record->>'city'), ''), city),
            state = COALESCE(NULLIF(TRIM(v_record->>'state'), ''), state),
            country = COALESCE(NULLIF(TRIM(v_record->>'country'), ''), country),
            pincode = COALESCE(NULLIF(TRIM(v_record->>'pincode'), ''), pincode),
            address = COALESCE(NULLIF(TRIM(v_record->>'address'), ''), address),
            zone = COALESCE(NULLIF(TRIM(v_record->>'zone'), ''), zone),
            location = COALESCE(NULLIF(TRIM(v_record->>'location'), ''), location),
            head_office_location = COALESCE(NULLIF(TRIM(v_record->>'head_office_location'), ''), head_office_location),
            industry_type = COALESCE(NULLIF(TRIM(v_record->>'industry_type'), ''), industry_type),
            sub_industry = COALESCE(NULLIF(TRIM(v_record->>'sub_industry'), ''), sub_industry),
            emp_size = COALESCE(NULLIF(TRIM(v_record->>'emp_size'), ''), emp_size),
            turnover = COALESCE(NULLIF(TRIM(v_record->>'turnover'), ''), turnover),
            turnover_link = COALESCE(NULLIF(TRIM(v_record->>'turnover_link'), ''), turnover_link),
            website = COALESCE(NULLIF(TRIM(v_record->>'website'), ''), website),
            company_linkedin_url = COALESCE(NULLIF(TRIM(v_record->>'company_linkedin_url'), ''), company_linkedin_url),
            associated_member_linkedin = COALESCE(NULLIF(TRIM(v_record->>'associated_member_linkedin'), ''), associated_member_linkedin),
            erp_name = COALESCE(NULLIF(TRIM(v_record->>'erp_name'), ''), erp_name),
            erp_vendor = COALESCE(NULLIF(TRIM(v_record->>'erp_vendor'), ''), erp_vendor),
            tier = COALESCE(NULLIF(TRIM(v_record->>'tier'), ''), tier),
            salutation = COALESCE(NULLIF(TRIM(v_record->>'salutation'), ''), salutation),
            job_level_updated = COALESCE(NULLIF(TRIM(v_record->>'job_level_updated'), ''), job_level_updated),
            source = COALESCE(NULLIF(TRIM(v_record->>'source'), ''), source),
            source_1 = COALESCE(NULLIF(TRIM(v_record->>'source_1'), ''), source_1),
            activity_name = COALESCE(NULLIF(TRIM(v_record->>'activity_name'), ''), activity_name),
            remarks = COALESCE(NULLIF(TRIM(v_record->>'remarks'), ''), remarks),
            extra = COALESCE(NULLIF(TRIM(v_record->>'extra'), ''), extra),
            extra_1 = COALESCE(NULLIF(TRIM(v_record->>'extra_1'), ''), extra_1),
            extra_2 = COALESCE(NULLIF(TRIM(v_record->>'extra_2'), ''), extra_2),
            -- Handle assigned_to - only update if we have a valid ID
            assigned_to = CASE WHEN v_assigned_to_id IS NOT NULL THEN v_assigned_to_id ELSE assigned_to END,
            assigned_by = CASE WHEN v_assigned_to_id IS NOT NULL THEN p_user_id ELSE assigned_by END,
            assigned_at = CASE WHEN v_assigned_to_id IS NOT NULL THEN NOW() ELSE assigned_at END,
            assignment_status = CASE WHEN v_assigned_to_id IS NOT NULL THEN 'assigned' ELSE assignment_status END,
            updated_at = NOW(),
            updated_by = p_user_id
          WHERE id = v_existing_id;
          
          v_updated := v_updated + 1;
        ELSE
          -- Insert new record
          INSERT INTO demandcom (
            name, company_name, designation, deppt, official, personal_email_id, generic_email_id,
            mobile_numb, mobile2, linkedin, city, state, country, pincode, address, zone, location,
            head_office_location, industry_type, sub_industry, emp_size, turnover, turnover_link,
            website, company_linkedin_url, associated_member_linkedin, erp_name, erp_vendor,
            tier, salutation, job_level_updated, source, source_1, activity_name, remarks,
            extra, extra_1, extra_2,
            assigned_to, assigned_by, assigned_at, assignment_status,
            created_by, created_at, updated_at
          ) VALUES (
            NULLIF(TRIM(v_record->>'name'), ''),
            NULLIF(TRIM(v_record->>'company_name'), ''),
            NULLIF(TRIM(v_record->>'designation'), ''),
            NULLIF(TRIM(v_record->>'deppt'), ''),
            NULLIF(TRIM(v_record->>'official'), ''),
            NULLIF(TRIM(v_record->>'personal_email_id'), ''),
            NULLIF(TRIM(v_record->>'generic_email_id'), ''),
            v_mobile,
            NULLIF(TRIM(v_record->>'mobile2'), ''),
            NULLIF(TRIM(v_record->>'linkedin'), ''),
            NULLIF(TRIM(v_record->>'city'), ''),
            NULLIF(TRIM(v_record->>'state'), ''),
            NULLIF(TRIM(v_record->>'country'), ''),
            NULLIF(TRIM(v_record->>'pincode'), ''),
            NULLIF(TRIM(v_record->>'address'), ''),
            NULLIF(TRIM(v_record->>'zone'), ''),
            NULLIF(TRIM(v_record->>'location'), ''),
            NULLIF(TRIM(v_record->>'head_office_location'), ''),
            NULLIF(TRIM(v_record->>'industry_type'), ''),
            NULLIF(TRIM(v_record->>'sub_industry'), ''),
            NULLIF(TRIM(v_record->>'emp_size'), ''),
            NULLIF(TRIM(v_record->>'turnover'), ''),
            NULLIF(TRIM(v_record->>'turnover_link'), ''),
            NULLIF(TRIM(v_record->>'website'), ''),
            NULLIF(TRIM(v_record->>'company_linkedin_url'), ''),
            NULLIF(TRIM(v_record->>'associated_member_linkedin'), ''),
            NULLIF(TRIM(v_record->>'erp_name'), ''),
            NULLIF(TRIM(v_record->>'erp_vendor'), ''),
            NULLIF(TRIM(v_record->>'tier'), ''),
            NULLIF(TRIM(v_record->>'salutation'), ''),
            NULLIF(TRIM(v_record->>'job_level_updated'), ''),
            NULLIF(TRIM(v_record->>'source'), ''),
            NULLIF(TRIM(v_record->>'source_1'), ''),
            NULLIF(TRIM(v_record->>'activity_name'), ''),
            NULLIF(TRIM(v_record->>'remarks'), ''),
            NULLIF(TRIM(v_record->>'extra'), ''),
            NULLIF(TRIM(v_record->>'extra_1'), ''),
            NULLIF(TRIM(v_record->>'extra_2'), ''),
            v_assigned_to_id,
            CASE WHEN v_assigned_to_id IS NOT NULL THEN p_user_id ELSE NULL END,
            CASE WHEN v_assigned_to_id IS NOT NULL THEN NOW() ELSE NULL END,
            CASE WHEN v_assigned_to_id IS NOT NULL THEN 'assigned' ELSE NULL END,
            p_user_id,
            NOW(),
            NOW()
          );
          
          v_inserted := v_inserted + 1;
        END IF;
        
      ELSIF p_table_name = 'master' THEN
        -- Get mobile number for duplicate check
        v_mobile := TRIM(v_record->>'mobile_numb');
        
        -- Check for existing record by mobile number
        IF v_mobile IS NOT NULL AND v_mobile != '' THEN
          SELECT id INTO v_existing_id 
          FROM master 
          WHERE mobile_numb = v_mobile 
          LIMIT 1;
        ELSE
          v_existing_id := NULL;
        END IF;
        
        IF v_existing_id IS NOT NULL THEN
          -- Update existing record
          UPDATE master SET
            name = COALESCE(NULLIF(TRIM(v_record->>'name'), ''), name),
            company_name = COALESCE(NULLIF(TRIM(v_record->>'company_name'), ''), company_name),
            designation = COALESCE(NULLIF(TRIM(v_record->>'designation'), ''), designation),
            deppt = COALESCE(NULLIF(TRIM(v_record->>'deppt'), ''), deppt),
            official = COALESCE(NULLIF(TRIM(v_record->>'official'), ''), official),
            personal_email_id = COALESCE(NULLIF(TRIM(v_record->>'personal_email_id'), ''), personal_email_id),
            generic_email_id = COALESCE(NULLIF(TRIM(v_record->>'generic_email_id'), ''), generic_email_id),
            mobile2 = COALESCE(NULLIF(TRIM(v_record->>'mobile2'), ''), mobile2),
            linkedin = COALESCE(NULLIF(TRIM(v_record->>'linkedin'), ''), linkedin),
            city = COALESCE(NULLIF(TRIM(v_record->>'city'), ''), city),
            state = COALESCE(NULLIF(TRIM(v_record->>'state'), ''), state),
            country = COALESCE(NULLIF(TRIM(v_record->>'country'), ''), country),
            pincode = COALESCE(NULLIF(TRIM(v_record->>'pincode'), ''), pincode),
            address = COALESCE(NULLIF(TRIM(v_record->>'address'), ''), address),
            zone = COALESCE(NULLIF(TRIM(v_record->>'zone'), ''), zone),
            location = COALESCE(NULLIF(TRIM(v_record->>'location'), ''), location),
            head_office_location = COALESCE(NULLIF(TRIM(v_record->>'head_office_location'), ''), head_office_location),
            industry_type = COALESCE(NULLIF(TRIM(v_record->>'industry_type'), ''), industry_type),
            sub_industry = COALESCE(NULLIF(TRIM(v_record->>'sub_industry'), ''), sub_industry),
            emp_size = COALESCE(NULLIF(TRIM(v_record->>'emp_size'), ''), emp_size),
            turnover = COALESCE(NULLIF(TRIM(v_record->>'turnover'), ''), turnover),
            turnover_link = COALESCE(NULLIF(TRIM(v_record->>'turnover_link'), ''), turnover_link),
            website = COALESCE(NULLIF(TRIM(v_record->>'website'), ''), website),
            company_linkedin_url = COALESCE(NULLIF(TRIM(v_record->>'company_linkedin_url'), ''), company_linkedin_url),
            associated_member_linkedin = COALESCE(NULLIF(TRIM(v_record->>'associated_member_linkedin'), ''), associated_member_linkedin),
            erp_name = COALESCE(NULLIF(TRIM(v_record->>'erp_name'), ''), erp_name),
            erp_vendor = COALESCE(NULLIF(TRIM(v_record->>'erp_vendor'), ''), erp_vendor),
            tier = COALESCE(NULLIF(TRIM(v_record->>'tier'), ''), tier),
            salutation = COALESCE(NULLIF(TRIM(v_record->>'salutation'), ''), salutation),
            job_level_updated = COALESCE(NULLIF(TRIM(v_record->>'job_level_updated'), ''), job_level_updated),
            source = COALESCE(NULLIF(TRIM(v_record->>'source'), ''), source),
            source_1 = COALESCE(NULLIF(TRIM(v_record->>'source_1'), ''), source_1),
            remarks = COALESCE(NULLIF(TRIM(v_record->>'remarks'), ''), remarks),
            extra = COALESCE(NULLIF(TRIM(v_record->>'extra'), ''), extra),
            extra_1 = COALESCE(NULLIF(TRIM(v_record->>'extra_1'), ''), extra_1),
            extra_2 = COALESCE(NULLIF(TRIM(v_record->>'extra_2'), ''), extra_2),
            updated_at = NOW()
          WHERE id = v_existing_id;
          
          v_updated := v_updated + 1;
        ELSE
          -- Insert new record
          INSERT INTO master (
            name, company_name, designation, deppt, official, personal_email_id, generic_email_id,
            mobile_numb, mobile2, linkedin, city, state, country, pincode, address, zone, location,
            head_office_location, industry_type, sub_industry, emp_size, turnover, turnover_link,
            website, company_linkedin_url, associated_member_linkedin, erp_name, erp_vendor,
            tier, salutation, job_level_updated, source, source_1, remarks,
            extra, extra_1, extra_2,
            created_by, created_at, updated_at
          ) VALUES (
            NULLIF(TRIM(v_record->>'name'), ''),
            NULLIF(TRIM(v_record->>'company_name'), ''),
            NULLIF(TRIM(v_record->>'designation'), ''),
            NULLIF(TRIM(v_record->>'deppt'), ''),
            NULLIF(TRIM(v_record->>'official'), ''),
            NULLIF(TRIM(v_record->>'personal_email_id'), ''),
            NULLIF(TRIM(v_record->>'generic_email_id'), ''),
            v_mobile,
            NULLIF(TRIM(v_record->>'mobile2'), ''),
            NULLIF(TRIM(v_record->>'linkedin'), ''),
            NULLIF(TRIM(v_record->>'city'), ''),
            NULLIF(TRIM(v_record->>'state'), ''),
            NULLIF(TRIM(v_record->>'country'), ''),
            NULLIF(TRIM(v_record->>'pincode'), ''),
            NULLIF(TRIM(v_record->>'address'), ''),
            NULLIF(TRIM(v_record->>'zone'), ''),
            NULLIF(TRIM(v_record->>'location'), ''),
            NULLIF(TRIM(v_record->>'head_office_location'), ''),
            NULLIF(TRIM(v_record->>'industry_type'), ''),
            NULLIF(TRIM(v_record->>'sub_industry'), ''),
            NULLIF(TRIM(v_record->>'emp_size'), ''),
            NULLIF(TRIM(v_record->>'turnover'), ''),
            NULLIF(TRIM(v_record->>'turnover_link'), ''),
            NULLIF(TRIM(v_record->>'website'), ''),
            NULLIF(TRIM(v_record->>'company_linkedin_url'), ''),
            NULLIF(TRIM(v_record->>'associated_member_linkedin'), ''),
            NULLIF(TRIM(v_record->>'erp_name'), ''),
            NULLIF(TRIM(v_record->>'erp_vendor'), ''),
            NULLIF(TRIM(v_record->>'tier'), ''),
            NULLIF(TRIM(v_record->>'salutation'), ''),
            NULLIF(TRIM(v_record->>'job_level_updated'), ''),
            NULLIF(TRIM(v_record->>'source'), ''),
            NULLIF(TRIM(v_record->>'source_1'), ''),
            NULLIF(TRIM(v_record->>'remarks'), ''),
            NULLIF(TRIM(v_record->>'extra'), ''),
            NULLIF(TRIM(v_record->>'extra_1'), ''),
            NULLIF(TRIM(v_record->>'extra_2'), ''),
            p_user_id,
            NOW(),
            NOW()
          );
          
          v_inserted := v_inserted + 1;
        END IF;
        
      ELSIF p_table_name = 'clients' THEN
        -- Insert client record
        INSERT INTO clients (
          company_name, contact_name, contact_number, email_id,
          official_address, residence_address, linkedin_id, company_linkedin_page,
          birthday_date, anniversary_date,
          created_by, created_at, updated_at
        ) VALUES (
          COALESCE(NULLIF(TRIM(v_record->>'company_name'), ''), 'Unknown'),
          COALESCE(NULLIF(TRIM(v_record->>'contact_name'), ''), 'Unknown'),
          NULLIF(TRIM(v_record->>'contact_number'), ''),
          NULLIF(TRIM(v_record->>'email_id'), ''),
          NULLIF(TRIM(v_record->>'official_address'), ''),
          NULLIF(TRIM(v_record->>'residence_address'), ''),
          NULLIF(TRIM(v_record->>'linkedin_id'), ''),
          NULLIF(TRIM(v_record->>'company_linkedin_page'), ''),
          NULLIF(TRIM(v_record->>'birthday_date'), '')::DATE,
          NULLIF(TRIM(v_record->>'anniversary_date'), '')::DATE,
          p_user_id,
          NOW(),
          NOW()
        );
        
        v_inserted := v_inserted + 1;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      v_errors := v_errors || jsonb_build_object(
        'row', v_record,
        'error', SQLERRM
      );
    END;
  END LOOP;

  -- Update import progress
  UPDATE bulk_import_history SET
    current_batch = p_batch_number,
    processed_records = COALESCE(processed_records, 0) + v_inserted + v_updated + v_failed,
    successful_records = COALESCE(successful_records, 0) + v_inserted + v_updated,
    failed_records = COALESCE(failed_records, 0) + v_failed,
    error_log = CASE 
      WHEN jsonb_array_length(v_errors) > 0 THEN 
        COALESCE(error_log, '[]'::jsonb) || v_errors 
      ELSE error_log 
    END,
    updated_at = NOW()
  WHERE id = p_import_id;

  RETURN jsonb_build_object(
    'success', true,
    'inserted', v_inserted,
    'updated', v_updated,
    'failed', v_failed,
    'errors', v_errors
  );
END;
$$;