-- RPC to bulk assign clients (assigned_to or managed_by)
CREATE OR REPLACE FUNCTION assign_client_records(
  p_user_id UUID,
  p_assigned_by UUID,
  p_field TEXT DEFAULT 'assigned_to',
  p_record_ids UUID[] DEFAULT NULL,
  p_offset INT DEFAULT NULL,
  p_limit INT DEFAULT NULL,
  p_search TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ids UUID[];
  v_count INT;
  v_assignee_name TEXT;
BEGIN
  -- Get assignee name
  SELECT full_name INTO v_assignee_name FROM profiles WHERE id = p_user_id;

  -- Validate field
  IF p_field NOT IN ('assigned_to', 'managed_by') THEN
    RETURN jsonb_build_object('error', 'Invalid field. Must be assigned_to or managed_by');
  END IF;

  -- Mode 1: Direct record IDs
  IF p_record_ids IS NOT NULL AND array_length(p_record_ids, 1) > 0 THEN
    v_ids := p_record_ids;
  ELSE
    -- Mode 2: Filtered batch with offset/limit
    WITH filtered AS (
      SELECT id FROM clients
      WHERE (p_search IS NULL OR p_search = '' OR
        company_name ILIKE '%' || p_search || '%' OR
        branch ILIKE '%' || p_search || '%' OR
        industry ILIKE '%' || p_search || '%')
      ORDER BY created_at DESC, id DESC
      OFFSET COALESCE(p_offset, 0)
      LIMIT COALESCE(p_limit, 1000000)
    )
    SELECT array_agg(id) INTO v_ids FROM filtered;
  END IF;

  IF v_ids IS NULL OR array_length(v_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('successCount', 0, 'message', 'No records found to assign');
  END IF;

  -- Update based on field
  IF p_field = 'assigned_to' THEN
    UPDATE clients SET assigned_to = p_user_id WHERE id = ANY(v_ids);
  ELSE
    UPDATE clients SET managed_by = p_user_id WHERE id = ANY(v_ids);
  END IF;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'successCount', v_count,
    'message', format('Successfully assigned %s client(s) to %s', v_count, v_assignee_name),
    'assigneeName', v_assignee_name
  );
END;
$$;
