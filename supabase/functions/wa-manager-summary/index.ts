import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors-headers.ts';

// Template names registered with Exotel/Meta
const TEMPLATES = {
  daily_project: 'rmpl_daily_project_summary',
  daily_cashflow: 'rmpl_daily_cashflow_summary',
  daily_demandcom: 'rmpl_daily_demandcom_summary',
  weekly_pipeline: 'rmpl_weekly_pipeline_summary',
  weekly_team: 'rmpl_weekly_team_performance',
  weekly_overdue: 'rmpl_weekly_overdue_alert',
};

function normalizePhoneNumber(phone: string): string {
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (!cleaned.startsWith('+')) {
    if (cleaned.length === 10) cleaned = '+91' + cleaned;
    else if (cleaned.startsWith('91') && cleaned.length === 12) cleaned = '+' + cleaned;
    else cleaned = '+' + cleaned;
  }
  return cleaned;
}

function phoneForExotel(phone: string): string {
  return normalizePhoneNumber(phone).replace(/^\+/, '');
}

function formatCurrency(amount: number): string {
  if (amount >= 10000000) return `${(amount / 10000000).toFixed(1)}Cr`;
  if (amount >= 100000) return `${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`;
  return amount.toFixed(0);
}

// IST date helpers
function getISTToday(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  return ist.toISOString().split('T')[0];
}

function getISTDaysAgo(days: number): string {
  const now = new Date();
  const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  ist.setDate(ist.getDate() - days);
  return ist.toISOString().split('T')[0];
}

async function sendTemplateMessage(
  exotelUrl: string,
  authHeader: string,
  sourceNumber: string,
  phone: string,
  templateName: string,
  parameters: string[],
): Promise<boolean> {
  const components = parameters.length > 0
    ? [{ type: 'body', parameters: parameters.map(text => ({ type: 'text', text })) }]
    : [];

  const payload = {
    whatsapp: {
      messages: [{
        from: sourceNumber,
        to: phoneForExotel(phone),
        content: {
          type: 'template',
          template: {
            name: templateName,
            language: { code: 'en' },
            components,
          },
        },
      }],
    },
  };

  try {
    const resp = await fetch(exotelUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify(payload),
    });
    const text = await resp.text();
    console.log(`Sent ${templateName} to ${phone}: ${resp.status}`, text.slice(0, 200));
    return resp.ok;
  } catch (err) {
    console.error(`Failed to send ${templateName} to ${phone}:`, err);
    return false;
  }
}

// ─── Summary generators ──────────────────────────────────

async function dailyProjectSummary(supabase: any): Promise<string[]> {
  const today = getISTToday();
  const todayStart = `${today}T00:00:00+05:30`;
  const todayEnd = `${today}T23:59:59+05:30`;

  // New projects today
  const { count: newCount } = await supabase
    .from('projects').select('*', { count: 'exact', head: true })
    .gte('created_at', todayStart).lte('created_at', todayEnd);

  // Status changes today (updated but not created today)
  const { count: updatedCount } = await supabase
    .from('projects').select('*', { count: 'exact', head: true })
    .gte('updated_at', todayStart).lte('updated_at', todayEnd)
    .lt('created_at', todayStart);

  // Lost today
  const { count: lostCount } = await supabase
    .from('projects').select('*', { count: 'exact', head: true })
    .eq('status', 'lost')
    .gte('updated_at', todayStart).lte('updated_at', todayEnd);

  // Active pipeline
  const { data: activeProjects } = await supabase
    .from('projects').select('project_value')
    .in('status', ['pitched', 'in_discussion', 'estimate_shared', 'po_received', 'execution']);

  const activeCount = activeProjects?.length || 0;
  const totalValue = activeProjects?.reduce((s: number, p: any) => s + (p.project_value || 0), 0) || 0;

  // {{1}}=new, {{2}}=updated, {{3}}=lost, {{4}}=active, {{5}}=value
  return [
    String(newCount || 0),
    String(updatedCount || 0),
    String(lostCount || 0),
    String(activeCount),
    formatCurrency(totalValue),
  ];
}

