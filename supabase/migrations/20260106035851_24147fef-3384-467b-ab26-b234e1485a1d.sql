-- Drop and recreate the process_bulk_import_batch function with UPSERT support for master table
CREATE OR REPLACE FUNCTION public.process_bulk_import_batch(
  p_import_id UUID,
  p_table_name TEXT,
  p_user_id UUID,
  p_batch_size INTEGER DEFAULT 500
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record RECORD;
  v_inserted INTEGER := 0;
  v_updated INTEGER := 0;
  v_failed INTEGER := 0;
  v_errors JSONB := '[]'::JSONB;
  v_raw_data JSONB;
  v_new_record_id UUID;
  v_existing_id UUID;
  v_processed_count INTEGER := 0;
BEGIN
  -- Process records from staging table
  FOR v_record IN 
    SELECT id, row_number, raw_data 
    FROM import_staging 
    WHERE import_id = p_import_id 
      AND processed = false 
    ORDER BY row_number 
    LIMIT p_batch_size
  LOOP
    v_raw_data := v_record.raw_data;
    v_processed_count := v_processed_count + 1;
    
    BEGIN
      IF p_table_name = 'demandcom' THEN
        -- Check if record exists by mobile_numb
        SELECT id INTO v_existing_id 
        FROM demandcom 
        WHERE mobile_numb = v_raw_data->>'mobile_numb' 
        LIMIT 1;
        
        IF v_existing_id IS NOT NULL THEN
          -- Update existing record
          UPDATE demandcom SET
            name = COALESCE(NULLIF(v_raw_data->>'name', ''), name),
            salutation = COALESCE(NULLIF(v_raw_data->>'salutation', ''), salutation),
            mobile2 = COALESCE(NULLIF(v_raw_data->>'mobile2', ''), mobile2),
            designation = COALESCE(NULLIF(v_raw_data->>'designation', ''), designation),
            deppt = COALESCE(NULLIF(v_raw_data->>'deppt', ''), deppt),
            company_name = COALESCE(NULLIF(v_raw_data->>'company_name', ''), company_name),
            industry_type = COALESCE(NULLIF(v_raw_data->>'industry_type', ''), industry_type),
            sub_industry = COALESCE(NULLIF(v_raw_data->>'sub_industry', ''), sub_industry),
            emp_size = COALESCE(NULLIF(v_raw_data->>'emp_size', ''), emp_size),
            turnover = COALESCE(NULLIF(v_raw_data->>'turnover', ''), turnover),
            official = COALESCE(NULLIF(v_raw_data->>'official', ''), official),
            personal_email_id = COALESCE(NULLIF(v_raw_data->>'personal_email_id', ''), personal_email_id),
            generic_email_id = COALESCE(NULLIF(v_raw_data->>'generic_email_id', ''), generic_email_id),
            address = COALESCE(NULLIF(v_raw_data->>'address', ''), address),
            city = COALESCE(NULLIF(v_raw_data->>'city', ''), city),
            state = COALESCE(NULLIF(v_raw_data->>'state', ''), state),
            pincode = COALESCE(NULLIF(v_raw_data->>'pincode', ''), pincode),
            zone = COALESCE(NULLIF(v_raw_data->>'zone', ''), zone),
            country = COALESCE(NULLIF(v_raw_data->>'country', ''), country),
            tier = COALESCE(NULLIF(v_raw_data->>'tier', ''), tier),
            location = COALESCE(NULLIF(v_raw_data->>'location', ''), location),
            head_office_location = COALESCE(NULLIF(v_raw_data->>'head_office_location', ''), head_office_location),
            linkedin = COALESCE(NULLIF(v_raw_data->>'linkedin', ''), linkedin),
            company_linkedin_url = COALESCE(NULLIF(v_raw_data->>'company_linkedin_url', ''), company_linkedin_url),
            associated_member_linkedin = COALESCE(NULLIF(v_raw_data->>'associated_member_linkedin', ''), associated_member_linkedin),
            website = COALESCE(NULLIF(v_raw_data->>'website', ''), website),
            erp_name = COALESCE(NULLIF(v_raw_data->>'erp_name', ''), erp_name),
            erp_vendor = COALESCE(NULLIF(v_raw_data->>'erp_vendor', ''), erp_vendor),
            turnover_link = COALESCE(NULLIF(v_raw_data->>'turnover_link', ''), turnover_link),
            job_level_updated = COALESCE(NULLIF(v_raw_data->>'job_level_updated', ''), job_level_updated),
            source = COALESCE(NULLIF(v_raw_data->>'source', ''), source),
            source_1 = COALESCE(NULLIF(v_raw_data->>'source_1', ''), source_1),
            extra = COALESCE(NULLIF(v_raw_data->>'extra', ''), extra),
            extra_1 = COALESCE(NULLIF(v_raw_data->>'extra_1', ''), extra_1),
            extra_2 = COALESCE(NULLIF(v_raw_data->>'extra_2', ''), extra_2),
            remarks = COALESCE(NULLIF(v_raw_data->>'remarks', ''), remarks),
            activity_name = COALESCE(NULLIF(v_raw_data->>'activity_name', ''), activity_name),
            updated_at = NOW(),
            updated_by = p_user_id
          WHERE id = v_existing_id;
          
          v_new_record_id := v_existing_id;
          v_updated := v_updated + 1;
        ELSE
          -- Insert new record
          INSERT INTO demandcom (
            name, salutation, mobile_numb, mobile2, designation, deppt,
            company_name, industry_type, sub_industry, emp_size, turnover,
            official, personal_email_id, generic_email_id, address, city,
            state, pincode, zone, country, tier, location, head_office_location,
            linkedin, company_linkedin_url, associated_member_linkedin, website,
            erp_name, erp_vendor, turnover_link, job_level_updated,
            source, source_1, extra, extra_1, extra_2, remarks, activity_name,
            created_by, created_at, updated_at
          ) VALUES (
            NULLIF(v_raw_data->>'name', ''),
            NULLIF(v_raw_data->>'salutation', ''),
            NULLIF(v_raw_data->>'mobile_numb', ''),
            NULLIF(v_raw_data->>'mobile2', ''),
            NULLIF(v_raw_data->>'designation', ''),
            NULLIF(v_raw_data->>'deppt', ''),
            NULLIF(v_raw_data->>'company_name', ''),
            NULLIF(v_raw_data->>'industry_type', ''),
            NULLIF(v_raw_data->>'sub_industry', ''),
            NULLIF(v_raw_data->>'emp_size', ''),
            NULLIF(v_raw_data->>'turnover', ''),
            NULLIF(v_raw_data->>'official', ''),
            NULLIF(v_raw_data->>'personal_email_id', ''),
            NULLIF(v_raw_data->>'generic_email_id', ''),
            NULLIF(v_raw_data->>'address', ''),
            NULLIF(v_raw_data->>'city', ''),
            NULLIF(v_raw_data->>'state', ''),
            NULLIF(v_raw_data->>'pincode', ''),
            NULLIF(v_raw_data->>'zone', ''),
            NULLIF(v_raw_data->>'country', ''),
            NULLIF(v_raw_data->>'tier', ''),
            NULLIF(v_raw_data->>'location', ''),
            NULLIF(v_raw_data->>'head_office_location', ''),
            NULLIF(v_raw_data->>'linkedin', ''),
            NULLIF(v_raw_data->>'company_linkedin_url', ''),
            NULLIF(v_raw_data->>'associated_member_linkedin', ''),
            NULLIF(v_raw_data->>'website', ''),
            NULLIF(v_raw_data->>'erp_name', ''),
            NULLIF(v_raw_data->>'erp_vendor', ''),
            NULLIF(v_raw_data->>'turnover_link', ''),
            NULLIF(v_raw_data->>'job_level_updated', ''),
            NULLIF(v_raw_data->>'source', ''),
            NULLIF(v_raw_data->>'source_1', ''),
            NULLIF(v_raw_data->>'extra', ''),
            NULLIF(v_raw_data->>'extra_1', ''),
            NULLIF(v_raw_data->>'extra_2', ''),
            NULLIF(v_raw_data->>'remarks', ''),
            NULLIF(v_raw_data->>'activity_name', ''),
            p_user_id,
            NOW(),
            NOW()
          )
          RETURNING id INTO v_new_record_id;
          
          v_inserted := v_inserted + 1;
        END IF;
        
      ELSIF p_table_name = 'master' THEN
        -- Check if record exists by mobile_numb
        SELECT id INTO v_existing_id 
        FROM master 
        WHERE mobile_numb = v_raw_data->>'mobile_numb' 
        LIMIT 1;
        
        IF v_existing_id IS NOT NULL THEN
          -- Update existing record with non-empty values only
          UPDATE master SET
            name = COALESCE(NULLIF(v_raw_data->>'name', ''), name),
            salutation = COALESCE(NULLIF(v_raw_data->>'salutation', ''), salutation),
            mobile2 = COALESCE(NULLIF(v_raw_data->>'mobile2', ''), mobile2),
            designation = COALESCE(NULLIF(v_raw_data->>'designation', ''), designation),
            deppt = COALESCE(NULLIF(v_raw_data->>'deppt', ''), deppt),
            company_name = COALESCE(NULLIF(v_raw_data->>'company_name', ''), company_name),
            industry_type = COALESCE(NULLIF(v_raw_data->>'industry_type', ''), industry_type),
            sub_industry = COALESCE(NULLIF(v_raw_data->>'sub_industry', ''), sub_industry),
            emp_size = COALESCE(NULLIF(v_raw_data->>'emp_size', ''), emp_size),
            turnover = COALESCE(NULLIF(v_raw_data->>'turnover', ''), turnover),
            official = COALESCE(NULLIF(v_raw_data->>'official', ''), official),
            personal_email_id = COALESCE(NULLIF(v_raw_data->>'personal_email_id', ''), personal_email_id),
            generic_email_id = COALESCE(NULLIF(v_raw_data->>'generic_email_id', ''), generic_email_id),
            address = COALESCE(NULLIF(v_raw_data->>'address', ''), address),
            city = COALESCE(NULLIF(v_raw_data->>'city', ''), city),
            state = COALESCE(NULLIF(v_raw_data->>'state', ''), state),
            pincode = COALESCE(NULLIF(v_raw_data->>'pincode', ''), pincode),
            zone = COALESCE(NULLIF(v_raw_data->>'zone', ''), zone),
            country = COALESCE(NULLIF(v_raw_data->>'country', ''), country),
            tier = COALESCE(NULLIF(v_raw_data->>'tier', ''), tier),
            location = COALESCE(NULLIF(v_raw_data->>'location', ''), location),
            head_office_location = COALESCE(NULLIF(v_raw_data->>'head_office_location', ''), head_office_location),
            linkedin = COALESCE(NULLIF(v_raw_data->>'linkedin', ''), linkedin),
            company_linkedin_url = COALESCE(NULLIF(v_raw_data->>'company_linkedin_url', ''), company_linkedin_url),
            associated_member_linkedin = COALESCE(NULLIF(v_raw_data->>'associated_member_linkedin', ''), associated_member_linkedin),
            website = COALESCE(NULLIF(v_raw_data->>'website', ''), website),
            erp_name = COALESCE(NULLIF(v_raw_data->>'erp_name', ''), erp_name),
            erp_vendor = COALESCE(NULLIF(v_raw_data->>'erp_vendor', ''), erp_vendor),
            turnover_link = COALESCE(NULLIF(v_raw_data->>'turnover_link', ''), turnover_link),
            job_level_updated = COALESCE(NULLIF(v_raw_data->>'job_level_updated', ''), job_level_updated),
            source = COALESCE(NULLIF(v_raw_data->>'source', ''), source),
            source_1 = COALESCE(NULLIF(v_raw_data->>'source_1', ''), source_1),
            extra = COALESCE(NULLIF(v_raw_data->>'extra', ''), extra),
            extra_1 = COALESCE(NULLIF(v_raw_data->>'extra_1', ''), extra_1),
            extra_2 = COALESCE(NULLIF(v_raw_data->>'extra_2', ''), extra_2),
            remarks = COALESCE(NULLIF(v_raw_data->>'remarks', ''), remarks),
            updated_at = NOW()
          WHERE id = v_existing_id;
          
          v_new_record_id := v_existing_id;
          v_updated := v_updated + 1;
        ELSE
          -- Insert new record
          INSERT INTO master (
            name, salutation, mobile_numb, mobile2, designation, deppt,
            company_name, industry_type, sub_industry, emp_size, turnover,
            official, personal_email_id, generic_email_id, address, city,
            state, pincode, zone, country, tier, location, head_office_location,
            linkedin, company_linkedin_url, associated_member_linkedin, website,
            erp_name, erp_vendor, turnover_link, job_level_updated,
            source, source_1, extra, extra_1, extra_2, remarks,
            created_by, created_at, updated_at
          ) VALUES (
            NULLIF(v_raw_data->>'name', ''),
            NULLIF(v_raw_data->>'salutation', ''),
            NULLIF(v_raw_data->>'mobile_numb', ''),
            NULLIF(v_raw_data->>'mobile2', ''),
            NULLIF(v_raw_data->>'designation', ''),
            NULLIF(v_raw_data->>'deppt', ''),
            NULLIF(v_raw_data->>'company_name', ''),
            NULLIF(v_raw_data->>'industry_type', ''),
            NULLIF(v_raw_data->>'sub_industry', ''),
            NULLIF(v_raw_data->>'emp_size', ''),
            NULLIF(v_raw_data->>'turnover', ''),
            NULLIF(v_raw_data->>'official', ''),
            NULLIF(v_raw_data->>'personal_email_id', ''),
            NULLIF(v_raw_data->>'generic_email_id', ''),
            NULLIF(v_raw_data->>'address', ''),
            NULLIF(v_raw_data->>'city', ''),
            NULLIF(v_raw_data->>'state', ''),
            NULLIF(v_raw_data->>'pincode', ''),
            NULLIF(v_raw_data->>'zone', ''),
            NULLIF(v_raw_data->>'country', ''),
            NULLIF(v_raw_data->>'tier', ''),
            NULLIF(v_raw_data->>'location', ''),
            NULLIF(v_raw_data->>'head_office_location', ''),
            NULLIF(v_raw_data->>'linkedin', ''),
            NULLIF(v_raw_data->>'company_linkedin_url', ''),
            NULLIF(v_raw_data->>'associated_member_linkedin', ''),
            NULLIF(v_raw_data->>'website', ''),
            NULLIF(v_raw_data->>'erp_name', ''),
            NULLIF(v_raw_data->>'erp_vendor', ''),
            NULLIF(v_raw_data->>'turnover_link', ''),
            NULLIF(v_raw_data->>'job_level_updated', ''),
            NULLIF(v_raw_data->>'source', ''),
            NULLIF(v_raw_data->>'source_1', ''),
            NULLIF(v_raw_data->>'extra', ''),
            NULLIF(v_raw_data->>'extra_1', ''),
            NULLIF(v_raw_data->>'extra_2', ''),
            NULLIF(v_raw_data->>'remarks', ''),
            p_user_id,
            NOW(),
            NOW()
          )
          RETURNING id INTO v_new_record_id;
          
          v_inserted := v_inserted + 1;
        END IF;
      END IF;
      
      -- Mark staging record as processed
      UPDATE import_staging 
      SET processed = true 
      WHERE id = v_record.id;
      
      -- Track the imported record for potential revert
      INSERT INTO bulk_import_records (import_id, table_name, record_id, row_number)
      VALUES (p_import_id, p_table_name, v_new_record_id, v_record.row_number);
      
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      v_errors := v_errors || jsonb_build_object(
        'row', v_record.row_number,
        'error', SQLERRM,
        'data', v_raw_data
      );
      
      -- Mark as processed but with error
      UPDATE import_staging 
      SET processed = true, error_message = SQLERRM 
      WHERE id = v_record.id;
    END;
  END LOOP;
  
  RETURN jsonb_build_object(
    'inserted', v_inserted,
    'updated', v_updated,
    'failed', v_failed,
    'processed', v_processed_count,
    'errors', v_errors
  );
END;
$$;

-- Clean up the stuck import job
DELETE FROM import_staging WHERE import_id = '24f33a53-994c-4093-9a40-457d5707fcef';

UPDATE bulk_import_history 
SET status = 'failed', 
    error_log = '[{"error": "Cleaned up - function did not support upsert"}]'::jsonb,
    completed_at = NOW()
WHERE id = '24f33a53-994c-4093-9a40-457d5707fcef';