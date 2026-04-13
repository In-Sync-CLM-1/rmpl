// Creates the get_csbd_dashboard RPC function in PostgreSQL
// This replaces the calculate-csbd-metrics edge function

const https = require('https');

const SUPABASE_URL = 'ltlvhmwrrsromwuiybwu.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0bHZobXdycnNyb213dWl5Ynd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzA3OTQ5NSwiZXhwIjoyMDg4NjU1NDk1fQ.paF1ggI8OkTCWGMZIE_qB6-c08F7QSDueLIie9yAk98';

const SQL = `
-- Drop existing function if any
DROP FUNCTION IF EXISTS get_csbd_dashboard(INT);

CREATE OR REPLACE FUNCTION get_csbd_dashboard(p_fiscal_year INT DEFAULT 2026)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_result JSONB;
  -- CSBD target holder UUIDs
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
  -- All active target holders for this fiscal year
  holders AS (
    SELECT ct.user_id, ct.annual_target_inr_lacs AS annual_target,
           ct.has_subordinates, p.full_name, p.email
    FROM csbd_targets ct
    JOIN profiles p ON p.id = ct.user_id
    WHERE ct.fiscal_year = p_fiscal_year AND ct.is_active = true
  ),

  -- For each target holder, get their full subordinate tree
  -- Dilip & Mansi are a combined team: both get credit for either team's business
  holder_subs AS (
    SELECT h.user_id AS holder_id,
           unnest(get_all_subordinate_ids(h.user_id)) AS sub_id
    FROM holders h
    WHERE h.has_subordinates = true
  ),

  -- Map every person to their CLOSEST target holder
  -- Target holders → themselves (priority); subordinates → their holder
  holder_map AS (
    SELECT user_id AS person_id, user_id AS holder_id
    FROM holders
    UNION ALL
    SELECT hs.sub_id AS person_id, hs.holder_id
    FROM holder_subs hs
    WHERE hs.sub_id NOT IN (SELECT user_id FROM holders)
  ),

  -- Generate 12 months for the fiscal year
  months AS (
    SELECT generate_series(
      v_year_start::timestamp,
      (v_year_start + interval '11 months')::timestamp,
      interval '1 month'
    )::date AS month
  ),

  -- All closed/invoiced projects in the fiscal year with their holder mapping
  project_credits AS (
    SELECT
      p.project_owner,
      hm.holder_id,
      date_trunc('month',
        COALESCE(pq_latest.invoice_date::timestamp, p.invoiced_closed_at, p.updated_at)
      )::date AS month,
      COALESCE(NULLIF(p.final_afactor, 0), p.expected_afactor, 0) / 100000.0 AS amount_lacs,
      COALESCE(p.client_id, '') AS client_name
    FROM projects p
    LEFT JOIN LATERAL (
      SELECT MAX(invoice_date) AS invoice_date
      FROM project_quotations
      WHERE project_id = p.id AND invoice_date IS NOT NULL
    ) pq_latest ON true
    INNER JOIN holder_map hm ON hm.person_id = p.project_owner
    WHERE p.status IN ('closed', 'invoiced')
      AND (p.final_afactor IS NOT NULL OR p.expected_afactor IS NOT NULL)
      AND date_trunc('month',
            COALESCE(pq_latest.invoice_date::timestamp, p.invoiced_closed_at, p.updated_at)
          ) >= v_year_start::timestamp
      AND date_trunc('month',
            COALESCE(pq_latest.invoice_date::timestamp, p.invoiced_closed_at, p.updated_at)
          ) <= v_current_month::timestamp
  ),

  -- Apply credit rules and produce (credit_to, month, amount) rows
  credits AS (
    -- RULE 1: Dilip & Mansi are a combined team.
    -- All business from either team is pooled, then split 50/50.
    -- Dilip gets 50% of combined (Dilip + Mansi) team business
    SELECT v_dilip AS credit_to, month, SUM(amount_lacs * 0.5) AS amount
    FROM project_credits WHERE holder_id IN (v_dilip, v_mansi)
    GROUP BY month

    UNION ALL

    -- Mansi gets 50% of combined (Dilip + Mansi) team business
    SELECT v_mansi, month, SUM(amount_lacs * 0.5)
    FROM project_credits WHERE holder_id IN (v_dilip, v_mansi)
    GROUP BY month

    UNION ALL

    -- RULE 2a: Sainath gets 20% of HPE MSA business from Geeta/Suraj/Syed teams
    SELECT v_sainath, month, SUM(amount_lacs * 0.2)
    FROM project_credits
    WHERE holder_id IN (v_geeta, v_suraj, v_syed)
      AND client_name ILIKE '%HPE MSA%'
    GROUP BY month

    UNION ALL

    -- RULE 2b: Geeta/Suraj/Syed get 80% of their own HPE MSA business
    SELECT holder_id, month, SUM(amount_lacs * 0.8)
    FROM project_credits
    WHERE holder_id IN (v_geeta, v_suraj, v_syed)
      AND client_name ILIKE '%HPE MSA%'
    GROUP BY holder_id, month

    UNION ALL

    -- RULE 3: Geeta/Suraj/Syed get 100% of all non-HPE-MSA business (including other HP projects)
    SELECT holder_id, month, SUM(amount_lacs)
    FROM project_credits
    WHERE holder_id IN (v_geeta, v_suraj, v_syed)
      AND NOT (client_name ILIKE '%HPE MSA%')
    GROUP BY holder_id, month

    UNION ALL

    -- Sainath gets 100% of his own team's business (HP or non-HP)
    SELECT v_sainath, month, SUM(amount_lacs)
    FROM project_credits WHERE holder_id = v_sainath
    GROUP BY month

    UNION ALL

    -- RULE 4: Niraj gets 100% of his team's business
    SELECT v_niraj, month, SUM(amount_lacs)
    FROM project_credits WHERE holder_id = v_niraj
    GROUP BY month

    UNION ALL

    -- RULE 4: Vikhyat gets 100% of his team's business
    SELECT v_vikhyat, month, SUM(amount_lacs)
    FROM project_credits WHERE holder_id = v_vikhyat
    GROUP BY month
  ),

  -- Aggregate credits per holder per month
  monthly_actuals AS (
    SELECT credit_to AS user_id, month, SUM(amount) AS actual
    FROM credits
    GROUP BY credit_to, month
  ),

  -- Get projections for the fiscal year
  projections AS (
    SELECT user_id, month, projection_amount_inr_lacs AS projection
    FROM csbd_projections
    WHERE month >= v_year_start
      AND month < (v_year_start + interval '1 year')::date
  ),

  -- Cross join holders × months, then left join actuals and projections
  holder_months AS (
    SELECT
      h.user_id, h.full_name, h.email, h.annual_target, h.has_subordinates,
      m.month,
      COALESCE(pr.projection, 0) AS projection,
      COALESCE(ma.actual, 0) AS actual
    FROM holders h
    CROSS JOIN months m
    LEFT JOIN projections pr ON pr.user_id = h.user_id AND pr.month = m.month
    LEFT JOIN monthly_actuals ma ON ma.user_id = h.user_id AND ma.month = m.month
  ),

  -- Build per-holder aggregates + monthly array
  holder_json AS (
    SELECT
      hm.user_id,
      hm.full_name,
      hm.email,
      hm.annual_target,
      hm.has_subordinates,
      COALESCE(SUM(hm.projection) FILTER (WHERE hm.month <= v_current_month), 0) AS ytd_projection,
      COALESCE(SUM(hm.actual) FILTER (WHERE hm.month <= v_current_month), 0) AS ytd_actual,
      jsonb_agg(
        jsonb_build_object(
          'month', to_char(hm.month, 'YYYY-MM-DD'),
          'projection', ROUND(hm.projection::numeric, 2),
          'actual', ROUND(hm.actual::numeric, 2),
          'variance', ROUND((hm.actual - hm.projection)::numeric, 2),
          'over_under_percentage',
            CASE WHEN hm.projection > 0
              THEN ROUND(((hm.actual - hm.projection) / hm.projection * 100)::numeric, 2)
              ELSE 0 END
        ) ORDER BY hm.month
      ) AS monthly_performance
    FROM holder_months hm
    GROUP BY hm.user_id, hm.full_name, hm.email, hm.annual_target, hm.has_subordinates
  )

  SELECT jsonb_agg(
    jsonb_build_object(
      'user_id', hj.user_id,
      'full_name', hj.full_name,
      'email', hj.email,
      'annual_target', hj.annual_target,
      'ytd_projection', ROUND(hj.ytd_projection::numeric, 2),
      'ytd_actual', ROUND(hj.ytd_actual::numeric, 2),
      'ytd_variance', ROUND((hj.ytd_actual - hj.ytd_projection)::numeric, 2),
      'achievement_percentage',
        CASE WHEN hj.annual_target > 0
          THEN ROUND((hj.ytd_actual / hj.annual_target * 100)::numeric, 2)
          ELSE 0 END,
      'projection_fulfilment_percentage',
        CASE WHEN hj.ytd_projection > 0
          THEN ROUND((hj.ytd_actual / hj.ytd_projection * 100)::numeric, 2)
          ELSE 0 END,
      'monthly_performance', hj.monthly_performance,
      'has_subordinates', hj.has_subordinates
    )
  ) INTO v_result
  FROM holder_json hj;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$fn$;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION get_csbd_dashboard(INT) TO authenticated;
`;

