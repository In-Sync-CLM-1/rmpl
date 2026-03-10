import { corsHeaders } from '../_shared/cors-headers.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { metrics } = await req.json();

    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }

    console.log('Generating DemandCom insights for metrics:', metrics);

    const systemPrompt = `You are an expert telecalling operations analyst. Analyze DemandCom tagging performance and provide actionable insights.`;

    const userPrompt = `Analyze this DemandCom telecalling data:

**Overview:**
- Total Accounts: ${metrics.totalAccounts}
- Tagged Accounts: ${metrics.taggedAccounts} (${metrics.taggedPercentage}%)
- New This Month: ${metrics.newThisMonth}
- Assigned Rate: ${metrics.assignedPercentage}%

**Disposition Breakdown:**
${metrics.dispositionBreakdown?.map((d: any) => `- ${d.disposition}: ${d.count} (${d.percentage}%)`).join('\n')}

**Top Performing Agents:**
${metrics.topAgents?.map((a: any, i: number) => `${i + 1}. ${a.name}: ${a.taggedCount}/${a.totalAssigned} tagged (${a.efficiency}%)`).join('\n')}

**Activity Performance:**
${metrics.activityStats?.map((a: any) => `- ${a.activity}: ${a.taggedCount}/${a.totalCount} (${a.rate}%)`).join('\n')}

Provide 3-4 brief, actionable insights focusing on:
1. Tagging velocity trends and efficiency
2. Data quality (validation rates)
3. Agent productivity patterns and recommendations
4. Activity/project focus areas

Keep each insight to 1-2 sentences. Be specific and action-oriented.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', response.status, errorText);
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const insights = data.content[0].text;

    console.log('Generated insights successfully');

    return new Response(
      JSON.stringify({ insights }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error generating insights:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to generate insights',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
