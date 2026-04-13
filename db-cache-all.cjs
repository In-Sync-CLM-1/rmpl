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
  await client.query(`SET statement_timeout = '0'`); // no timeout
  console.log('Connected\n');

  // 1. Cache agent stats
  console.log('Creating agent stats cache...');
  let t = Date.now();
  await client.query(`DROP MATERIALIZED VIEW IF EXISTS demandcom_agent_stats_cache`);
  await client.query(`
    CREATE MATERIALIZED VIEW demandcom_agent_stats_cache AS
    WITH team_agents AS (
      SELECT DISTINCT tm.user_id
      FROM team_members tm
      JOIN teams t ON t.id = tm.team_id
      WHERE t.name = 'Demandcom-Calling'
    ),
    agent_profiles AS (
      SELECT p.id, p.full_name
      FROM profiles p
      WHERE p.id IN (SELECT user_id FROM team_agents)
    )
    SELECT
      ap.id as agent_id,
      ap.full_name as agent_name,
      COUNT(d.id)::int as total_assigned,
      COUNT(d.id) FILTER (WHERE d.latest_disposition IS NOT NULL)::int as tagged_count
    FROM agent_profiles ap
    LEFT JOIN demandcom d ON d.assigned_to = ap.id
    GROUP BY ap.id, ap.full_name
    ORDER BY COUNT(d.id) DESC
  `);
  await client.query(`CREATE UNIQUE INDEX ON demandcom_agent_stats_cache (agent_id)`);
  await client.query(`GRANT SELECT ON demandcom_agent_stats_cache TO anon, authenticated`);
  console.log(`Agent stats cache created (${Date.now() - t}ms)`);

  // 2. Cache execution project stats
  console.log('Creating execution stats cache...');
  t = Date.now();
  await client.query(`DROP MATERIALIZED VIEW IF EXISTS demandcom_execution_stats_cache`);
  await client.query(`
    CREATE MATERIALIZED VIEW demandcom_execution_stats_cache AS
    SELECT
      d.activity_name as project_name,
      COALESCE(
        (SELECT SUM(pda.registration_target)::integer
         FROM project_demandcom_allocations pda
         WHERE pda.project_id = p.id),
        p.number_of_attendees,
        0
      )::integer as required_participants,
      COUNT(*)::int as assigned_data,
      COUNT(*) FILTER (WHERE d.latest_subdisposition = 'Interested')::int as interested_count,
      COUNT(*) FILTER (WHERE d.latest_subdisposition = 'Registered')::int as registered_count
    FROM demandcom d
    LEFT JOIN projects p ON p.project_name = d.activity_name
    WHERE d.activity_name IS NOT NULL
    GROUP BY d.activity_name, p.id, p.number_of_attendees
    ORDER BY COUNT(*) DESC
  `);
  await client.query(`CREATE UNIQUE INDEX ON demandcom_execution_stats_cache (project_name)`);
  await client.query(`GRANT SELECT ON demandcom_execution_stats_cache TO anon, authenticated`);
  console.log(`Execution stats cache created (${Date.now() - t}ms)`);

  // 3. Update agent stats function to use cache
  await client.query(`
    CREATE OR REPLACE FUNCTION public.get_demandcom_agent_stats(
      p_team_name text DEFAULT 'Demandcom-Calling'
    )
    RETURNS TABLE(agent_id uuid, agent_name text, total_assigned bigint, tagged_count bigint)
    LANGUAGE plpgsql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    SET statement_timeout = '60s'
    AS $function$
    BEGIN
      IF p_team_name = 'Demandcom-Calling' THEN
        RETURN QUERY SELECT c.agent_id, c.agent_name, c.total_assigned::bigint, c.tagged_count::bigint
        FROM demandcom_agent_stats_cache c;
        RETURN;
      END IF;
      -- Fallback for other teams
      RETURN QUERY
      WITH team_agents AS (
        SELECT DISTINCT tm.user_id FROM team_members tm JOIN teams t ON t.id = tm.team_id WHERE t.name = p_team_name
      )
      SELECT p.id, p.full_name, COUNT(d.id)::bigint, COUNT(d.id) FILTER (WHERE d.latest_disposition IS NOT NULL)::bigint
      FROM profiles p
      LEFT JOIN demandcom d ON d.assigned_to = p.id
      WHERE p.id IN (SELECT user_id FROM team_agents)
      GROUP BY p.id, p.full_name ORDER BY COUNT(d.id) DESC;
    END;
    $function$
  `);
  console.log('Agent stats function updated');

  // 4. Update execution stats function to use cache
  await client.query(`
    CREATE OR REPLACE FUNCTION public.get_execution_project_stats()
    RETURNS TABLE(project_name text, required_participants integer, assigned_data bigint, interested_count bigint, registered_count bigint)
    LANGUAGE plpgsql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    SET statement_timeout = '60s'
    AS $function$
    BEGIN
      RETURN QUERY SELECT c.project_name, c.required_participants,
        c.assigned_data::bigint, c.interested_count::bigint, c.registered_count::bigint
      FROM demandcom_execution_stats_cache c;
    END;
    $function$
  `);
  console.log('Execution stats function updated');

  // 5. Update refresh function to include all caches
  await client.query(`
    CREATE OR REPLACE FUNCTION public.refresh_demandcom_caches()
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    SET statement_timeout = '0'
    AS $$
    BEGIN
      REFRESH MATERIALIZED VIEW CONCURRENTLY demandcom_kpi_cache;
      REFRESH MATERIALIZED VIEW CONCURRENTLY demandcom_disposition_cache;
      REFRESH MATERIALIZED VIEW CONCURRENTLY demandcom_agent_stats_cache;
      REFRESH MATERIALIZED VIEW CONCURRENTLY demandcom_execution_stats_cache;
    END;
    $$
  `);
  console.log('Refresh function updated');

  // 6. Test all caches
  console.log('\n=== TESTING CACHED QUERIES ===');
  t = Date.now();
  const kpi = await client.query(`SELECT * FROM demandcom_kpi_cache`);
  console.log(`KPI: ${JSON.stringify(kpi.rows[0])} (${Date.now() - t}ms)`);

  t = Date.now();
  const disp = await client.query(`SELECT COUNT(*) FROM demandcom_disposition_cache`);
  console.log(`Dispositions: ${disp.rows[0].count} categories (${Date.now() - t}ms)`);

  t = Date.now();
  const agents = await client.query(`SELECT * FROM demandcom_agent_stats_cache`);
  console.log(`Agents: ${agents.rows.length} agents (${Date.now() - t}ms)`);

  t = Date.now();
  const exec = await client.query(`SELECT * FROM demandcom_execution_stats_cache`);
  console.log(`Execution: ${exec.rows.length} projects (${Date.now() - t}ms)`);

  // 7. Test through functions
  t = Date.now();
  const agentFunc = await client.query(`SELECT * FROM get_demandcom_agent_stats('Demandcom-Calling')`);
  console.log(`\nAgent stats function: ${agentFunc.rows.length} agents (${Date.now() - t}ms)`);

  t = Date.now();
  const execFunc = await client.query(`SELECT * FROM get_execution_project_stats()`);
  console.log(`Execution stats function: ${execFunc.rows.length} projects (${Date.now() - t}ms)`);

  await client.end();
  console.log('\nAll caches ready!');
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });
