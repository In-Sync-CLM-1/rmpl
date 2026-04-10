const https = require('https');

const SQL = `
DROP FUNCTION IF EXISTS assign_demandcom_records(UUID, UUID, UUID[], INT, INT, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT[]);

CREATE OR REPLACE FUNCTION assign_demandcom_records(
  p_assigned_to UUID,
  p_assigned_by UUID,
  p_record_ids UUID[] DEFAULT NULL,
  p_offset INT DEFAULT NULL,
  p_limit INT DEFAULT NULL,
  p_name_email TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_activity_name TEXT DEFAULT NULL,
  p_assigned_filter TEXT DEFAULT NULL,
  p_disposition TEXT[] DEFAULT NULL,
  p_subdisposition TEXT[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_count INT := 0;
  v_assignee_name TEXT;
  v_ids UUID[];
BEGIN
  -- Verify assignee
  SELECT full_name INTO v_assignee_name FROM profiles WHERE id = p_assigned_to;
  IF v_assignee_name IS NULL THEN
    RETURN jsonb_build_object('error', 'Invalid assignee user');
  END IF;

  -- Mode 1: Direct record IDs
  IF p_record_ids IS NOT NULL AND array_length(p_record_ids, 1) > 0 THEN
    UPDATE demandcom SET
      assigned_to = p_assigned_to,
      assigned_by = p_assigned_by,
      assigned_at = NOW(),
      assignment_status = 'assigned'
    WHERE id = ANY(p_record_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Mode 2: Batch with filters + offset/limit
  ELSIF p_offset IS NOT NULL AND p_limit IS NOT NULL THEN
    -- Build filtered ID list
    WITH filtered AS (
      SELECT id FROM demandcom
      WHERE
        (p_name_email IS NULL OR
          name ILIKE '%' || p_name_email || '%' OR
          personal_email_id ILIKE '%' || p_name_email || '%' OR
          generic_email_id ILIKE '%' || p_name_email || '%' OR
          mobile_numb ILIKE '%' || p_name_email || '%')
        AND (p_city IS NULL OR city ILIKE '%' || p_city || '%')
        AND (p_activity_name IS NULL OR activity_name ILIKE '%' || p_activity_name || '%')
        AND (p_assigned_filter IS NULL OR p_assigned_filter = 'all'
          OR (p_assigned_filter = 'unassigned' AND assigned_to IS NULL)
          OR (p_assigned_filter != 'unassigned' AND assigned_to = p_assigned_filter::UUID))
        AND (p_disposition IS NULL OR latest_disposition = ANY(p_disposition))
        AND (p_subdisposition IS NULL OR latest_subdisposition = ANY(p_subdisposition))
      ORDER BY created_at DESC, id DESC
      OFFSET p_offset LIMIT p_limit
    )
    SELECT array_agg(id) INTO v_ids FROM filtered;

    IF v_ids IS NOT NULL AND array_length(v_ids, 1) > 0 THEN
      UPDATE demandcom SET
        assigned_to = p_assigned_to,
        assigned_by = p_assigned_by,
        assigned_at = NOW(),
        assignment_status = 'assigned'
      WHERE id = ANY(v_ids);
      GET DIAGNOSTICS v_count = ROW_COUNT;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'successCount', v_count,
    'message', 'Successfully assigned ' || v_count || ' record(s) to ' || v_assignee_name,
    'assigneeName', v_assignee_name
  );
END;
$fn$;

GRANT EXECUTE ON FUNCTION assign_demandcom_records(UUID, UUID, UUID[], INT, INT, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT[]) TO authenticated;
`;

function managementQuery(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql });
    const options = {
      hostname: 'api.supabase.com',
      path: '/v1/projects/ltlvhmwrrsromwuiybwu/database/query',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer sbp_68e70c187e18c25ba82fc27a13585372ef8c7ad2',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('Creating assign_demandcom_records RPC...');
  const result = await managementQuery(SQL);
  console.log('Status:', result.status);
  if (result.status === 201 || result.status === 200) {
    console.log('Created successfully');
  } else {
    console.log('Error:', result.body.slice(0, 500));
  }
}

main().catch(console.error);
