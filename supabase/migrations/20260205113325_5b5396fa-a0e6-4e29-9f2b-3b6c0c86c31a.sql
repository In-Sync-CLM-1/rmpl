-- Fix activity deletion issue: Clean whitespace from activity names and update delete function

-- 1. Clean existing activity names with trailing/leading whitespace (including newlines)
UPDATE demandcom 
SET activity_name = TRIM(BOTH E'\n\r\t ' FROM activity_name)
WHERE activity_name IS NOT NULL 
  AND activity_name != TRIM(BOTH E'\n\r\t ' FROM activity_name);

-- 2. Update the delete function to use TRIM for matching
CREATE OR REPLACE FUNCTION delete_demandcom_by_activity_batch(
  p_activity_name TEXT,
  p_batch_size INT DEFAULT 5000
)
RETURNS TABLE(deleted_count BIGINT, has_more BOOLEAN) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count BIGINT;
  v_remaining BIGINT;
BEGIN
  -- Delete a batch of records using TRIM for matching
  WITH deleted AS (
    DELETE FROM demandcom
    WHERE id IN (
      SELECT id FROM demandcom
      WHERE TRIM(BOTH E'\n\r\t ' FROM activity_name) = TRIM(BOTH E'\n\r\t ' FROM p_activity_name)
      LIMIT p_batch_size
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted_count FROM deleted;

  -- Check if more records remain
  SELECT COUNT(*) INTO v_remaining
  FROM demandcom
  WHERE TRIM(BOTH E'\n\r\t ' FROM activity_name) = TRIM(BOTH E'\n\r\t ' FROM p_activity_name);

  RETURN QUERY SELECT v_deleted_count, (v_remaining > 0);
END;
$$;