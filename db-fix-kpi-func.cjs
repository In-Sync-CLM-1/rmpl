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

  // 1. Get full definition
  const kpiDef = await client.query(`SELECT pg_get_functiondef(oid) as def FROM pg_proc WHERE proname = 'get_demandcom_kpi_metrics'`);
  console.log('=== FULL FUNCTION DEF ===');
  console.log(kpiDef.rows[0].def);

  await client.end();
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });
