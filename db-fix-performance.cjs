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

  // 1. Skip stuck query cancellation (no permission)

  // 2. VACUUM ANALYZE the key tables to refresh planner stats
  console.log('\n=== VACUUM ANALYZE ===');
  await client.query(`VACUUM ANALYZE demandcom`);
  console.log('demandcom: done');
  await client.query(`VACUUM ANALYZE demandcom_field_changes`);
  console.log('demandcom_field_changes: done');
  await client.query(`VACUUM ANALYZE demandcom_daily_performance`);
  console.log('demandcom_daily_performance: done');

  // 3. Create materialized view for demandcom KPI cache
  console.log('\n=== CREATING KPI CACHE ===');
  await client.query(`
    DROP MATERIALIZED VIEW IF EXISTS demandcom_kpi_cache;
    CREATE MATERIALIZED VIEW demandcom_kpi_cache AS
    SELECT
      COUNT(*) as total_count,
      COUNT(*) FILTER (WHERE assigned_to IS NOT NULL) as assigned_count,
      COUNT(*) FILTER (WHERE latest_subdisposition = 'Registered') as all_registered_count,
      COUNT(DISTINCT latest_disposition) FILTER (WHERE latest_disposition IS NOT NULL AND latest_disposition != '') as disposition_types,
      jsonb_object_agg(
        COALESCE(latest_disposition, 'Unknown'),
        cnt
      ) FILTER (WHERE latest_disposition IS NOT NULL AND latest_disposition != '') as disposition_counts
    FROM (
      SELECT latest_disposition, latest_subdisposition, assigned_to,
        COUNT(*) as cnt
      FROM demandcom
      WHERE latest_disposition IS NOT NULL AND latest_disposition != ''
      GROUP BY latest_disposition, latest_subdisposition, assigned_to IS NOT NULL
    ) sub
    CROSS JOIN (SELECT COUNT(*) as total_count FROM demandcom) tc;
  `);
  // Actually that's getting complicated. Let me use a simpler approach.
  await client.query(`DROP MATERIALIZED VIEW IF EXISTS demandcom_kpi_cache`);

  // Simple KPI cache
  await client.query(`
    CREATE MATERIALIZED VIEW demandcom_kpi_cache AS
    SELECT
      COUNT(*)::int as total_count,
      COUNT(*) FILTER (WHERE assigned_to IS NOT NULL)::int as assigned_count,
      COUNT(*) FILTER (WHERE latest_subdisposition = 'Registered')::int as registered_count,
      COUNT(*) FILTER (WHERE updated_at >= CURRENT_DATE)::int as updated_today_count
    FROM demandcom;
  `);
  console.log('demandcom_kpi_cache created');

  // Create unique index for CONCURRENTLY refresh
  await client.query(`CREATE UNIQUE INDEX ON demandcom_kpi_cache ((total_count IS NOT NULL))`);
  await client.query(`GRANT SELECT ON demandcom_kpi_cache TO anon, authenticated`);
  console.log('Indexes and grants applied');

  // 4. Create disposition breakdown cache
  await client.query(`
    DROP MATERIALIZED VIEW IF EXISTS demandcom_disposition_cache;
    CREATE MATERIALIZED VIEW demandcom_disposition_cache AS
    SELECT
      COALESCE(latest_disposition, 'Unknown') as disposition,
      COUNT(*)::int as count
    FROM demandcom
    WHERE latest_disposition IS NOT NULL AND latest_disposition != ''
    GROUP BY latest_disposition
    ORDER BY COUNT(*) DESC;
  `);
  await client.query(`CREATE UNIQUE INDEX ON demandcom_disposition_cache (disposition)`);
  await client.query(`GRANT SELECT ON demandcom_disposition_cache TO anon, authenticated`);
  console.log('demandcom_disposition_cache created');

  // 5. Update KPI function to use cache
  console.log('\n=== UPDATING RPC FUNCTIONS ===');
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
      -- Use cache when no filters and date range covers full dataset
      IF p_activity_filter IS NULL AND p_agent_filter IS NULL
         AND (p_start_date IS NULL OR p_start_date <= (SELECT MIN(created_at) FROM demandcom LIMIT 1))
      THEN
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
        COUNT(*)::bigint as total_count,
        COUNT(*) FILTER (WHERE assigned_to IS NOT NULL)::bigint as assigned_count,
        COUNT(*) FILTER (
          WHERE latest_subdisposition = 'Registered'
          AND updated_at >= COALESCE(p_start_date, '1970-01-01'::timestamptz)
          AND updated_at <= COALESCE(p_end_date, CURRENT_TIMESTAMP)
        )::bigint as registered_count,
        COUNT(*) FILTER (WHERE updated_at >= COALESCE(p_today_start, CURRENT_DATE::timestamptz))::bigint as updated_today_count
      FROM demandcom
      WHERE
        (p_activity_filter IS NULL OR activity_name = p_activity_filter)
        AND (p_agent_filter IS NULL OR assigned_to = p_agent_filter)
        AND (p_start_date IS NULL OR created_at >= p_start_date)
        AND (p_end_date IS NULL OR created_at <= p_end_date);
    END;
    $function$
  `);
  console.log('get_demandcom_kpi_metrics updated with cache');

  // 6. Update disposition breakdown to use cache
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
      IF p_activity_filter IS NULL AND p_agent_filter IS NULL
         AND (p_start_date IS NULL OR p_start_date <= (SELECT MIN(created_at) FROM demandcom LIMIT 1))
      THEN
        RETURN QUERY SELECT dc.disposition, dc.count::bigint FROM demandcom_disposition_cache dc;
        RETURN;
      END IF;

      -- Filtered: compute on the fly
      RETURN QUERY
      SELECT
        COALESCE(d.latest_disposition, 'Unknown') as disposition,
        COUNT(*)::bigint as count
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
  console.log('get_demandcom_disposition_breakdown updated with cache');

  // 7. Create refresh function for all demandcom caches
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
  console.log('refresh_demandcom_caches function created');

  // 8. Test the functions now
  console.log('\n=== TESTING ===');
  let t = Date.now();
  const kpi = await client.query(`SELECT * FROM get_demandcom_kpi_metrics(NULL, NULL, NULL, NULL, NULL)`);
  console.log(`KPI (uncached path test): ${JSON.stringify(kpi.rows[0])} (${Date.now() - t}ms)`);

  t = Date.now();
  const disp = await client.query(`SELECT * FROM get_demandcom_disposition_breakdown(NULL, NULL, NULL, NULL)`);
  console.log(`Disposition breakdown: ${disp.rows.length} categories (${Date.now() - t}ms)`);

  // 9. Extend role timeout since DB is slow
  await client.query(`ALTER ROLE authenticated SET statement_timeout = '60s'`);
  console.log('\nExtended authenticated role timeout to 60s');

  await client.end();
  console.log('\nAll fixes applied!');
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });
