import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors-headers.ts';

interface MonthlyMetrics {
  month: string;
  projection: number;
  actual: number;
  variance: number;
  over_under_percentage: number;
}

interface CSBDMetrics {
  user_id: string;
  full_name: string;
  email: string;
  annual_target: number;
  ytd_projection: number;
  ytd_actual: number;
  ytd_variance: number;
  achievement_percentage: number;
  projection_fulfilment_percentage: number;
  monthly_performance: MonthlyMetrics[];
  has_subordinates: boolean;
  team_metrics?: CSBDMetrics[];
}

interface CreditAllocation {
  created_by_user_id: string;
  credit_to_user_id: string;
  percentage: number;
}

function getUserIdFromJwt(authHeader: string | null): string | null {
  if (!authHeader) return null;
  try {
    const token = authHeader.replace('Bearer ', '');
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload.sub || null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const callerUserId = getUserIdFromJwt(authHeader);
    if (!callerUserId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // Use service role client for data access
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { user_id, fiscal_year = 2025, include_team = false } = await req.json();

    const metricsUserId = user_id || callerUserId;

    const yearStart = new Date(fiscal_year, 0, 1);
    const yearEnd = new Date(fiscal_year, 11, 31);
    const today = new Date();
    const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const allYearMonths: Date[] = [];
    let current = new Date(yearStart);
    for (let i = 0; i < 12; i++) {
      allYearMonths.push(new Date(current));
      current.setMonth(current.getMonth() + 1);
    }

    // Fetch credit allocation rules once
    const { data: creditRules } = await supabaseClient
      .from('csbd_credit_allocations')
      .select('created_by_user_id, credit_to_user_id, percentage');

    const creditAllocations: CreditAllocation[] = creditRules || [];

    const metrics = await calculateUserMetrics(supabaseClient, metricsUserId, fiscal_year, allYearMonths, currentMonth, creditAllocations);

    if (include_team && metrics.has_subordinates) {
      const teamMetrics = await calculateTeamMetrics(supabaseClient, metricsUserId, fiscal_year, allYearMonths, currentMonth, creditAllocations);
      metrics.team_metrics = teamMetrics;
    }

    return new Response(JSON.stringify(metrics), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('Error calculating CSBD metrics:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Unknown error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

async function calculateUserMetrics(
  supabase: any,
  userId: string,
  fiscalYear: number,
  allYearMonths: Date[],
  currentMonth: Date,
  creditAllocations: CreditAllocation[]
): Promise<CSBDMetrics> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', userId)
    .single();

  const { data: target } = await supabase
    .from('csbd_targets')
    .select('*')
    .eq('user_id', userId)
    .eq('fiscal_year', fiscalYear)
    .maybeSingle();

  if (!target) {
    return {
      user_id: userId,
      full_name: profile?.full_name || 'Unknown',
      email: profile?.email || '',
      annual_target: 0,
      ytd_projection: 0,
      ytd_actual: 0,
      ytd_variance: 0,
      achievement_percentage: 0,
      projection_fulfilment_percentage: 0,
      monthly_performance: allYearMonths.map(month => ({
        month: month.toISOString().split('T')[0].substring(0, 7),
        projection: 0,
        actual: 0,
        variance: 0,
        over_under_percentage: 0,
      })),
      has_subordinates: false,
    };
  }

  const { data: projections } = await supabase
    .from('csbd_projections')
    .select('*')
    .eq('user_id', userId)
    .gte('month', allYearMonths[0].toISOString().split('T')[0])
    .lte('month', allYearMonths[allYearMonths.length - 1].toISOString().split('T')[0]);

  // Determine which user IDs we need actuals for
  let userIdsForActuals = [userId];

  if (target.has_subordinates) {
    const { data: subordinateIds } = await supabase.rpc('get_all_subordinate_ids', { 
      manager_id: userId 
    });
    if (subordinateIds && subordinateIds.length > 0) {
      userIdsForActuals = [userId, ...subordinateIds];
    }
  }

  // For credit allocation: find all creators whose projects should give credit to this user
  const creditRulesForUser = creditAllocations.filter(r => r.credit_to_user_id === userId);
  const creatorsGivingCredit = creditRulesForUser.map(r => r.created_by_user_id);
  
  // Also find if this user has rules as creator (meaning they share credit)
  const userAsCreatorRules = creditAllocations.filter(r => r.created_by_user_id === userId);
  const userHasCreatorRules = userAsCreatorRules.length > 0;
  
  // Build set of all user IDs we need actuals for
  const allUserIdsForActuals = new Set(userIdsForActuals);
  for (const creatorId of creatorsGivingCredit) {
    allUserIdsForActuals.add(creatorId);
  }

  const { data: actuals } = await supabase
    .from('csbd_actuals')
    .select('*')
    .in('user_id', Array.from(allUserIdsForActuals))
    .gte('month', allYearMonths[0].toISOString())
    .lte('month', currentMonth.toISOString());

  // Build the team member set (user + subordinates) for distinguishing internal vs external credit
  const teamMemberSet = new Set(userIdsForActuals);

  // Build monthly performance
  const monthlyPerformance: MonthlyMetrics[] = allYearMonths.map(month => {
    const monthStr = month.toISOString().split('T')[0];
    const projection = projections?.find((p: any) => p.month === monthStr);
    
    let actualAmount = 0;

    // Step 1: Gather "team actuals" = own actuals + subordinate actuals (raw)
    const teamActuals = actuals?.filter((a: any) => {
      const actualMonth = new Date(a.month).toISOString().split('T')[0];
      return actualMonth === monthStr && teamMemberSet.has(a.user_id);
    }) || [];
    let teamTotal = teamActuals.reduce((sum: number, a: any) => sum + (a.actual_amount_inr_lacs || 0), 0);

    // Step 2: Apply self-percentage if this user has creator rules
    if (userHasCreatorRules) {
      const selfRule = userAsCreatorRules.find(r => r.credit_to_user_id === userId);
      const selfPercentage = selfRule ? selfRule.percentage : 
        (100 - userAsCreatorRules.reduce((s, r) => s + r.percentage, 0));
      teamTotal = teamTotal * (selfPercentage / 100);
    }
    
    actualAmount = teamTotal;

    // Step 3: Add credit from EXTERNAL creators (not in this user's team)
    for (const rule of creditRulesForUser) {
      if (teamMemberSet.has(rule.created_by_user_id)) continue; // skip team members
      const creatorActuals = actuals?.filter((a: any) => {
        const actualMonth = new Date(a.month).toISOString().split('T')[0];
        return actualMonth === monthStr && a.user_id === rule.created_by_user_id;
      }) || [];
      const creatorTotal = creatorActuals.reduce((sum: number, a: any) => sum + (a.actual_amount_inr_lacs || 0), 0);
      actualAmount += creatorTotal * (rule.percentage / 100);
    }

    const projectionAmount = projection?.projection_amount_inr_lacs || 0;
    const variance = actualAmount - projectionAmount;
    const overUnder = projectionAmount > 0 ? (variance / projectionAmount) * 100 : 0;

    return {
      month: monthStr,
      projection: projectionAmount,
      actual: actualAmount,
      variance,
      over_under_percentage: overUnder,
    };
  });

  const ytdProjection = monthlyPerformance.reduce((sum, m) => sum + m.projection, 0);
  const ytdActual = monthlyPerformance.reduce((sum, m) => sum + m.actual, 0);
  const ytdVariance = ytdActual - ytdProjection;
  const achievementPercentage = target.annual_target_inr_lacs > 0
    ? (ytdActual / target.annual_target_inr_lacs) * 100
    : 0;
  const projectionFulfilment = ytdProjection > 0
    ? (ytdActual / ytdProjection) * 100
    : 0;

  return {
    user_id: userId,
    full_name: profile?.full_name || '',
    email: profile?.email || '',
    annual_target: target.annual_target_inr_lacs,
    ytd_projection: ytdProjection,
    ytd_actual: ytdActual,
    ytd_variance: ytdVariance,
    achievement_percentage: achievementPercentage,
    projection_fulfilment_percentage: projectionFulfilment,
    monthly_performance: monthlyPerformance,
    has_subordinates: target.has_subordinates,
  };
}

async function calculateTeamMetrics(
  supabase: any,
  managerId: string,
  fiscalYear: number,
  allYearMonths: Date[],
  currentMonth: Date,
  creditAllocations: CreditAllocation[]
): Promise<CSBDMetrics[]> {
  const { data: subordinates } = await supabase
    .from('profiles')
    .select('id, csbd_targets!inner(user_id, is_active)')
    .eq('reports_to', managerId)
    .eq('csbd_targets.fiscal_year', fiscalYear)
    .eq('csbd_targets.is_active', true);

  if (!subordinates || subordinates.length === 0) {
    return [];
  }

  const teamMetrics = await Promise.all(
    subordinates.map((sub: any) => calculateUserMetrics(supabase, sub.id, fiscalYear, allYearMonths, currentMonth, creditAllocations))
  );

  return teamMetrics.filter(Boolean);
}