async function dailyCashflowSummary(supabase: any): Promise<string[]> {
  const today = getISTToday();
  const todayStart = `${today}T00:00:00+05:30`;
  const todayEnd = `${today}T23:59:59+05:30`;

  // All invoices
  const { data: allInvoices } = await supabase
    .from('project_quotations').select('amount, paid_amount, status');

  const totalInvoiced = allInvoices?.reduce((s: number, q: any) => s + (q.amount || 0), 0) || 0;
  const totalReceived = allInvoices?.reduce((s: number, q: any) => s + (q.paid_amount || 0), 0) || 0;
  const totalPending = totalInvoiced - totalReceived;

  // Invoices created today
  const { data: todayInvoices } = await supabase
    .from('project_quotations').select('amount')
    .gte('created_at', todayStart).lte('created_at', todayEnd);

  const todayCount = todayInvoices?.length || 0;
  const todayAmount = todayInvoices?.reduce((s: number, q: any) => s + (q.amount || 0), 0) || 0;

  // {{1}}=total invoiced, {{2}}=total received, {{3}}=pending, {{4}}=today count, {{5}}=today amount
  return [
    formatCurrency(totalInvoiced),
    formatCurrency(totalReceived),
    formatCurrency(totalPending),
    String(todayCount),
    formatCurrency(todayAmount),
  ];
}

async function dailyDemandcomSummary(supabase: any): Promise<string[]> {
  const today = getISTToday();
  const todayStart = `${today}T00:00:00+05:30`;
  const todayEnd = `${today}T23:59:59+05:30`;

  // Calls made today
  const { count: totalCalls } = await supabase
    .from('demandcom').select('*', { count: 'exact', head: true })
    .gte('created_at', todayStart).lte('created_at', todayEnd);

  // Registrations today
  const { count: registrations } = await supabase
    .from('demandcom').select('*', { count: 'exact', head: true })
    .eq('latest_subdisposition', 'Registered')
    .gte('created_at', todayStart).lte('created_at', todayEnd);

  // Top performer today
  const { data: performers } = await supabase
    .from('demandcom').select('user_name')
    .gte('created_at', todayStart).lte('created_at', todayEnd);

  const performerCounts: Record<string, number> = {};
  performers?.forEach((p: any) => {
    if (p.user_name) performerCounts[p.user_name] = (performerCounts[p.user_name] || 0) + 1;
  });
  const topPerformer = Object.entries(performerCounts).sort((a, b) => b[1] - a[1])[0];

  // Projects below 50% registration target
  const { data: allocations } = await supabase
    .from('project_demandcom_allocations')
    .select('project_id, registration_target');

  const projectTargets: Record<string, number> = {};
  allocations?.forEach((a: any) => {
    projectTargets[a.project_id] = (projectTargets[a.project_id] || 0) + (a.registration_target || 0);
  });

  let laggingCount = 0;
  for (const [projectId, target] of Object.entries(projectTargets)) {
    if (target > 0) {
      const { count: actual } = await supabase
        .from('demandcom').select('*', { count: 'exact', head: true })
        .eq('latest_subdisposition', 'Registered');
      // Approximate — if overall < 50% of this project's target
      if ((actual || 0) < target * 0.5) laggingCount++;
    }
  }

  // {{1}}=calls, {{2}}=registrations, {{3}}=top performer, {{4}}=top count, {{5}}=lagging
  return [
    String(totalCalls || 0),
    String(registrations || 0),
    topPerformer ? topPerformer[0] : 'N/A',
    topPerformer ? String(topPerformer[1]) : '0',
    String(laggingCount),
  ];
}

