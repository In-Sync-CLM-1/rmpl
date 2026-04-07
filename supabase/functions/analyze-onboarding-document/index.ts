import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import {
  groqStructuredResponse,
  GroqApiError,
} from "../_shared/groq.ts";

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

    let analysis;
    try {
      analysis = await groqStructuredResponse<{
        risk_score: number;
        findings: Array<{
          category: string;
          severity: 'low' | 'medium' | 'high';
          description: string;
        }>;
        recommendation: 'approve' | 'review' | 'reject';
        summary: string;
      }>({
        instructions: 'You are an HR document verification AI. Analyze the onboarding submission and return only JSON matching the schema.',
        input: prompt,
        schemaName: 'document_analysis',
        schema: {
          type: 'object',
          properties: {
            risk_score: { type: 'number' },
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
      });
    } catch (error) {
      if (error instanceof GroqApiError && error.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded, please try again later.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      throw error;
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
  } catch (error) {
    console.error('analyze-onboarding-document error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Analysis failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
