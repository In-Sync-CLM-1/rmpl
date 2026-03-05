import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function arrayToCSV(rows: Record<string, any>[]): string {
  if (!rows || rows.length === 0) return '';
  
  const headers = Object.keys(rows[0]);
  const headerRow = headers.map(h => `"${h}"`).join(',');
  
  const dataRows = rows.map(row => {
    return headers.map(h => {
      const val = row[h];
      if (val === null || val === undefined) return '""';
      const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
      return `"${str.replace(/"/g, '""')}"`;
    }).join(',');
  });
  
  return [headerRow, ...dataRows].join('\n');
}

// Tables that have a timestamp column suitable for incremental filtering
const TIMESTAMP_COLUMNS: Record<string, string> = {
  // Most tables use created_at or updated_at
  default: 'created_at',
};

function getTimestampColumn(tableName: string): string {
  return TIMESTAMP_COLUMNS[tableName] || TIMESTAMP_COLUMNS.default;
}

// Tables that have both created_at and updated_at - we use updated_at for incremental
const TABLES_WITH_UPDATED_AT = [
  'attendance_policies', 'attendance_records', 'attendance_regularizations',
  'bulk_import_history', 'call_logs', 'campaigns', 'campaign_recipients',
  'chat_conversations', 'chat_messages', 'clients',
  'crm_tickets', 'csbd_credit_allocations', 'csbd_projections', 'csbd_targets',
  'demandcom', 'demandcom_daily_performance', 'demandcom_daily_targets',
  'designations', 'events', 'general_tasks',
  'leave_requests', 'notifications', 'profiles',
  'project_demandcom', 'project_digicom', 'project_invoices',
  'project_livecom', 'project_livecom_events', 'project_quotations',
  'project_tasks', 'projects', 'quotation_payments',
  'vendors', 'vendor_payments', 'whatsapp_settings',
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: roleData } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'platform_admin', 'super_admin', 'admin_administration', 'admin_tech'])
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse params
    const url = new URL(req.url);
    const tableParam = url.searchParams.get('table');
    const mode = url.searchParams.get('mode') || 'full'; // 'full' or 'incremental'
    const sinceParam = url.searchParams.get('since'); // ISO timestamp for manual override
    const autoIncremental = mode === 'incremental' && !sinceParam; // auto-detect from last backup

    // Determine the "since" timestamp for incremental backups
    let sinceTimestamp: string | null = sinceParam || null;

    if (autoIncremental) {
      // Get the last successful backup timestamp
      const { data: lastBackup } = await adminClient
        .from('backup_history')
        .select('completed_at')
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastBackup) {
        sinceTimestamp = lastBackup.completed_at;
      } else {
        // No previous backup found - fall back to full export
        console.log('No previous backup found, performing full export');
      }
    }

    // Get table names
    const { data: tables, error: tablesError } = await adminClient.rpc('get_public_tables');

    let tableNames: string[] = [];

    if (tablesError) {
      tableNames = [
        'attendance_policies', 'attendance_records', 'attendance_regularizations',
        'backup_history', 'bulk_import_history', 'bulk_import_records',
        'call_dispositions', 'call_logs',
        'campaign_links', 'campaign_recipients', 'campaigns',
        'chat_conversations', 'chat_message_reactions', 'chat_messages', 'chat_participants',
        'clients', 'company_holidays',
        'crm_ticket_comments', 'crm_ticket_escalations', 'crm_ticket_history', 'crm_tickets',
        'csbd_credit_allocations', 'csbd_projection_audit', 'csbd_projections', 'csbd_targets',
        'demandcom', 'demandcom_backup_swap_20250129', 'demandcom_daily_performance',
        'demandcom_daily_targets', 'demandcom_field_changes', 'demandcom_pipeline',
        'designations', 'email_activity_log', 'email_templates',
        'employee_documents', 'employee_personal_details', 'employee_salary_details',
        'events', 'exotel_config', 'export_batches', 'export_jobs',
        'feature_announcements',
        'general_tasks',
        'hr_policy_documents',
        'import_batches', 'import_staging', 'inbound_sms',
        'inventory_allocations', 'inventory_audit_log', 'inventory_items',
        'jobs',
        'late_coming_records', 'leave_applications', 'leave_balance_adjustments', 'leave_balances',
        'master', 'monthly_point_summaries',
        'navigation_items', 'navigation_sections', 'notifications',
        'onboarding_documents', 'onboarding_forms', 'onboarding_otp_verifications',
        'onboarding_steps', 'onboarding_submissions', 'onboarding_tours',
        'operations_inventory_distribution', 'organizations',
        'password_reset_logs', 'payment_proof_images',
        'pipeline_stages', 'point_activity_types', 'profiles',
        'project_demandcom_allocations', 'project_demandcom_checklist',
        'project_digicom_checklist', 'project_files',
        'project_livecom_checklist', 'project_livecom_events',
        'project_quotations', 'project_tasks', 'project_team_members', 'project_team_notifications', 'projects',
        'push_subscriptions',
        'quotation_payments', 'role_metadata',
        'salary_slips', 'sms_templates',
        'sync_batches', 'sync_logs', 'sync_status',
        'team_members', 'teams',
        'user_announcement_views', 'user_daily_activity', 'user_designations',
        'user_oauth_tokens', 'user_onboarding_progress', 'user_optional_holiday_claims',
        'user_points', 'user_roles', 'user_view_permissions',
        'vapi_call_logs', 'vapi_scheduled_calls',
        'vendors',
        'webhook_connectors', 'webhook_logs',
        'whatsapp_messages', 'whatsapp_settings', 'whatsapp_templates',
      ];
    } else {
      tableNames = (tables as any[]).map((t: any) => t.table_name);
    }

    // Helper: fetch table data with optional incremental filter
    async function fetchTableData(table: string, since: string | null): Promise<any[]> {
      let allRows: any[] = [];
      let offset = 0;
      const pageSize = 5000;
      let hasMore = true;

      while (hasMore) {
        let query = adminClient.from(table).select('*');

        // Apply incremental filter if since timestamp provided
        if (since) {
          const tsCol = TABLES_WITH_UPDATED_AT.includes(table) ? 'updated_at' : 'created_at';
          query = query.gte(tsCol, since);
        }

        query = query.range(offset, offset + pageSize - 1);

        const { data, error } = await query;

        if (error) {
          // If the timestamp column doesn't exist, retry without filter
          if (since && error.message?.includes('column')) {
            console.warn(`Table ${table} doesn't have expected timestamp column, fetching all rows`);
            return fetchTableData(table, null);
          }
          throw error;
        }

        if (data && data.length > 0) {
          allRows = allRows.concat(data);
          offset += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      return allRows;
    }

    // Single table export
    if (tableParam) {
      if (tableParam === 'auth_users') {
        const { data: { users }, error: usersError } = await adminClient.auth.admin.listUsers({ perPage: 10000 });
        if (usersError) throw usersError;

        let filteredUsers = users || [];
        if (sinceTimestamp) {
          const sinceDate = new Date(sinceTimestamp);
          filteredUsers = filteredUsers.filter(u => {
            const updatedAt = u.updated_at ? new Date(u.updated_at) : new Date(u.created_at);
            return updatedAt >= sinceDate;
          });
        }

        const simplifiedUsers = filteredUsers.map(u => ({
          id: u.id,
          email: u.email,
          phone: u.phone,
          email_confirmed_at: u.email_confirmed_at,
          phone_confirmed_at: u.phone_confirmed_at,
          created_at: u.created_at,
          updated_at: u.updated_at,
          last_sign_in_at: u.last_sign_in_at,
          role: u.role,
          user_metadata: JSON.stringify(u.user_metadata),
          app_metadata: JSON.stringify(u.app_metadata),
        }));

        const csv = arrayToCSV(simplifiedUsers);
        return new Response(csv, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="auth_users_${mode}_backup.csv"`,
          },
        });
      }

      try {
        const data = await fetchTableData(tableParam, sinceTimestamp);
        const csv = arrayToCSV(data);

        // Record this backup
        await adminClient.from('backup_history').insert({
          backup_type: 'single_table',
          backup_mode: mode,
          tables_exported: [tableParam],
          total_rows_exported: data.length,
          since_timestamp: sinceTimestamp,
          performed_by: user.id,
          notes: `Single table export: ${tableParam}`,
        });

        return new Response(csv, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${tableParam}_${mode}_backup.csv"`,
          },
        });
      } catch (tableError) {
        const errMsg = tableError instanceof Error ? tableError.message : JSON.stringify(tableError);
        console.error(`Error exporting table ${tableParam}:`, errMsg);
        return new Response(JSON.stringify({
          error: `Failed to export table: ${tableParam}`,
          details: errMsg,
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Full/incremental backup of all tables
    const backup: Record<string, { row_count: number; csv: string }> = {};
    let totalRowsExported = 0;
    const tablesExported: string[] = [];

    // Auth users
    try {
      const { data: { users } } = await adminClient.auth.admin.listUsers({ perPage: 10000 });
      let filteredUsers = users || [];
      if (sinceTimestamp) {
        const sinceDate = new Date(sinceTimestamp);
        filteredUsers = filteredUsers.filter(u => {
          const updatedAt = u.updated_at ? new Date(u.updated_at) : new Date(u.created_at);
          return updatedAt >= sinceDate;
        });
      }
      const simplifiedUsers = filteredUsers.map(u => ({
        id: u.id,
        email: u.email,
        phone: u.phone,
        email_confirmed_at: u.email_confirmed_at,
        phone_confirmed_at: u.phone_confirmed_at,
        created_at: u.created_at,
        updated_at: u.updated_at,
        last_sign_in_at: u.last_sign_in_at,
        role: u.role,
        user_metadata: JSON.stringify(u.user_metadata),
        app_metadata: JSON.stringify(u.app_metadata),
      }));
      backup['auth_users'] = { row_count: simplifiedUsers.length, csv: arrayToCSV(simplifiedUsers) };
      totalRowsExported += simplifiedUsers.length;
      if (simplifiedUsers.length > 0) tablesExported.push('auth_users');
    } catch (e) {
      console.error('Error exporting auth users:', e);
      backup['auth_users'] = { row_count: 0, csv: `"error"\n"${String(e)}"` };
    }

    // All public tables
    for (const table of tableNames) {
      try {
        const allRows = await fetchTableData(table, sinceTimestamp);

        backup[table] = { row_count: allRows.length, csv: arrayToCSV(allRows) };
        totalRowsExported += allRows.length;
        if (allRows.length > 0) tablesExported.push(table);
      } catch (e) {
        console.error(`Error exporting ${table}:`, e);
        backup[table] = { row_count: 0, csv: `"error"\n"${String(e)}"` };
      }
    }

    // Record backup in history
    await adminClient.from('backup_history').insert({
      backup_type: 'full_database',
      backup_mode: mode,
      tables_exported: tablesExported,
      total_rows_exported: totalRowsExported,
      since_timestamp: sinceTimestamp,
      performed_by: user.id,
      notes: sinceTimestamp
        ? `Incremental backup since ${sinceTimestamp}`
        : 'Full database backup',
    });

    const summary = Object.entries(backup).map(([table, info]) => ({
      table,
      row_count: info.row_count,
    }));

    return new Response(JSON.stringify({
      backup_date: new Date().toISOString(),
      backup_mode: mode,
      since: sinceTimestamp,
      user: user.email,
      tables_with_data: tablesExported.length,
      total_rows: totalRowsExported,
      tables: summary,
      data: backup,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : JSON.stringify(error);
    console.error('Backup export error:', errMsg);
    return new Response(JSON.stringify({
      error: 'Backup failed',
      details: errMsg,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
