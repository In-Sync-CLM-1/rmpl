CREATE OR REPLACE FUNCTION public.revert_bulk_import(p_import_id UUID, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_table_name TEXT;
  v_can_revert BOOLEAN;
  v_deleted_count INTEGER;
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
  
  -- Delete all records using dynamic SQL (single operation, no limits!)
  EXECUTE format(
    'DELETE FROM %I WHERE id IN (SELECT record_id FROM bulk_import_records WHERE import_id = $1)',
    v_table_name
  ) USING p_import_id;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  -- Mark import as reverted
  UPDATE bulk_import_history
  SET can_revert = false, reverted_at = NOW()
  WHERE id = p_import_id;
  
  RETURN jsonb_build_object('success', true, 'deleted', v_deleted_count);
END;
$$;