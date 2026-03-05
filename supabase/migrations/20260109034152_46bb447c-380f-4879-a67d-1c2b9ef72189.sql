-- Create batched delete function for demandcom by activity name
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
  -- Get batch of IDs to delete
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
  
  -- Delete related records first (child tables)
  DELETE FROM call_logs WHERE demandcom_id = ANY(v_ids_to_delete);
  DELETE FROM demandcom_pipeline WHERE demandcom_id = ANY(v_ids_to_delete);
  DELETE FROM demandcom_field_changes WHERE demandcom_id = ANY(v_ids_to_delete);
  DELETE FROM campaign_recipients WHERE demandcom_id = ANY(v_ids_to_delete);
  DELETE FROM inbound_sms WHERE demandcom_id = ANY(v_ids_to_delete);
  
  -- Delete main records
  DELETE FROM demandcom WHERE id = ANY(v_ids_to_delete);
  
  v_deleted_count := array_length(v_ids_to_delete, 1);
  
  -- Check if more records remain
  SELECT COUNT(*) INTO v_remaining 
  FROM demandcom 
  WHERE activity_name = p_activity_name 
  LIMIT 1;
  
  deleted_count := v_deleted_count;
  has_more := v_remaining > 0;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create batched delete function for bulk demandcom by IDs
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
  
  -- Get batch of IDs from the array
  v_ids_to_delete := p_record_ids[p_offset + 1 : LEAST(p_offset + p_batch_size, v_total_ids)];
  
  IF array_length(v_ids_to_delete, 1) IS NULL OR array_length(v_ids_to_delete, 1) = 0 THEN
    deleted_count := 0;
    has_more := FALSE;
    next_offset := p_offset;
    RETURN NEXT;
    RETURN;
  END IF;
  
  -- Delete related records first (child tables)
  DELETE FROM call_logs WHERE demandcom_id = ANY(v_ids_to_delete);
  DELETE FROM demandcom_pipeline WHERE demandcom_id = ANY(v_ids_to_delete);
  DELETE FROM demandcom_field_changes WHERE demandcom_id = ANY(v_ids_to_delete);
  DELETE FROM campaign_recipients WHERE demandcom_id = ANY(v_ids_to_delete);
  DELETE FROM inbound_sms WHERE demandcom_id = ANY(v_ids_to_delete);
  
  -- Delete main records
  DELETE FROM demandcom WHERE id = ANY(v_ids_to_delete);
  
  v_deleted_count := array_length(v_ids_to_delete, 1);
  
  deleted_count := v_deleted_count;
  next_offset := p_offset + p_batch_size;
  has_more := next_offset < v_total_ids;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create batched clean all demandcom function
CREATE OR REPLACE FUNCTION clean_all_demandcom_batch(
  p_batch_size INT DEFAULT 5000
)
RETURNS TABLE(deleted_count BIGINT, has_more BOOLEAN) AS $$
DECLARE
  v_deleted_count BIGINT;
  v_remaining BIGINT;
  v_ids_to_delete UUID[];
BEGIN
  -- Get batch of IDs to delete
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
  
  -- Delete related records first (child tables)
  DELETE FROM call_logs WHERE demandcom_id = ANY(v_ids_to_delete);
  DELETE FROM demandcom_pipeline WHERE demandcom_id = ANY(v_ids_to_delete);
  DELETE FROM demandcom_field_changes WHERE demandcom_id = ANY(v_ids_to_delete);
  DELETE FROM campaign_recipients WHERE demandcom_id = ANY(v_ids_to_delete);
  DELETE FROM inbound_sms WHERE demandcom_id = ANY(v_ids_to_delete);
  
  -- Delete main records
  DELETE FROM demandcom WHERE id = ANY(v_ids_to_delete);
  
  v_deleted_count := array_length(v_ids_to_delete, 1);
  
  -- Check if more records remain
  SELECT COUNT(*) INTO v_remaining 
  FROM demandcom 
  LIMIT 1;
  
  deleted_count := v_deleted_count;
  has_more := v_remaining > 0;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create batched bulk delete clients function
CREATE OR REPLACE FUNCTION bulk_delete_clients_batch(
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
  
  -- Get batch of IDs from the array
  v_ids_to_delete := p_record_ids[p_offset + 1 : LEAST(p_offset + p_batch_size, v_total_ids)];
  
  IF array_length(v_ids_to_delete, 1) IS NULL OR array_length(v_ids_to_delete, 1) = 0 THEN
    deleted_count := 0;
    has_more := FALSE;
    next_offset := p_offset;
    RETURN NEXT;
    RETURN;
  END IF;
  
  -- Delete related records first (projects linked to clients)
  -- Note: Projects have client_id foreign key, so we need to handle them
  -- For now, we'll just delete clients directly (projects should be handled separately)
  
  -- Delete main records
  DELETE FROM clients WHERE id = ANY(v_ids_to_delete);
  
  v_deleted_count := array_length(v_ids_to_delete, 1);
  
  deleted_count := v_deleted_count;
  next_offset := p_offset + p_batch_size;
  has_more := next_offset < v_total_ids;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;