-- Create a safe read-only query executor for Voice BI
CREATE OR REPLACE FUNCTION execute_read_query(query_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
  clean_query text;
BEGIN
  -- Normalize the query
  clean_query := LOWER(TRIM(query_text));
  
  -- Security: Only allow SELECT statements
  IF NOT (clean_query LIKE 'select%' OR clean_query LIKE 'with%') THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;
  
  -- Block dangerous keywords
  IF clean_query ~ '(insert|update|delete|drop|truncate|alter|create|grant|revoke|execute|call)' THEN
    RAISE EXCEPTION 'Modification queries are not allowed';
  END IF;
  
  -- Execute and return as JSON
  EXECUTE 'SELECT jsonb_agg(row_to_json(t)) FROM (' || query_text || ') t' INTO result;
  
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION execute_read_query(text) TO authenticated;