async function weeklyPipelineSummary(supabase: any): Promise<string[]> {
  const weekAgo = getISTDaysAgo(7);
  const weekStart = `${weekAgo}T00:00:00+05:30`;

  // New projects this week
  const { count: newProjects } = await supabase
    .from('projects').select('*', { count: 'exact', head: true })
    .gte('created_at', weekStart);

  // Won (closed) this week
  const { data: wonProjects } = await supabase
    .from('projects').select('project_value')
    .eq('status', 'closed')
    .gte('updated_at', weekStart);

  const wonCount = wonProjects?.length || 0;
  const wonValue = wonProjects?.reduce((s: number, p: any) => s + (p.project_value || 0), 0) || 0;

  // Lost this week
  const { data: lostProjects } = await supabase
    .from('projects').select('project_value')
    .eq('status', 'lost')
    .gte('updated_at', weekStart);

  const lostCount = lostProjects?.length || 0;
  const lostValue = lostProjects?.reduce((s: number, p: any) => s + (p.project_value || 0), 0) || 0;

  // Active pipeline
  const { data: pipelineProjects } = await supabase
    .from('projects').select('project_value')
    .in('status', ['pitched', 'in_discussion', 'estimate_shared', 'po_received', 'execution']);

  const pipelineCount = pipelineProjects?.length || 0;
  const pipelineValue = pipelineProjects?.reduce((s: number, p: any) => s + (p.project_value || 0), 0) || 0;

  // {{1}}=new, {{2}}=won(value), {{3}}=lost(value), {{4}}=pipeline count, {{5}}=pipeline value
  return [
    String(newProjects || 0),
    `${wonCount} (${formatCurrency(wonValue)})`,
    `${lostCount} (${formatCurrency(lostValue)})`,
    String(pipelineCount),
    formatCurrency(pipelineValue),
  ];
}

async function weeklyTeamPerformance(supabase: any): Promise<string[]> {
  const weekAgo = getISTDaysAgo(7);
  const weekStart = `${weekAgo}T00:00:00+05:30`;

  // Active users (who logged in or created something this week)
  const { data: activeTeam } = await supabase
    .from('project_team_members').select('user_id')
    .gte('created_at', weekStart);

  const activeUsers = new Set(activeTeam?.map((t: any) => t.user_id) || []).size;

  // Projects per owner
  const { data: projectsByOwner } = await supabase
    .from('projects').select('project_owner, profiles:project_owner(full_name)')
    .in('status', ['pitched', 'in_discussion', 'estimate_shared', 'po_received', 'execution']);

  const ownerCounts: Record<string, number> = {};
  projectsByOwner?.forEach((p: any) => {
    const name = p.profiles?.full_name || 'Unknown';
    ownerCounts[name] = (ownerCounts[name] || 0) + 1;
  });

  const topOwners = Object.entries(ownerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => `${name.split(' ')[0]}:${count}`)
    .join(', ');

  // Unassigned clients
  const { count: unassignedClients } = await supabase
    .from('clients').select('*', { count: 'exact', head: true })
    .is('assigned_to', null);

  // New clients this week
  const { count: newClients } = await supabase
    .from('clients').select('*', { count: 'exact', head: true })
    .gte('created_at', weekStart);

  // {{1}}=active users, {{2}}=top owners breakdown, {{3}}=unassigned, {{4}}=new clients
  return [
    String(activeUsers),
    topOwners || 'N/A',
    String(unassignedClients || 0),
    String(newClients || 0),
  ];
}

async function weeklyOverdueAlert(supabase: any): Promise<string[]> {
  const weekAgo = getISTDaysAgo(7);

  // Projects with no status change in 7+ days
  const { count: staleCount } = await supabase
    .from('projects').select('*', { count: 'exact', head: true })
    .in('status', ['pitched', 'in_discussion', 'estimate_shared', 'po_received', 'execution'])
    .lt('updated_at', `${weekAgo}T00:00:00+05:30`);

  // Projects in execution with no event dates
  const { data: noDateProjects } = await supabase
    .from('projects').select('event_dates')
    .in('status', ['po_received', 'execution'])
    .in('project_type', ['integrated', 'mice']);

  const noEventDates = noDateProjects?.filter(
    (p: any) => !p.event_dates || (Array.isArray(p.event_dates) && p.event_dates.length === 0)
  ).length || 0;

  // Overdue tasks
  const { count: overdueTasks } = await supabase
    .from('project_tasks').select('*', { count: 'exact', head: true })
    .in('status', ['pending', 'in_progress'])
    .lt('due_date', new Date().toISOString());

  // Pending invoices > 30 days
  const thirtyDaysAgo = getISTDaysAgo(30);
  const { count: oldPendingInvoices } = await supabase
    .from('project_quotations').select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
    .lt('created_at', `${thirtyDaysAgo}T00:00:00+05:30`);

  // {{1}}=stale projects, {{2}}=no event dates, {{3}}=overdue tasks, {{4}}=old pending invoices
  return [
    String(staleCount || 0),
    String(noEventDates),
    String(overdueTasks || 0),
    String(oldPendingInvoices || 0),
  ];
}

