import { createAuthenticatedClient } from '../_shared/supabase-client.ts';
import { corsHeaders, handleCorsPreflightRequest } from '../_shared/cors-headers.ts';
import { verifyAuth } from '../_shared/auth-helpers.ts';
import { errorResponse } from '../_shared/response-helpers.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest();
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const { authenticated, error: authError } = await verifyAuth(authHeader);

    if (!authenticated) {
      return errorResponse(authError || 'Unauthorized', 401);
    }

    const supabase = createAuthenticatedClient(authHeader!);
    const url = new URL(req.url);
    const jobId = url.searchParams.get('jobId');

    if (!jobId) {
      return errorResponse('Job ID is required', 400);
    }

    const { data: job, error: jobError } = await supabase
      .from('export_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError) {
      console.error('Error fetching job:', jobError);
      return errorResponse('Job not found', 404, jobError);
    }

    return new Response(
      JSON.stringify(job),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return errorResponse('Internal server error', 500, error);
  }
});
