-- Add import_id column to demandcom and master for reliable revert tracking
ALTER TABLE demandcom ADD COLUMN IF NOT EXISTS import_id UUID REFERENCES bulk_import_history(id);
ALTER TABLE master ADD COLUMN IF NOT EXISTS import_id UUID REFERENCES bulk_import_history(id);

-- Create index for fast revert lookups
CREATE INDEX IF NOT EXISTS idx_demandcom_import_id ON demandcom(import_id) WHERE import_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_master_import_id ON master(import_id) WHERE import_id IS NOT NULL;

-- Update process_bulk_import_batch to set import_id on each inserted record
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
  v_new_record_id uuid;
  v_assigned_to_id uuid;
  v_assigned_to_email text;
BEGIN
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

      v_assigned_to_id := NULL;
      v_assigned_to_email := TRIM(v_raw_data->>'assigned_to');
      IF v_assigned_to_email IS NOT NULL AND v_assigned_to_email != '' THEN
        SELECT id INTO v_assigned_to_id
        FROM profiles
        WHERE LOWER(email) = LOWER(v_assigned_to_email)
        LIMIT 1;
      END IF;

      IF p_table_name = 'demandcom' THEN
        INSERT INTO demandcom (
          import_id,
          mobile_numb, name, salutation, company_name, designation, deppt,
          official, personal_email_id, generic_email_id, mobile2, linkedin,
          company_linkedin_url, associated_member_linkedin, website, address,
          city, state, pincode, country, zone, location, head_office_location,
          industry_type, sub_industry, emp_size, turnover, turnover_link,
          tier, erp_name, erp_vendor, activity_name, source, source_1,
          job_level_updated, extra, extra_1, extra_2, remarks,
          latest_disposition, latest_subdisposition,
          assigned_to, assigned_by, assigned_at, assignment_status,
          created_by, user_id
        ) VALUES (
          p_import_id,
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
          NULLIF(TRIM(v_raw_data->>'activity_name'), ''),
          NULLIF(TRIM(v_raw_data->>'source'), ''),
          NULLIF(TRIM(v_raw_data->>'source_1'), ''),
          NULLIF(TRIM(v_raw_data->>'job_level_updated'), ''),
          NULLIF(TRIM(v_raw_data->>'extra'), ''),
          NULLIF(TRIM(v_raw_data->>'extra_1'), ''),
          NULLIF(TRIM(v_raw_data->>'extra_2'), ''),
          NULLIF(TRIM(v_raw_data->>'remarks'), ''),
          NULLIF(TRIM(v_raw_data->>'latest_disposition'), ''),
          NULLIF(TRIM(v_raw_data->>'latest_subdisposition'), ''),
          v_assigned_to_id,
          CASE WHEN v_assigned_to_id IS NOT NULL THEN p_user_id ELSE NULL END,
          CASE WHEN v_assigned_to_id IS NOT NULL THEN NOW() ELSE NULL END,
          CASE WHEN v_assigned_to_id IS NOT NULL THEN 'assigned' ELSE 'unassigned' END,
          p_user_id,
          p_user_id
        )
        RETURNING id INTO v_new_record_id;

        INSERT INTO bulk_import_records (import_id, record_id, table_name, row_number)
        VALUES (p_import_id, v_new_record_id, p_table_name, v_staging_record.row_number);

        v_inserted := v_inserted + 1;

      ELSIF p_table_name = 'master' THEN
        SELECT id INTO v_existing_id
        FROM master
        WHERE mobile_numb = v_mobile
        LIMIT 1;

        IF v_existing_id IS NOT NULL THEN
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
            activity_name = COALESCE(NULLIF(TRIM(v_raw_data->>'activity_name'), ''), activity_name),
            source = COALESCE(NULLIF(TRIM(v_raw_data->>'source'), ''), source),
            source_1 = COALESCE(NULLIF(TRIM(v_raw_data->>'source_1'), ''), source_1),
            job_level_updated = COALESCE(NULLIF(TRIM(v_raw_data->>'job_level_updated'), ''), job_level_updated),
            extra = COALESCE(NULLIF(TRIM(v_raw_data->>'extra'), ''), extra),
            extra_1 = COALESCE(NULLIF(TRIM(v_raw_data->>'extra_1'), ''), extra_1),
            extra_2 = COALESCE(NULLIF(TRIM(v_raw_data->>'extra_2'), ''), extra_2),
            remarks = COALESCE(NULLIF(TRIM(v_raw_data->>'remarks'), ''), remarks),
            updated_at = NOW(),
            updated_by = p_user_id
          WHERE id = v_existing_id;
          v_updated := v_updated + 1;
        ELSE
          INSERT INTO master (
            import_id,
            mobile_numb, name, salutation, company_name, designation, deppt,
            official, personal_email_id, generic_email_id, mobile2, linkedin,
            company_linkedin_url, associated_member_linkedin, website, address,
            city, state, pincode, country, zone, location, head_office_location,
            industry_type, sub_industry, emp_size, turnover, turnover_link,
            tier, erp_name, erp_vendor, activity_name, source, source_1,
            job_level_updated, extra, extra_1, extra_2, remarks,
            created_by
          ) VALUES (
            p_import_id,
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
            NULLIF(TRIM(v_raw_data->>'activity_name'), ''),
            NULLIF(TRIM(v_raw_data->>'source'), ''),
            NULLIF(TRIM(v_raw_data->>'source_1'), ''),
            NULLIF(TRIM(v_raw_data->>'job_level_updated'), ''),
            NULLIF(TRIM(v_raw_data->>'extra'), ''),
            NULLIF(TRIM(v_raw_data->>'extra_1'), ''),
            NULLIF(TRIM(v_raw_data->>'extra_2'), ''),
            NULLIF(TRIM(v_raw_data->>'remarks'), ''),
            p_user_id
          )
          RETURNING id INTO v_new_record_id;

          INSERT INTO bulk_import_records (import_id, record_id, table_name, row_number)
          VALUES (p_import_id, v_new_record_id, p_table_name, v_staging_record.row_number);

          v_inserted := v_inserted + 1;
        END IF;
      END IF;

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

