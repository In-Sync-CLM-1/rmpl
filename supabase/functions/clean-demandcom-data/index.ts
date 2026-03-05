import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { corsHeaders } from '../_shared/cors-headers.ts';

const BATCH_SIZE = 5000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has admin role
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isAdmin = roles?.some(r => 
      ['admin', 'super_admin', 'platform_admin'].includes(r.role)
    );

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Only admins can clean the demandcom table' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body for continuation
    let accumulated_count = 0;
    let is_continuation = false;
    
    try {
      const body = await req.json();
      accumulated_count = body.accumulated_count || 0;
      is_continuation = body.is_continuation || false;
    } catch {
      // No body or invalid JSON, start fresh
    }

    if (!is_continuation) {
      console.log(`Admin ${user.email} is starting to clean demandcom table`);
    } else {
      console.log(`Continuing clean, accumulated: ${accumulated_count}`);
    }

    // Call batched PostgreSQL function
    const { data, error } = await supabase.rpc('clean_all_demandcom_batch', {
      p_batch_size: BATCH_SIZE,
    });

    if (error) {
      console.error('Error calling clean_all_demandcom_batch:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const batchDeleted = Number(data?.[0]?.deleted_count ?? 0);
    const hasMore = data?.[0]?.has_more ?? false;
    const totalDeleted = accumulated_count + batchDeleted;

    console.log(`Batch deleted: ${batchDeleted}, Total: ${totalDeleted}, Has more: ${hasMore}`);

    // If more records remain, call self to continue
    if (hasMore) {
      const selfUrl = `${supabaseUrl}/functions/v1/clean-demandcom-data`;
      
      // Fire-and-forget self-call for next batch
      fetch(selfUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify({
          accumulated_count: totalDeleted,
          is_continuation: true,
        }),
      }).catch((err) => console.error('Self-chain call failed:', err));

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Deleted ${batchDeleted} records, continuing...`,
          deletedCount: totalDeleted,
          status: 'in_progress',
          hasMore: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // All done
    console.log(`Completed clean. Total deleted: ${totalDeleted}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Successfully deleted all demandcom records`,
        deletedCount: totalDeleted,
        status: 'completed',
        hasMore: false,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in clean-demandcom-data:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
