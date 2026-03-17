-- Remove all SMS-related tables and references from the platform

-- 1. Drop sms_templates table
DROP TABLE IF EXISTS public.sms_templates CASCADE;

-- 2. Drop inbound_sms table
DROP TABLE IF EXISTS public.inbound_sms CASCADE;

-- 3. Update campaigns type CHECK constraint to only allow 'email'
-- First drop the existing constraint if any, then add new one
DO $$
BEGIN
  -- Try to drop existing check constraint on type column
  ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_type_check;
  -- Add new constraint allowing only email
  ALTER TABLE campaigns ADD CONSTRAINT campaigns_type_check CHECK (type = 'email');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not update campaigns type constraint: %', SQLERRM;
END;
$$;

-- 4. Recreate the 3 PL/pgSQL functions without inbound_sms references

CREATE OR REPLACE FUNCTION delete_demandcom_by_activity_batch(
  p_activity_name TEXT,
  p_batch_size INT DEFAULT 5000
)
RETURNS TABLE(deleted_count BIGINT, has_more BOOLEAN) AS $$
DECLARE
  v_deleted_count BIGINT;
  v_remaining BIGINT;
  v_ids_to_delete UUID[];
BEGIN
  SELECT ARRAY_AGG(id) INTO v_ids_to_delete
  FROM (
    SELECT id FROM demandcom
    WHERE activity_name = p_activity_name
    LIMIT p_batch_size
  ) sub;

  IF v_ids_to_delete IS NULL OR array_length(v_ids_to_delete, 1) = 0 THEN
    deleted_count := 0;
    has_more := FALSE;
    RETURN NEXT;
    RETURN;
  END IF;

  DELETE FROM call_logs WHERE demandcom_id = ANY(v_ids_to_delete);
  DELETE FROM demandcom_pipeline WHERE demandcom_id = ANY(v_ids_to_delete);
  DELETE FROM demandcom_field_changes WHERE demandcom_id = ANY(v_ids_to_delete);
  DELETE FROM campaign_recipients WHERE demandcom_id = ANY(v_ids_to_delete);

  DELETE FROM demandcom WHERE id = ANY(v_ids_to_delete);

  v_deleted_count := array_length(v_ids_to_delete, 1);

  SELECT COUNT(*) INTO v_remaining
  FROM demandcom
  WHERE activity_name = p_activity_name
  LIMIT 1;

  deleted_count := v_deleted_count;
  has_more := v_remaining > 0;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION bulk_delete_demandcom_batch(
  p_record_ids UUID[],
  p_batch_size INT DEFAULT 5000,
  p_offset INT DEFAULT 0
)
RETURNS TABLE(deleted_count BIGINT, has_more BOOLEAN, next_offset INT) AS $$
DECLARE
  v_deleted_count BIGINT;
  v_ids_to_delete UUID[];
  v_total_ids INT;
BEGIN
  v_total_ids := array_length(p_record_ids, 1);

  IF v_total_ids IS NULL OR v_total_ids = 0 THEN
    deleted_count := 0;
    has_more := FALSE;
    next_offset := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  v_ids_to_delete := p_record_ids[p_offset + 1 : LEAST(p_offset + p_batch_size, v_total_ids)];

  IF array_length(v_ids_to_delete, 1) IS NULL OR array_length(v_ids_to_delete, 1) = 0 THEN
    deleted_count := 0;
    has_more := FALSE;
    next_offset := p_offset;
    RETURN NEXT;
    RETURN;
  END IF;

  DELETE FROM call_logs WHERE demandcom_id = ANY(v_ids_to_delete);
  DELETE FROM demandcom_pipeline WHERE demandcom_id = ANY(v_ids_to_delete);
  DELETE FROM demandcom_field_changes WHERE demandcom_id = ANY(v_ids_to_delete);
  DELETE FROM campaign_recipients WHERE demandcom_id = ANY(v_ids_to_delete);

  DELETE FROM demandcom WHERE id = ANY(v_ids_to_delete);

  v_deleted_count := array_length(v_ids_to_delete, 1);

  deleted_count := v_deleted_count;
  next_offset := p_offset + p_batch_size;
  has_more := next_offset < v_total_ids;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION clean_all_demandcom_batch(
  p_batch_size INT DEFAULT 5000
)
RETURNS TABLE(deleted_count BIGINT, has_more BOOLEAN) AS $$
DECLARE
  v_deleted_count BIGINT;
  v_remaining BIGINT;
  v_ids_to_delete UUID[];
BEGIN
  SELECT ARRAY_AGG(id) INTO v_ids_to_delete
  FROM (
    SELECT id FROM demandcom
    LIMIT p_batch_size
  ) sub;

  IF v_ids_to_delete IS NULL OR array_length(v_ids_to_delete, 1) = 0 THEN
    deleted_count := 0;
    has_more := FALSE;
    RETURN NEXT;
    RETURN;
  END IF;

  DELETE FROM call_logs WHERE demandcom_id = ANY(v_ids_to_delete);
  DELETE FROM demandcom_pipeline WHERE demandcom_id = ANY(v_ids_to_delete);
  DELETE FROM demandcom_field_changes WHERE demandcom_id = ANY(v_ids_to_delete);
  DELETE FROM campaign_recipients WHERE demandcom_id = ANY(v_ids_to_delete);

  DELETE FROM demandcom WHERE id = ANY(v_ids_to_delete);

  v_deleted_count := array_length(v_ids_to_delete, 1);

  SELECT COUNT(*) INTO v_remaining
  FROM demandcom
  LIMIT 1;

  deleted_count := v_deleted_count;
  has_more := v_remaining > 0;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
