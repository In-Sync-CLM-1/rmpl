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
    const { authenticated, user, error: authError } = await verifyAuth(authHeader);

    if (!authenticated || !user) {
      return errorResponse(authError || 'Unauthorized', 401);
    }

    const userId = user.id;
    const supabase = createAuthenticatedClient(authHeader!);
    const { source, filters } = await req.json();

    if (!source) {
      return errorResponse('Data source is required', 400);
    }

    console.log(`Creating export job for user ${userId}, source: ${source}`);

    // Create export job
    const { data: job, error: jobError } = await supabase
      .from('export_jobs')
      .insert({
        user_id: userId,
        source,
        filters,
        status: 'pending'
      })
      .select()
      .single();

    if (jobError) {
      console.error('Error creating export job:', jobError);
      return errorResponse('Failed to create export job', 500, jobError);
    }

    console.log(`Export job created: ${job.id}`);

    // Trigger background processing
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    // Fire and forget - trigger the processor
    fetch(`${supabaseUrl}/functions/v1/process-export-job`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`
      },
      body: JSON.stringify({ jobId: job.id })
    }).catch(err => console.error('Failed to trigger processor:', err));

    return new Response(
      JSON.stringify({
        jobId: job.id,
        status: 'pending',
        message: 'Export job created successfully. Processing will begin shortly.'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 201
      }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return errorResponse('Internal server error', 500, error);
  }
});
