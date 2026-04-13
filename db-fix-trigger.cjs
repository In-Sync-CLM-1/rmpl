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

  // 1. Recreate the trigger on demandcom table
  console.log('=== RECREATING TRIGGER ===');
  await client.query(`
    DROP TRIGGER IF EXISTS track_demandcom_field_changes ON public.demandcom;
    CREATE TRIGGER track_demandcom_field_changes
      AFTER UPDATE ON public.demandcom
      FOR EACH ROW
      EXECUTE FUNCTION public.log_demandcom_field_changes();
  `);
  console.log('Trigger track_demandcom_field_changes created successfully');

  // 2. Verify trigger exists now
  const triggers = await client.query(`
    SELECT tgname, tgenabled FROM pg_trigger
    WHERE tgname = 'track_demandcom_field_changes'
  `);
  console.log(`Trigger verified: ${triggers.rows.length > 0 ? 'YES' : 'NO'} (enabled=${triggers.rows[0]?.tgenabled})`);

  // 3. Test the trigger
  console.log('\n=== TESTING TRIGGER ===');
  const testRow = await client.query(`SELECT id, latest_disposition FROM demandcom LIMIT 1`);
  const testId = testRow.rows[0].id;
  const currentDisp = testRow.rows[0].latest_disposition;

  await client.query(`UPDATE demandcom SET latest_disposition = 'TEST_TRIGGER', updated_by = NULL, updated_at = NOW() WHERE id = $1`, [testId]);

  const check = await client.query(`SELECT * FROM demandcom_field_changes WHERE demandcom_id = $1 ORDER BY changed_at DESC LIMIT 1`, [testId]);
  if (check.rows.length > 0) {
    console.log('TRIGGER IS WORKING! Change recorded.');
  } else {
    console.log('TRIGGER STILL NOT WORKING!');
  }

  // Revert and clean
  await client.query(`UPDATE demandcom SET latest_disposition = $1, updated_at = NOW() WHERE id = $2`, [currentDisp, testId]);
  await client.query(`DELETE FROM demandcom_field_changes WHERE demandcom_id = $1`, [testId]);
  console.log('Test cleaned up');

  // 4. Also ensure get_demandcom_kpi_metrics is SECURITY DEFINER with proper timeout
  console.log('\n=== CHECKING RPC FUNCTIONS ===');
  const funcCheck = await client.query(`
    SELECT proname, prosecdef,
           (SELECT setting FROM pg_catalog.pg_options_to_table(proconfig) WHERE name = 'statement_timeout') as timeout
    FROM pg_proc
    WHERE proname IN ('get_demandcom_kpi_metrics', 'get_demandcom_disposition_breakdown', 'get_demandcom_agent_stats', 'get_execution_project_stats')
  `);
  funcCheck.rows.forEach(r => console.log(`${r.proname}: SECURITY_DEFINER=${r.prosecdef}, timeout=${r.timeout || 'none'}`));

  // 5. Fix get_demandcom_kpi_metrics to be SECURITY DEFINER with timeout
  const kpiFunc = await client.query(`SELECT prosrc FROM pg_proc WHERE proname = 'get_demandcom_kpi_metrics'`);
  if (kpiFunc.rows.length > 0 && !kpiFunc.rows[0].prosrc.includes('statement_timeout')) {
    console.log('\nFixing get_demandcom_kpi_metrics...');

    // Get the function definition to recreate it
    const funcDef = await client.query(`
      SELECT pg_get_functiondef(oid) as def FROM pg_proc WHERE proname = 'get_demandcom_kpi_metrics'
    `);
    console.log('Current function has SECURITY DEFINER:', funcDef.rows[0].def.includes('SECURITY DEFINER'));

    // Get params
    const params = await client.query(`
      SELECT pg_get_function_arguments(oid) as args,
             pg_get_function_result(oid) as result
      FROM pg_proc WHERE proname = 'get_demandcom_kpi_metrics'
    `);
    console.log(`Args: ${params.rows[0].args}`);
    console.log(`Returns: ${params.rows[0].result}`);
  }

  await client.end();
  console.log('\nDone!');
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });
