-- ==============================================
-- CLEANUP: Delete stuck staging data and fix failed import
-- ==============================================

-- Delete orphaned staging records from failed imports
DELETE FROM import_staging WHERE import_id IN (
  SELECT id FROM bulk_import_history WHERE status IN ('processing', 'failed') 
  AND completed_at IS NULL AND updated_at < NOW() - INTERVAL '1 hour'
);

-- Mark stuck imports as failed
UPDATE bulk_import_history 
SET status = 'failed', 
    completed_at = NOW(),
    error_log = COALESCE(error_log, '[]'::jsonb) || '{"message": "Auto-failed due to timeout"}'::jsonb
WHERE status = 'processing' 
AND updated_at < NOW() - INTERVAL '1 hour';

-- ==============================================
-- Create import_batches table for tracking batch progress
-- ==============================================
CREATE TABLE IF NOT EXISTS import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID NOT NULL REFERENCES bulk_import_history(id) ON DELETE CASCADE,
  batch_number INTEGER NOT NULL,
  offset_start INTEGER NOT NULL,
  batch_size INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  records_processed INTEGER DEFAULT 0,
  records_inserted INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  error_details JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for efficient batch processing
CREATE INDEX IF NOT EXISTS idx_import_batches_import_pending ON import_batches(import_id, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_import_batches_import_id ON import_batches(import_id);

-- Enable RLS
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read import batches (for progress tracking)
CREATE POLICY "Users can view import batches" ON import_batches FOR SELECT TO authenticated
  USING (import_id IN (SELECT id FROM bulk_import_history WHERE user_id = auth.uid()));

-- ==============================================
-- Create set-based process_import_batch function for master table
-- ==============================================
CREATE OR REPLACE FUNCTION process_master_import_batch(p_batch_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '5min'
AS $$
DECLARE
  v_batch RECORD;
  v_import RECORD;
  v_inserted INTEGER := 0;
  v_updated INTEGER := 0;
  v_failed INTEGER := 0;
  v_start_row INTEGER;
  v_end_row INTEGER;
BEGIN
  -- Get batch details
  SELECT * INTO v_batch FROM import_batches WHERE id = p_batch_id;
  
  IF v_batch IS NULL THEN
    RETURN jsonb_build_object('error', 'Batch not found');
  END IF;

  -- Mark batch as processing
  UPDATE import_batches SET status = 'processing', started_at = NOW() WHERE id = p_batch_id;

  -- Get import details
  SELECT * INTO v_import FROM bulk_import_history WHERE id = v_batch.import_id;
  
  -- Calculate row range
  v_start_row := v_batch.offset_start + 1;
  v_end_row := v_batch.offset_start + v_batch.batch_size;

  -- BULK UPDATE: Update existing master records in one statement
  WITH updated_records AS (
    UPDATE master m
    SET 
      name = COALESCE(NULLIF(TRIM(s.raw_data->>'name'), ''), m.name),
      salutation = COALESCE(NULLIF(TRIM(s.raw_data->>'salutation'), ''), m.salutation),
      company_name = COALESCE(NULLIF(TRIM(s.raw_data->>'company_name'), ''), m.company_name),
      designation = COALESCE(NULLIF(TRIM(s.raw_data->>'designation'), ''), m.designation),
      deppt = COALESCE(NULLIF(TRIM(s.raw_data->>'deppt'), ''), m.deppt),
      official = COALESCE(NULLIF(TRIM(s.raw_data->>'official'), ''), m.official),
      personal_email_id = COALESCE(NULLIF(TRIM(s.raw_data->>'personal_email_id'), ''), m.personal_email_id),
      generic_email_id = COALESCE(NULLIF(TRIM(s.raw_data->>'generic_email_id'), ''), m.generic_email_id),
      mobile2 = COALESCE(NULLIF(TRIM(s.raw_data->>'mobile2'), ''), m.mobile2),
      linkedin = COALESCE(NULLIF(TRIM(s.raw_data->>'linkedin'), ''), m.linkedin),
      company_linkedin_url = COALESCE(NULLIF(TRIM(s.raw_data->>'company_linkedin_url'), ''), m.company_linkedin_url),
      associated_member_linkedin = COALESCE(NULLIF(TRIM(s.raw_data->>'associated_member_linkedin'), ''), m.associated_member_linkedin),
      website = COALESCE(NULLIF(TRIM(s.raw_data->>'website'), ''), m.website),
      address = COALESCE(NULLIF(TRIM(s.raw_data->>'address'), ''), m.address),
      city = COALESCE(NULLIF(TRIM(s.raw_data->>'city'), ''), m.city),
      state = COALESCE(NULLIF(TRIM(s.raw_data->>'state'), ''), m.state),
      pincode = COALESCE(NULLIF(TRIM(s.raw_data->>'pincode'), ''), m.pincode),
      country = COALESCE(NULLIF(TRIM(s.raw_data->>'country'), ''), m.country),
      zone = COALESCE(NULLIF(TRIM(s.raw_data->>'zone'), ''), m.zone),
      location = COALESCE(NULLIF(TRIM(s.raw_data->>'location'), ''), m.location),
      head_office_location = COALESCE(NULLIF(TRIM(s.raw_data->>'head_office_location'), ''), m.head_office_location),
      industry_type = COALESCE(NULLIF(TRIM(s.raw_data->>'industry_type'), ''), m.industry_type),
      sub_industry = COALESCE(NULLIF(TRIM(s.raw_data->>'sub_industry'), ''), m.sub_industry),
      emp_size = COALESCE(NULLIF(TRIM(s.raw_data->>'emp_size'), ''), m.emp_size),
      turnover = COALESCE(NULLIF(TRIM(s.raw_data->>'turnover'), ''), m.turnover),
      turnover_link = COALESCE(NULLIF(TRIM(s.raw_data->>'turnover_link'), ''), m.turnover_link),
      tier = COALESCE(NULLIF(TRIM(s.raw_data->>'tier'), ''), m.tier),
      erp_name = COALESCE(NULLIF(TRIM(s.raw_data->>'erp_name'), ''), m.erp_name),
      erp_vendor = COALESCE(NULLIF(TRIM(s.raw_data->>'erp_vendor'), ''), m.erp_vendor),
      activity_name = COALESCE(NULLIF(TRIM(s.raw_data->>'activity_name'), ''), m.activity_name),
      source = COALESCE(NULLIF(TRIM(s.raw_data->>'source'), ''), m.source),
      source_1 = COALESCE(NULLIF(TRIM(s.raw_data->>'source_1'), ''), m.source_1),
      job_level_updated = COALESCE(NULLIF(TRIM(s.raw_data->>'job_level_updated'), ''), m.job_level_updated),
      extra = COALESCE(NULLIF(TRIM(s.raw_data->>'extra'), ''), m.extra),
      extra_1 = COALESCE(NULLIF(TRIM(s.raw_data->>'extra_1'), ''), m.extra_1),
      extra_2 = COALESCE(NULLIF(TRIM(s.raw_data->>'extra_2'), ''), m.extra_2),
      remarks = COALESCE(NULLIF(TRIM(s.raw_data->>'remarks'), ''), m.remarks),
      updated_at = NOW()
    FROM import_staging s
    WHERE s.import_id = v_batch.import_id
      AND s.row_number BETWEEN v_start_row AND v_end_row
      AND s.processed = false
      AND TRIM(s.raw_data->>'mobile_numb') IS NOT NULL
      AND TRIM(s.raw_data->>'mobile_numb') != ''
      AND m.mobile_numb = TRIM(s.raw_data->>'mobile_numb')
    RETURNING m.id
  )
  SELECT COUNT(*) INTO v_updated FROM updated_records;

  -- BULK INSERT: Insert new records that don't exist in master
  WITH inserted_records AS (
    INSERT INTO master (
      mobile_numb, name, salutation, company_name, designation, deppt,
      official, personal_email_id, generic_email_id, mobile2, linkedin,
      company_linkedin_url, associated_member_linkedin, website, address,
      city, state, pincode, country, zone, location, head_office_location,
      industry_type, sub_industry, emp_size, turnover, turnover_link,
      tier, erp_name, erp_vendor, activity_name, source, source_1,
      job_level_updated, extra, extra_1, extra_2, remarks, created_at, updated_at
    )
    SELECT 
      TRIM(s.raw_data->>'mobile_numb'),
      TRIM(s.raw_data->>'name'),
      TRIM(s.raw_data->>'salutation'),
      TRIM(s.raw_data->>'company_name'),
      TRIM(s.raw_data->>'designation'),
      TRIM(s.raw_data->>'deppt'),
      TRIM(s.raw_data->>'official'),
      TRIM(s.raw_data->>'personal_email_id'),
      TRIM(s.raw_data->>'generic_email_id'),
      TRIM(s.raw_data->>'mobile2'),
      TRIM(s.raw_data->>'linkedin'),
      TRIM(s.raw_data->>'company_linkedin_url'),
      TRIM(s.raw_data->>'associated_member_linkedin'),
      TRIM(s.raw_data->>'website'),
      TRIM(s.raw_data->>'address'),
      TRIM(s.raw_data->>'city'),
      TRIM(s.raw_data->>'state'),
      TRIM(s.raw_data->>'pincode'),
      TRIM(s.raw_data->>'country'),
      TRIM(s.raw_data->>'zone'),
      TRIM(s.raw_data->>'location'),
      TRIM(s.raw_data->>'head_office_location'),
      TRIM(s.raw_data->>'industry_type'),
      TRIM(s.raw_data->>'sub_industry'),
      TRIM(s.raw_data->>'emp_size'),
      TRIM(s.raw_data->>'turnover'),
      TRIM(s.raw_data->>'turnover_link'),
      TRIM(s.raw_data->>'tier'),
      TRIM(s.raw_data->>'erp_name'),
      TRIM(s.raw_data->>'erp_vendor'),
      TRIM(s.raw_data->>'activity_name'),
      TRIM(s.raw_data->>'source'),
      TRIM(s.raw_data->>'source_1'),
      TRIM(s.raw_data->>'job_level_updated'),
      TRIM(s.raw_data->>'extra'),
      TRIM(s.raw_data->>'extra_1'),
      TRIM(s.raw_data->>'extra_2'),
      TRIM(s.raw_data->>'remarks'),
      NOW(),
      NOW()
    FROM import_staging s
    WHERE s.import_id = v_batch.import_id
      AND s.row_number BETWEEN v_start_row AND v_end_row
      AND s.processed = false
      AND TRIM(s.raw_data->>'mobile_numb') IS NOT NULL
      AND TRIM(s.raw_data->>'mobile_numb') != ''
      AND NOT EXISTS (
        SELECT 1 FROM master m WHERE m.mobile_numb = TRIM(s.raw_data->>'mobile_numb')
      )
    RETURNING id
  )
  SELECT COUNT(*) INTO v_inserted FROM inserted_records;

  -- Mark staging records as processed
  UPDATE import_staging 
  SET processed = true 
  WHERE import_id = v_batch.import_id 
    AND row_number BETWEEN v_start_row AND v_end_row;

  -- Update batch with results
  UPDATE import_batches 
  SET 
    status = 'completed',
    records_processed = v_inserted + v_updated,
    records_inserted = v_inserted,
    records_updated = v_updated,
    records_failed = v_failed,
    completed_at = NOW()
  WHERE id = p_batch_id;

  RETURN jsonb_build_object(
    'success', true,
    'inserted', v_inserted,
    'updated', v_updated,
    'failed', v_failed,
    'processed', v_inserted + v_updated
  );

EXCEPTION WHEN OTHERS THEN
  -- Mark batch as failed
  UPDATE import_batches 
  SET 
    status = 'failed',
    error_details = jsonb_build_array(jsonb_build_object('message', SQLERRM)),
    completed_at = NOW()
  WHERE id = p_batch_id;
  
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- ==============================================
-- Create function to update import progress from batches
-- ==============================================
CREATE OR REPLACE FUNCTION update_import_progress(p_import_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_inserted INTEGER;
  v_total_updated INTEGER;
  v_total_failed INTEGER;
  v_total_processed INTEGER;
  v_pending_batches INTEGER;
  v_failed_batches INTEGER;
  v_current_batch INTEGER;
BEGIN
  -- Aggregate stats from completed batches
  SELECT 
    COALESCE(SUM(records_inserted), 0),
    COALESCE(SUM(records_updated), 0),
    COALESCE(SUM(records_failed), 0),
    COALESCE(SUM(records_processed), 0),
    MAX(batch_number)
  INTO v_total_inserted, v_total_updated, v_total_failed, v_total_processed, v_current_batch
  FROM import_batches
  WHERE import_id = p_import_id
    AND status = 'completed';

  -- Count pending and failed batches
  SELECT COUNT(*) INTO v_pending_batches FROM import_batches 
  WHERE import_id = p_import_id AND status = 'pending';
  
  SELECT COUNT(*) INTO v_failed_batches FROM import_batches 
  WHERE import_id = p_import_id AND status = 'failed';

  -- Update import history
  UPDATE bulk_import_history
  SET 
    processed_records = v_total_processed,
    successful_records = v_total_inserted + v_total_updated,
    failed_records = v_total_failed,
    current_batch = COALESCE(v_current_batch, 0),
    updated_at = NOW()
  WHERE id = p_import_id;

END;
$$;