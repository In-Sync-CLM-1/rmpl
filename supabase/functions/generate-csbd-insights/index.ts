import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { metrics, fiscalYear } = await req.json();
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    const totalTarget = metrics.reduce((sum: number, m: any) => sum + m.annual_target, 0);
    const totalYTDActual = metrics.reduce((sum: number, m: any) => sum + m.ytd_actual, 0);
    const totalYTDProjection = metrics.reduce((sum: number, m: any) => sum + m.ytd_projection, 0);
    const overallAchievement = ((totalYTDActual / totalTarget) * 100).toFixed(1);

    const topPerformers = metrics
      .sort((a: any, b: any) => b.achievement_percentage - a.achievement_percentage)
      .slice(0, 3)
      .map((m: any) => `${m.full_name}: ${m.achievement_percentage.toFixed(1)}%`);

    const underPerformers = metrics
      .filter((m: any) => m.achievement_percentage < 70)
      .map((m: any) => `${m.full_name}: ${m.achievement_percentage.toFixed(1)}%`);

    const top3Revenue = metrics
      .sort((a: any, b: any) => b.ytd_actual - a.ytd_actual)
      .slice(0, 3)
      .reduce((sum: number, m: any) => sum + m.ytd_actual, 0);
    const revenueConcentration = ((top3Revenue / totalYTDActual) * 100).toFixed(1);

    const prompt = `You are a business intelligence analyst. Analyze this CSBD team performance data for FY ${fiscalYear} and provide strategic insights:

**Overall Metrics:**
- Annual Target: ₹${totalTarget.toFixed(2)}L
- YTD Actual: ₹${totalYTDActual.toFixed(2)}L
- YTD Projection: ₹${totalYTDProjection.toFixed(2)}L
- Overall Achievement: ${overallAchievement}%
- Team Size: ${metrics.length} members
- Revenue Concentration: Top 3 performers account for ${revenueConcentration}% of total revenue

**Top Performers:**
${topPerformers.join('\n')}

**Under-performers (< 70%):**
${underPerformers.length > 0 ? underPerformers.join('\n') : 'None'}

**Monthly Trends:**
${metrics[0]?.monthly_performance.slice(0, 6).map((m: any) =>
  `${m.month}: Projection ₹${m.projection}L, Actual ₹${m.actual}L`
).join('\n')}

Provide 3-4 concise, actionable insights covering:
1. Overall trend analysis and trajectory with focus on diversification risk if revenue concentration is high (>60%)
2. Key risks or opportunities including client dependency and team concentration
3. Specific team member recommendations for performance improvement
4. Projected year-end outcome if current trends continue

Keep each insight to 2-3 sentences. Be specific and data-driven. If revenue is highly concentrated, flag it as a risk.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: "You are a business intelligence analyst providing concise, actionable insights on sales performance data. Focus on trends, risks, and opportunities.",
        messages: [
          { role: "user", content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("Anthropic API error:", response.status, errorText);
      throw new Error("Anthropic API error");
    }

    const data = await response.json();
    const insights = data.content[0].text;

    return new Response(
      JSON.stringify({ insights }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating insights:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
