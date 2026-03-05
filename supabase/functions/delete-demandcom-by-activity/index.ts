import { createAuthenticatedClient } from '../_shared/supabase-client.ts';
import { createSupabaseClient } from '../_shared/supabase-client.ts';
import { verifyAuth } from '../_shared/auth-helpers.ts';
import { corsHeaders } from '../_shared/cors-headers.ts';
import { successResponse, errorResponse, unauthorizedResponse } from '../_shared/response-helpers.ts';

const BATCH_SIZE = 5000;

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    const { authenticated, user } = await verifyAuth(authHeader);

    if (!authenticated || !user) {
      return unauthorizedResponse('Authentication required');
    }

    // Get user roles and email
    const supabase = createAuthenticatedClient(authHeader!);
    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const roles = rolesData?.map((r) => r.role) || [];
    
    // Check authorization: special user email OR admin role
    const isSpecialUser = user.email === 'jatinder.mahajan@redefine.in';
    const isAdmin = roles.some((role) =>
      ['platform_admin', 'super_admin', 'admin_administration', 'admin_tech', 'admin'].includes(role)
    );

    if (!isSpecialUser && !isAdmin) {
      console.log(`Unauthorized delete attempt by user ${user.email}`);
      return unauthorizedResponse('Insufficient permissions for bulk delete');
    }

    // Parse request body
    const { activity_name, accumulated_count = 0, is_continuation = false } = await req.json();

    if (!activity_name || typeof activity_name !== 'string') {
      return errorResponse('Invalid request: activity_name is required', 400);
    }

    if (!is_continuation) {
      console.log(`User ${user.email} (${user.id}) starting delete for activity: ${activity_name}`);
    } else {
      console.log(`Continuing delete for activity: ${activity_name}, accumulated: ${accumulated_count}`);
    }

    // Use service role for deletion via PostgreSQL function
    const adminSupabase = createSupabaseClient(authHeader);

    // Call batched PostgreSQL function
    const { data, error } = await adminSupabase.rpc('delete_demandcom_by_activity_batch', {
      p_activity_name: activity_name,
      p_batch_size: BATCH_SIZE,
    });

    if (error) {
      console.error('Error calling delete_demandcom_by_activity_batch:', error);
      return errorResponse(`Failed to delete records: ${error.message}`, 500);
    }

    const batchDeleted = Number(data?.[0]?.deleted_count ?? 0);
    const hasMore = data?.[0]?.has_more ?? false;
    const totalDeleted = accumulated_count + batchDeleted;

    console.log(`Batch deleted: ${batchDeleted}, Total: ${totalDeleted}, Has more: ${hasMore}`);

    // If more records remain, call self to continue
    if (hasMore) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const selfUrl = `${supabaseUrl}/functions/v1/delete-demandcom-by-activity`;
      
      // Fire-and-forget self-call for next batch
      fetch(selfUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader!,
        },
        body: JSON.stringify({
          activity_name,
          accumulated_count: totalDeleted,
          is_continuation: true,
        }),
      }).catch((err) => console.error('Self-chain call failed:', err));

      return successResponse({
        message: `Deleted ${batchDeleted} records, continuing...`,
        successCount: totalDeleted,
        status: 'in_progress',
        hasMore: true,
      });
    }

    // All done
    console.log(`Completed delete for activity: ${activity_name}. Total deleted: ${totalDeleted}`);
    
    return successResponse({
      message: `Bulk delete completed for activity_name: ${activity_name}`,
      successCount: totalDeleted,
      errorCount: 0,
      totalRequested: totalDeleted,
      status: 'completed',
      hasMore: false,
    });

  } catch (error) {
    console.error('Bulk delete error:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to delete records',
      500
    );
  }
});
