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
  await client.query(`SET statement_timeout = '0'`); // no timeout for setup
  console.log('Connected\n');

  // 1. Create KPI cache
  console.log('Creating KPI cache...');
  let t = Date.now();
  await client.query(`DROP MATERIALIZED VIEW IF EXISTS demandcom_kpi_cache`);
  await client.query(`
    CREATE MATERIALIZED VIEW demandcom_kpi_cache AS
    SELECT
      COUNT(*)::int as total_count,
      COUNT(*) FILTER (WHERE assigned_to IS NOT NULL)::int as assigned_count,
      COUNT(*) FILTER (WHERE latest_subdisposition = 'Registered')::int as registered_count,
      COUNT(*) FILTER (WHERE updated_at >= CURRENT_DATE)::int as updated_today_count
    FROM demandcom
  `);
  console.log(`KPI cache created (${Date.now() - t}ms)`);
  await client.query(`CREATE UNIQUE INDEX ON demandcom_kpi_cache ((total_count IS NOT NULL))`);
  await client.query(`GRANT SELECT ON demandcom_kpi_cache TO anon, authenticated`);

  // 2. Create disposition breakdown cache
  console.log('Creating disposition cache...');
  t = Date.now();
  await client.query(`DROP MATERIALIZED VIEW IF EXISTS demandcom_disposition_cache`);
  await client.query(`
    CREATE MATERIALIZED VIEW demandcom_disposition_cache AS
    SELECT
      COALESCE(latest_disposition, 'Unknown') as disposition,
      COUNT(*)::int as count
    FROM demandcom
    WHERE latest_disposition IS NOT NULL AND latest_disposition != ''
    GROUP BY latest_disposition
    ORDER BY COUNT(*) DESC
  `);
  console.log(`Disposition cache created (${Date.now() - t}ms)`);
  await client.query(`CREATE UNIQUE INDEX ON demandcom_disposition_cache (disposition)`);
  await client.query(`GRANT SELECT ON demandcom_disposition_cache TO anon, authenticated`);

  // 3. Update KPI function to use cache
  console.log('\nUpdating KPI function...');
  await client.query(`
    CREATE OR REPLACE FUNCTION public.get_demandcom_kpi_metrics(
      p_start_date timestamptz DEFAULT NULL,
      p_end_date timestamptz DEFAULT NULL,
      p_activity_filter text DEFAULT NULL,
      p_agent_filter uuid DEFAULT NULL,
      p_today_start timestamptz DEFAULT NULL
    )
    RETURNS TABLE(total_count bigint, assigned_count bigint, registered_count bigint, updated_today_count bigint)
    LANGUAGE plpgsql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    SET statement_timeout = '60s'
    AS $function$
    BEGIN
      -- Use cache when no filters (most common dashboard load)
      IF p_activity_filter IS NULL AND p_agent_filter IS NULL THEN
        RETURN QUERY SELECT
          kc.total_count::bigint,
          kc.assigned_count::bigint,
          kc.registered_count::bigint,
          kc.updated_today_count::bigint
        FROM demandcom_kpi_cache kc LIMIT 1;
        RETURN;
      END IF;

      -- Filtered: compute on the fly
      RETURN QUERY
      SELECT
        COUNT(*)::bigint,
        COUNT(*) FILTER (WHERE assigned_to IS NOT NULL)::bigint,
        COUNT(*) FILTER (
          WHERE latest_subdisposition = 'Registered'
          AND updated_at >= COALESCE(p_start_date, '1970-01-01'::timestamptz)
          AND updated_at <= COALESCE(p_end_date, CURRENT_TIMESTAMP)
        )::bigint,
        COUNT(*) FILTER (WHERE updated_at >= COALESCE(p_today_start, CURRENT_DATE::timestamptz))::bigint
      FROM demandcom
      WHERE
        (p_activity_filter IS NULL OR activity_name = p_activity_filter)
        AND (p_agent_filter IS NULL OR assigned_to = p_agent_filter)
        AND (p_start_date IS NULL OR created_at >= p_start_date)
        AND (p_end_date IS NULL OR created_at <= p_end_date);
    END;
    $function$
  `);
  console.log('KPI function updated');

  // 4. Update disposition breakdown to use cache
  await client.query(`
    CREATE OR REPLACE FUNCTION public.get_demandcom_disposition_breakdown(
      p_start_date timestamptz DEFAULT NULL,
      p_end_date timestamptz DEFAULT NULL,
      p_activity_filter text DEFAULT NULL,
      p_agent_filter uuid DEFAULT NULL
    )
    RETURNS TABLE(disposition text, count bigint)
    LANGUAGE plpgsql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    SET statement_timeout = '60s'
    AS $function$
    BEGIN
      -- Use cache when no filters
      IF p_activity_filter IS NULL AND p_agent_filter IS NULL THEN
        RETURN QUERY SELECT dc.disposition, dc.count::bigint FROM demandcom_disposition_cache dc;
        RETURN;
      END IF;

      -- Filtered
      RETURN QUERY
      SELECT
        COALESCE(d.latest_disposition, 'Unknown')::text,
        COUNT(*)::bigint
      FROM demandcom d
      WHERE
        d.latest_disposition IS NOT NULL AND d.latest_disposition != ''
        AND (p_activity_filter IS NULL OR d.activity_name = p_activity_filter)
        AND (p_agent_filter IS NULL OR d.assigned_to = p_agent_filter)
        AND (p_start_date IS NULL OR d.created_at >= p_start_date)
        AND (p_end_date IS NULL OR d.created_at <= p_end_date)
      GROUP BY d.latest_disposition
      ORDER BY COUNT(*) DESC;
    END;
    $function$
  `);
  console.log('Disposition function updated');

  // 5. Create refresh function
  await client.query(`
    CREATE OR REPLACE FUNCTION public.refresh_demandcom_caches()
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    SET statement_timeout = '300s'
    AS $$
    BEGIN
      REFRESH MATERIALIZED VIEW CONCURRENTLY demandcom_kpi_cache;
      REFRESH MATERIALIZED VIEW CONCURRENTLY demandcom_disposition_cache;
    END;
    $$
  `);
  console.log('Refresh function created');

  // 6. Extend role timeout
  await client.query(`ALTER ROLE authenticated SET statement_timeout = '60s'`);
  await client.query(`ALTER ROLE anon SET statement_timeout = '30s'`);
  console.log('Role timeouts updated');

  // 7. Test cache queries
  console.log('\n=== TESTING CACHED QUERIES ===');
  t = Date.now();
  const kpi = await client.query(`SELECT * FROM demandcom_kpi_cache`);
  console.log(`KPI cache direct: ${JSON.stringify(kpi.rows[0])} (${Date.now() - t}ms)`);

  t = Date.now();
  const disp = await client.query(`SELECT * FROM demandcom_disposition_cache`);
  console.log(`Disposition cache: ${disp.rows.length} categories (${Date.now() - t}ms)`);
  disp.rows.forEach(r => console.log(`  ${r.disposition}: ${r.count}`));

  t = Date.now();
  const kpiFunc = await client.query(`SELECT * FROM get_demandcom_kpi_metrics(NULL, NULL, NULL, NULL, NULL)`);
  console.log(`\nKPI function (cached): ${JSON.stringify(kpiFunc.rows[0])} (${Date.now() - t}ms)`);

  t = Date.now();
  const dispFunc = await client.query(`SELECT * FROM get_demandcom_disposition_breakdown(NULL, NULL, NULL, NULL)`);
  console.log(`Disposition function (cached): ${dispFunc.rows.length} categories (${Date.now() - t}ms)`);

  await client.end();
  console.log('\nAll fixes applied!');
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });
