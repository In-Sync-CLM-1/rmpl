import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { submission_id } = await req.json();
    if (!submission_id) {
      return new Response(JSON.stringify({ error: 'Missing submission_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: submission } = await supabase
      .from('onboarding_submissions')
      .select('*')
      .eq('id', submission_id)
      .single();

    if (!submission) {
      return new Response(JSON.stringify({ error: 'Submission not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: documents } = await supabase
      .from('onboarding_documents')
      .select('*')
      .eq('submission_id', submission_id);

    const docSummary = (documents || []).map(d =>
      `- ${d.document_type}: ${d.file_name} (${d.file_size ? Math.round(d.file_size / 1024) + 'KB' : 'unknown size'})`
    ).join('\n');

    const prompt = `You are an HR document verification specialist. Analyze this onboarding submission for potential fraud or inconsistencies.

Submission Details:
- Name: ${submission.full_name}
- PAN: ${submission.pan_number || 'Not provided'}
- Aadhaar: ${submission.aadhar_number || 'Not provided'}
- Email: ${submission.personal_email}
- Phone: ${submission.contact_number}
- Bank: ${submission.bank_name || 'Not provided'}, Account: ${submission.account_number || 'Not provided'}, IFSC: ${submission.ifsc_code || 'Not provided'}

Documents Uploaded:
${docSummary || 'No documents uploaded'}

Analyze for:
1. PAN format validity (should be ABCDE1234F pattern)
2. Aadhaar format validity (should be 12 digits)
3. IFSC format validity (should be ABCD0123456)
4. Name consistency across documents
5. Missing critical documents
6. Any red flags or inconsistencies`;

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: 'You are an HR document verification AI. Always respond using the provided tool.',
        tools: [{
          name: 'document_analysis',
          description: 'Return structured document analysis results',
          input_schema: {
            type: 'object',
            properties: {
              risk_score: { type: 'number', description: 'Risk score 0-100' },
              findings: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    category: { type: 'string' },
                    severity: { type: 'string', enum: ['low', 'medium', 'high'] },
                    description: { type: 'string' },
                  },
                  required: ['category', 'severity', 'description'],
                },
              },
              recommendation: { type: 'string', enum: ['approve', 'review', 'reject'] },
              summary: { type: 'string' },
            },
            required: ['risk_score', 'findings', 'recommendation', 'summary'],
          },
        }],
        tool_choice: { type: 'tool', name: 'document_analysis' },
        messages: [
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded, please try again later.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      throw new Error('Anthropic API error');
    }

    const aiData = await aiResponse.json();
    let analysis;

    try {
      const toolUse = aiData.content?.find((c: any) => c.type === 'tool_use');
      if (toolUse) {
        analysis = toolUse.input;
      } else {
        const textBlock = aiData.content?.find((c: any) => c.type === 'text');
        const content = textBlock?.text || '';
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { risk_score: 50, findings: [], recommendation: 'review', summary: 'Unable to parse AI response' };
      }
    } catch {
      analysis = { risk_score: 50, findings: [], recommendation: 'review', summary: 'AI analysis could not be parsed' };
    }

    const serviceSupabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    await serviceSupabase
      .from('onboarding_submissions')
      .update({
        ai_review_result: analysis,
        ai_review_at: new Date().toISOString(),
        status: 'documents_under_review',
      })
      .eq('id', submission_id);

    return new Response(
      JSON.stringify({ success: true, analysis }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('analyze-onboarding-document error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Analysis failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