-- Update revert_bulk_import to use import_id column as primary method
CREATE OR REPLACE FUNCTION public.revert_bulk_import(p_import_id UUID, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_table_name TEXT;
  v_can_revert BOOLEAN;
  v_deleted_count INTEGER := 0;
  v_tracking_count INTEGER;
BEGIN
  -- Verify ownership and can_revert status
  SELECT table_name, can_revert INTO v_table_name, v_can_revert
  FROM bulk_import_history
  WHERE id = p_import_id AND user_id = p_user_id;

  IF v_table_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Import not found or unauthorized');
  END IF;

  IF NOT v_can_revert THEN
    RETURN jsonb_build_object('success', false, 'error', 'Import already reverted');
  END IF;

  -- Strategy 1: Use import_id column directly on the target table (most reliable)
  EXECUTE format(
    'DELETE FROM %I WHERE import_id = $1',
    v_table_name
  ) USING p_import_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- Strategy 2: Fallback to bulk_import_records if import_id yielded nothing
  IF v_deleted_count = 0 THEN
    SELECT COUNT(*) INTO v_tracking_count
    FROM bulk_import_records WHERE import_id = p_import_id;

    IF v_tracking_count > 0 THEN
      EXECUTE format(
        'DELETE FROM %I WHERE id IN (SELECT record_id FROM bulk_import_records WHERE import_id = $1)',
        v_table_name
      ) USING p_import_id;
      GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    END IF;
  END IF;

  -- Clean up tracking records
  DELETE FROM bulk_import_records WHERE import_id = p_import_id;

  -- Mark import as reverted
  UPDATE bulk_import_history
  SET can_revert = false, reverted_at = NOW()
  WHERE id = p_import_id;

  RETURN jsonb_build_object('success', true, 'deleted', v_deleted_count);
END;
$$;