function supabaseQuery(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql });
    const options = {
      hostname: SUPABASE_URL,
      path: '/rest/v1/rpc/exec_sql',
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
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

// Use the Supabase Management API to run SQL
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
  console.log('Creating get_csbd_dashboard RPC function...');

  // Try Management API first
  let result = await managementQuery(SQL);
  console.log('Management API:', result.status);

  if (result.status === 201 || result.status === 200) {
    console.log('Function created successfully via Management API');
    console.log(result.body.slice(0, 500));
  } else {
    console.log('Management API response:', result.body.slice(0, 300));

    // Fallback: try pg module
    console.log('\nTrying direct PostgreSQL connection...');
    try {
      const { Client } = require('pg');
      const client = new Client({
        host: 'db.ltlvhmwrrsromwuiybwu.supabase.co',
        port: 5432,
        database: 'postgres',
        user: 'postgres',
        password: '7vN$F9#2xP&z@qL1',
        ssl: { rejectUnauthorized: false },
      });
      await client.connect();
      console.log('Connected to PostgreSQL');
      await client.query(SQL);
      console.log('Function created successfully via direct PostgreSQL');

      // Test the function
      const test = await client.query("SELECT get_csbd_dashboard(2026)");
      const data = test.rows[0].get_csbd_dashboard;
      if (Array.isArray(data)) {
        console.log(`\nReturned ${data.length} target holders:`);
        data.forEach(h => {
          console.log(`  ${h.full_name}: target=${h.annual_target}, ytd_actual=${h.ytd_actual}, ach=${h.achievement_percentage}%`);
        });
      } else {
        console.log('Result:', JSON.stringify(data).slice(0, 500));
      }

      await client.end();
    } catch (e) {
      console.error('PostgreSQL error:', e.message);
      console.log('\nSQL has been printed. Please run it manually in the Supabase SQL Editor.');
      console.log('\n--- SQL START ---');
      console.log(SQL);
      console.log('--- SQL END ---');
    }
  }
}

main().catch(console.error);