// ─── Main handler ──────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // Determine which summaries to send
    let body: any = {};
    try { body = await req.json(); } catch { /* empty body for cron */ }
    const summaryType = body.type || 'daily'; // 'daily' | 'weekly'

    // Get WhatsApp settings
    const { data: settings } = await supabase
      .from('whatsapp_settings').select('*')
      .eq('is_active', true).single();

    if (!settings) {
      return new Response(JSON.stringify({ error: 'WhatsApp not configured' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const exotelSid = settings.exotel_sid || Deno.env.get('EXOTEL_SID');
    const exotelApiKey = settings.exotel_api_key || Deno.env.get('EXOTEL_API_KEY');
    const exotelApiToken = settings.exotel_api_token || Deno.env.get('EXOTEL_API_TOKEN');
    const exotelSubdomain = settings.exotel_subdomain || 'api.exotel.com';
    const exotelUrl = `https://${exotelSubdomain}/v2/accounts/${exotelSid}/messages`;
    const authHeader = `Basic ${btoa(`${exotelApiKey}:${exotelApiToken}`)}`;
    const sourceNumber = settings.whatsapp_source_number;

    // Get recipients: managers + admins + super_admins with phone numbers
    const { data: recipients } = await supabase
      .from('user_roles')
      .select('user_id, role, profiles:user_id(full_name, phone)')
      .in('role', ['super_admin', 'admin', 'manager']);

    // Also include s.ray@redefine.in explicitly
    const { data: superAdmin } = await supabase
      .from('profiles').select('id, full_name, phone')
      .eq('email', 's.ray@redefine.in').single();

    const phoneSet = new Set<string>();
    const recipientPhones: string[] = [];

    // Add role-based recipients
    for (const r of (recipients || [])) {
      const phone = (r as any).profiles?.phone;
      if (phone) {
        const normalized = normalizePhoneNumber(phone);
        if (!phoneSet.has(normalized)) {
          phoneSet.add(normalized);
          recipientPhones.push(phone);
        }
      }
    }

    // Ensure super admin is included
    if (superAdmin?.phone) {
      const normalized = normalizePhoneNumber(superAdmin.phone);
      if (!phoneSet.has(normalized)) {
        recipientPhones.push(superAdmin.phone);
      }
    }

    console.log(`Sending ${summaryType} summaries to ${recipientPhones.length} recipients`);

    let results: Array<{ template: string; params: string[] }> = [];

    if (summaryType === 'daily') {
      const [projectParams, cashflowParams, demandcomParams] = await Promise.all([
        dailyProjectSummary(supabase),
        dailyCashflowSummary(supabase),
        dailyDemandcomSummary(supabase),
      ]);
      results = [
        { template: TEMPLATES.daily_project, params: projectParams },
        { template: TEMPLATES.daily_cashflow, params: cashflowParams },
        { template: TEMPLATES.daily_demandcom, params: demandcomParams },
      ];
    } else if (summaryType === 'weekly') {
      const [pipelineParams, teamParams, overdueParams] = await Promise.all([
        weeklyPipelineSummary(supabase),
        weeklyTeamPerformance(supabase),
        weeklyOverdueAlert(supabase),
      ]);
      results = [
        { template: TEMPLATES.weekly_pipeline, params: pipelineParams },
        { template: TEMPLATES.weekly_team, params: teamParams },
        { template: TEMPLATES.weekly_overdue, params: overdueParams },
      ];
    }

    // Send each summary to all recipients
    let sentCount = 0;
    let failCount = 0;
    for (const { template, params } of results) {
      for (const phone of recipientPhones) {
        const ok = await sendTemplateMessage(exotelUrl, authHeader, sourceNumber, phone, template, params);
        if (ok) sentCount++;
        else failCount++;
      }
    }

    // Log to whatsapp_messages for audit
    await supabase.from('whatsapp_messages').insert({
      phone_number: 'system',
      message_content: `[${summaryType} summary] Sent ${results.length} templates to ${recipientPhones.length} recipients. Success: ${sentCount}, Failed: ${failCount}`,
      status: failCount === 0 ? 'sent' : 'partial',
      direction: 'outbound',
      template_name: `${summaryType}_summary_batch`,
      sent_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        type: summaryType,
        templates: results.length,
        recipients: recipientPhones.length,
        sent: sentCount,
        failed: failCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error in wa-manager-summary:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
