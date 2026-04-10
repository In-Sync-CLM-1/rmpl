// Creates the get_csbd_member_projects RPC function
// Returns project-level credit details for a given CSBD target holder

const https = require('https');

const SUPABASE_URL = 'ltlvhmwrrsromwuiybwu.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0bHZobXdycnNyb213dWl5Ynd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzA3OTQ5NSwiZXhwIjoyMDg4NjU1NDk1fQ.paF1ggI8OkTCWGMZIE_qB6-c08F7QSDueLIie9yAk98';

const SQL = `
DROP FUNCTION IF EXISTS get_csbd_member_projects(UUID, INT);

CREATE OR REPLACE FUNCTION get_csbd_member_projects(p_user_id UUID, p_fiscal_year INT DEFAULT 2026)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_result JSONB;
  v_dilip   UUID := 'abf0cb30-d00d-46bd-af88-829381676010';
  v_mansi   UUID := '37623f10-3d6c-496f-a63e-3655609d604c';
  v_sainath  UUID := '8be5f43d-f954-4107-a12b-d240ebe3d7bf';
  v_geeta   UUID := '07b06fca-df81-48fc-8837-7ab513a1832e';
  v_suraj   UUID := '0cdc99e5-1129-4159-9619-a23ed97363f2';
  v_syed    UUID := '58c3d693-4569-4022-a101-7f5c7d25410d';
  v_niraj   UUID := '534e7e23-0148-44e3-8a0b-63e300f524cb';
  v_vikhyat UUID := '522d9cb4-ada4-45ea-896b-1c42381e231c';
  v_year_start DATE;
  v_current_month DATE;
BEGIN
  v_year_start := make_date(p_fiscal_year, 1, 1);
  v_current_month := date_trunc('month', CURRENT_DATE)::date;

  WITH
  holders AS (
    SELECT ct.user_id, ct.has_subordinates
    FROM csbd_targets ct
    WHERE ct.fiscal_year = p_fiscal_year AND ct.is_active = true
  ),
  holder_subs AS (
    SELECT h.user_id AS holder_id,
           unnest(get_all_subordinate_ids(h.user_id)) AS sub_id
    FROM holders h
    WHERE h.has_subordinates = true
  ),
  holder_map AS (
    SELECT user_id AS person_id, user_id AS holder_id
    FROM holders
    UNION ALL
    SELECT hs.sub_id AS person_id, hs.holder_id
    FROM holder_subs hs
    WHERE hs.sub_id NOT IN (SELECT user_id FROM holders)
  ),

  -- All qualifying projects with their holder mapping
  project_base AS (
    SELECT
      p.id AS project_id,
      p.project_number,
      COALESCE(p.client_id, '') AS client_name,
      p.project_owner,
      owner_profile.full_name AS executed_by,
      p.status,
      COALESCE(NULLIF(p.final_afactor, 0), p.expected_afactor, 0) / 100000.0 AS amount_lacs,
      COALESCE(pq_latest.invoice_date::timestamp, p.invoiced_closed_at, p.updated_at) AS effective_date,
      CASE
        WHEN pq_latest.invoice_date IS NOT NULL THEN 'invoice'
        WHEN p.invoiced_closed_at IS NOT NULL THEN 'invoiced_closed_at'
        ELSE 'updated_at'
      END AS date_source,
      hm.holder_id
    FROM projects p
    LEFT JOIN LATERAL (
      SELECT MAX(invoice_date) AS invoice_date
      FROM project_quotations
      WHERE project_id = p.id AND invoice_date IS NOT NULL
    ) pq_latest ON true
    INNER JOIN holder_map hm ON hm.person_id = p.project_owner
    LEFT JOIN profiles owner_profile ON owner_profile.id = p.project_owner
    WHERE p.status IN ('closed', 'invoiced')
      AND (p.final_afactor IS NOT NULL OR p.expected_afactor IS NOT NULL)
      AND date_trunc('month',
            COALESCE(pq_latest.invoice_date::timestamp, p.invoiced_closed_at, p.updated_at)
          ) >= v_year_start::timestamp
      AND date_trunc('month',
            COALESCE(pq_latest.invoice_date::timestamp, p.invoiced_closed_at, p.updated_at)
          ) <= v_current_month::timestamp
  ),

  -- Apply credit rules: produce (credit_to, project details, credit_pct, rule) rows
  project_credits AS (
    -- R1: Dilip & Mansi combined pool - 50% each
    SELECT v_dilip AS credit_to, pb.*,
           0.50 AS credit_pct,
           'R1: Dilip-Mansi pool 50%' AS rule_applied
    FROM project_base pb WHERE pb.holder_id IN (v_dilip, v_mansi)

    UNION ALL

    SELECT v_mansi AS credit_to, pb.*,
           0.50 AS credit_pct,
           'R1: Dilip-Mansi pool 50%' AS rule_applied
    FROM project_base pb WHERE pb.holder_id IN (v_dilip, v_mansi)

    UNION ALL

    -- R2a: Sainath gets 20% of HPE MSA from Geeta/Suraj/Syed
    SELECT v_sainath, pb.*,
           0.20,
           'R2: HPE MSA 20% to Sainath'
    FROM project_base pb
    WHERE pb.holder_id IN (v_geeta, v_suraj, v_syed)
      AND pb.client_name ILIKE '%HPE MSA%'

    UNION ALL

    -- R2b: Geeta/Suraj/Syed get 80% of their HPE MSA
    SELECT pb.holder_id, pb.*,
           0.80,
           'R2: HPE MSA 80% to owner'
    FROM project_base pb
    WHERE pb.holder_id IN (v_geeta, v_suraj, v_syed)
      AND pb.client_name ILIKE '%HPE MSA%'

    UNION ALL

    -- R3: Geeta/Suraj/Syed get 100% of non-HPE-MSA
    SELECT pb.holder_id, pb.*,
           1.00,
           'R3: Non-HPE-MSA 100%'
    FROM project_base pb
    WHERE pb.holder_id IN (v_geeta, v_suraj, v_syed)
      AND NOT (pb.client_name ILIKE '%HPE MSA%')

    UNION ALL

    -- R4: Sainath 100% of own team
    SELECT v_sainath, pb.*,
           1.00,
           'R4: Own team 100%'
    FROM project_base pb WHERE pb.holder_id = v_sainath

    UNION ALL

    -- R5: Vikhyat 100%
    SELECT v_vikhyat, pb.*,
           1.00,
           'R5: Vikhyat team 100%'
    FROM project_base pb WHERE pb.holder_id = v_vikhyat

    UNION ALL

    -- R6: Niraj 100%
    SELECT v_niraj, pb.*,
           1.00,
           'R6: Niraj team 100%'
    FROM project_base pb WHERE pb.holder_id = v_niraj
  )

  SELECT jsonb_agg(
    jsonb_build_object(
      'project_number', pc.project_number,
      'client_name', pc.client_name,
      'executed_by', pc.executed_by,
      'status', pc.status,
      'effective_date', to_char(pc.effective_date, 'YYYY-MM-DD'),
      'date_source', pc.date_source,
      'amount_lacs', ROUND(pc.amount_lacs::numeric, 2),
      'credit_pct', ROUND((pc.credit_pct * 100)::numeric, 0),
      'credit_amount', ROUND((pc.amount_lacs * pc.credit_pct)::numeric, 2),
      'rule_applied', pc.rule_applied
    ) ORDER BY pc.effective_date
  ) INTO v_result
  FROM project_credits pc
  WHERE pc.credit_to = p_user_id;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$fn$;

GRANT EXECUTE ON FUNCTION get_csbd_member_projects(UUID, INT) TO authenticated;
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
  console.log('Creating get_csbd_member_projects RPC function...');
  let result = await managementQuery(SQL);
  console.log('Management API:', result.status);

  if (result.status === 201 || result.status === 200) {
    console.log('Function created successfully');
    console.log(result.body.slice(0, 500));
  } else {
    console.log('Error:', result.body.slice(0, 500));
  }
}

main().catch(console.error);
