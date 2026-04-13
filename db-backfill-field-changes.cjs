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
  await client.query(`SET statement_timeout = '300s'`);
  console.log('Connected\n');

  // Backfill demandcom_field_changes from demandcom current state
  // Each record with updated_by + latest_disposition = one disposition change
  console.log('=== BACKFILLING DISPOSITION CHANGES ===');

  const result = await client.query(`
    INSERT INTO demandcom_field_changes (demandcom_id, changed_by, changed_at, field_name, old_value, new_value)
    SELECT
      id,
      updated_by,
      updated_at,
      'disposition',
      NULL,
      latest_disposition
    FROM demandcom
    WHERE updated_by IS NOT NULL
      AND latest_disposition IS NOT NULL
      AND latest_disposition != ''
    ON CONFLICT DO NOTHING
  `);
  console.log(`Inserted ${result.rowCount} disposition change records`);

  // Also backfill subdisposition changes for records that have it
  const subResult = await client.query(`
    INSERT INTO demandcom_field_changes (demandcom_id, changed_by, changed_at, field_name, old_value, new_value)
    SELECT
      id,
      updated_by,
      updated_at,
      'subdisposition',
      NULL,
      latest_subdisposition
    FROM demandcom
    WHERE updated_by IS NOT NULL
      AND latest_subdisposition IS NOT NULL
      AND latest_subdisposition != ''
    ON CONFLICT DO NOTHING
  `);
  console.log(`Inserted ${subResult.rowCount} subdisposition change records`);

  // Verify counts
  const counts = await client.query(`
    SELECT field_name, COUNT(*) as cnt
    FROM demandcom_field_changes
    GROUP BY field_name
    ORDER BY cnt DESC
  `);
  console.log('\n=== FIELD CHANGES AFTER BACKFILL ===');
  counts.rows.forEach(r => console.log(`${r.field_name}: ${r.cnt}`));

  // Check that agent data now shows
  const agentData = await client.query(`
    SELECT changed_by, COUNT(*) as changes
    FROM demandcom_field_changes
    WHERE field_name = 'disposition'
    GROUP BY changed_by
    ORDER BY changes DESC
    LIMIT 10
  `);
  console.log('\n=== TOP AGENTS BY DISPOSITION CHANGES ===');
  agentData.rows.forEach(r => console.log(`${r.changed_by}: ${r.changes} changes`));

  // Check date range
  const dateRange = await client.query(`
    SELECT MIN(changed_at) as earliest, MAX(changed_at) as latest
    FROM demandcom_field_changes
  `);
  console.log('\n=== DATE RANGE ===');
  console.log(dateRange.rows[0]);

  await client.end();
  console.log('\nBackfill complete!');
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });
