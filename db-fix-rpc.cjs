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

  // 1. Check RPC functions
  const funcCheck = await client.query(`
    SELECT proname, prosecdef, proconfig
    FROM pg_proc
    WHERE proname IN ('get_demandcom_kpi_metrics', 'get_demandcom_disposition_breakdown', 'get_demandcom_agent_stats', 'get_execution_project_stats')
  `);
  console.log('=== RPC FUNCTION STATUS ===');
  funcCheck.rows.forEach(r => console.log(`${r.proname}: SECURITY_DEFINER=${r.prosecdef}, config=${JSON.stringify(r.proconfig)}`));

  // 2. Get full definition of get_demandcom_kpi_metrics to recreate with SECURITY DEFINER
  const kpiDef = await client.query(`SELECT pg_get_functiondef(oid) as def FROM pg_proc WHERE proname = 'get_demandcom_kpi_metrics'`);
  if (kpiDef.rows.length > 0) {
    const def = kpiDef.rows[0].def;
    const isSecDef = def.includes('SECURITY DEFINER');
    const hasTimeout = def.includes('statement_timeout');
    console.log(`\nget_demandcom_kpi_metrics: SECURITY_DEFINER=${isSecDef}, has_timeout=${hasTimeout}`);

    if (!isSecDef || !hasTimeout) {
      console.log('Fixing get_demandcom_kpi_metrics...');
      // Extract body
      const bodyMatch = def.match(/\$\$(.+)\$\$/s);
      if (bodyMatch) {
        console.log('Function body length:', bodyMatch[1].length);
      }
      // Print first few lines to understand structure
      console.log('\nFunction definition (first 500 chars):');
      console.log(def.substring(0, 500));
    }
  }

  // 3. Same for get_execution_project_stats
  const execDef = await client.query(`SELECT pg_get_functiondef(oid) as def FROM pg_proc WHERE proname = 'get_execution_project_stats'`);
  if (execDef.rows.length > 0) {
    const def = execDef.rows[0].def;
    console.log(`\nget_execution_project_stats SECURITY_DEFINER=${def.includes('SECURITY DEFINER')}, has_timeout=${def.includes('statement_timeout')}`);
  }

  await client.end();
  console.log('\nDone!');
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });
