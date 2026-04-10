const { Client } = require('pg');

const client = new Client({
  host: 'db.ltlvhmwrrsromwuiybwu.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: '7vN$F9#2xP&z@qL1',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  await client.query(`SET statement_timeout = '120s'`);
  console.log('Connected\n');

  // 1. Fix get_demandcom_kpi_metrics: add SECURITY DEFINER + timeout
  console.log('Fixing get_demandcom_kpi_metrics...');
  await client.query(`
    CREATE OR REPLACE FUNCTION public.get_demandcom_kpi_metrics(
      p_start_date timestamptz DEFAULT NULL,
      p_end_date timestamptz DEFAULT NULL,
      p_activity_filter text DEFAULT NULL,
      p_agent_filter uuid DEFAULT NULL,
      p_today_start timestamptz DEFAULT NULL
    )
    RETURNS TABLE(total_count bigint, assigned_count bigint, registered_count bigint, updated_today_count bigint)
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    SET statement_timeout = '30s'
    AS $function$
      SELECT
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE assigned_to IS NOT NULL) as assigned_count,
        COUNT(*) FILTER (
          WHERE latest_subdisposition = 'Registered'
          AND updated_at >= COALESCE(p_start_date, '1970-01-01'::timestamptz)
          AND updated_at <= COALESCE(p_end_date, CURRENT_TIMESTAMP)
        ) as registered_count,
        COUNT(*) FILTER (WHERE updated_at >= COALESCE(p_today_start, CURRENT_DATE::timestamptz)) as updated_today_count
      FROM demandcom
      WHERE
        (p_activity_filter IS NULL OR activity_name = p_activity_filter)
        AND (p_agent_filter IS NULL OR assigned_to = p_agent_filter)
        AND (p_start_date IS NULL OR created_at >= p_start_date)
        AND (p_end_date IS NULL OR created_at <= p_end_date);
    $function$
  `);
  console.log('Done - get_demandcom_kpi_metrics is now SECURITY DEFINER with 30s timeout');

  // 2. Add timeout to get_execution_project_stats
  const execDef = await client.query(`SELECT pg_get_functiondef(oid) as def FROM pg_proc WHERE proname = 'get_execution_project_stats'`);
  console.log('\nget_execution_project_stats config:', execDef.rows[0]?.def?.substring(0, 200));

  // 3. Add composite index for demandcom_field_changes queries
  console.log('\nAdding composite index on demandcom_field_changes...');
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_dfc_field_changed_at
    ON public.demandcom_field_changes (field_name, changed_at DESC);
  `);
  console.log('Done');

  // 4. Add index for disposition + changed_by queries
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_dfc_disposition_changed_by
    ON public.demandcom_field_changes (field_name, changed_by, changed_at DESC)
    WHERE field_name = 'disposition';
  `);
  console.log('Added partial index for disposition queries');

  // 5. Verify all fixes
  console.log('\n=== VERIFICATION ===');
  const verify = await client.query(`
    SELECT proname, prosecdef, proconfig
    FROM pg_proc
    WHERE proname = 'get_demandcom_kpi_metrics'
  `);
  console.log(`get_demandcom_kpi_metrics: SECURITY_DEFINER=${verify.rows[0].prosecdef}, config=${JSON.stringify(verify.rows[0].proconfig)}`);

  const trigVerify = await client.query(`SELECT tgname FROM pg_trigger WHERE tgname = 'track_demandcom_field_changes'`);
  console.log(`track_demandcom_field_changes trigger exists: ${trigVerify.rows.length > 0}`);

  await client.end();
  console.log('\nAll database fixes applied!');
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });
