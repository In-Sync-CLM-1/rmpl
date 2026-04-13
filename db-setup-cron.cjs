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
  await client.query(`SET statement_timeout = '30s'`);
  console.log('Connected\n');

  // 1. Check if pg_cron extension is available
  try {
    const ext = await client.query(`SELECT * FROM pg_extension WHERE extname = 'pg_cron'`);
    if (ext.rows.length === 0) {
      console.log('pg_cron not enabled. Enabling...');
      await client.query(`CREATE EXTENSION IF NOT EXISTS pg_cron`);
      console.log('pg_cron enabled');
    } else {
      console.log('pg_cron already enabled');
    }
  } catch (e) {
    console.log('pg_cron not available:', e.message);
    console.log('\nFalling back: will set up refresh via Supabase Edge Function cron instead');
    await client.end();
    return;
  }

  // 2. Remove any existing refresh jobs
  try {
    await client.query(`SELECT cron.unschedule('refresh-demandcom-caches')`);
    console.log('Removed existing job');
  } catch (e) {
    // Job doesn't exist yet, fine
  }

  try {
    await client.query(`SELECT cron.unschedule('refresh-master-caches')`);
  } catch (e) {}

  // 3. Schedule demandcom cache refresh every 4 minutes
  const result1 = await client.query(`
    SELECT cron.schedule(
      'refresh-demandcom-caches',
      '*/5 * * * *',
      $$SELECT refresh_demandcom_caches()$$
    )
  `);
  console.log('Scheduled demandcom cache refresh every 4 min:', result1.rows[0]);

  // 4. Schedule master cache refresh every 4 minutes too
  const result2 = await client.query(`
    SELECT cron.schedule(
      'refresh-master-caches',
      '*/5 * * * *',
      $$SELECT refresh_master_caches()$$
    )
  `);
  console.log('Scheduled master cache refresh every 4 min:', result2.rows[0]);

  // 5. List all cron jobs
  const jobs = await client.query(`SELECT jobid, schedule, command, nodename, active FROM cron.job ORDER BY jobid`);
  console.log('\n=== ACTIVE CRON JOBS ===');
  jobs.rows.forEach(r => console.log(`  [${r.jobid}] ${r.schedule} | active=${r.active} | ${r.command}`));

  await client.end();
  console.log('\nDone!');
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });
