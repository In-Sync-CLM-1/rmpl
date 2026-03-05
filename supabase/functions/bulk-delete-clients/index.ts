import { corsHeaders, handleCorsPreflightRequest } from '../_shared/cors-headers.ts';
import { createSupabaseClient } from '../_shared/supabase-client.ts';
import { verifyAuth } from '../_shared/auth-helpers.ts';
import { errorResponse, successResponse } from '../_shared/response-helpers.ts';

const BATCH_SIZE = 5000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest();
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const { authenticated, user, error: authError } = await verifyAuth(authHeader);

    if (!authenticated || !user) {
      console.error('Authentication failed:', authError);
      return errorResponse('Unauthorized', 401);
    }

    console.log('Authenticated user:', user.id);

    // Check if user has permission to delete clients
    const supabase = createSupabaseClient(authHeader);
    const { data: rolesData, error: rolesError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (rolesError) {
      console.error('Error fetching roles:', rolesError);
      return errorResponse('Failed to verify permissions', 500);
    }

    const roles = rolesData?.map(r => r.role) || [];
    const canDelete = roles.some(role => 
      ['platform_admin', 'super_admin', 'admin', 'manager'].includes(role)
    );

    if (!canDelete) {
      console.error('User does not have permission to delete clients');
      return errorResponse('Insufficient permissions to delete clients', 403);
    }

    const { recordIds, accumulated_count = 0, current_offset = 0, is_continuation = false } = await req.json();

    if (!recordIds || !Array.isArray(recordIds) || recordIds.length === 0) {
      return errorResponse('Invalid request: recordIds array is required', 400);
    }

    if (!is_continuation) {
      console.log(`User ${user.id} starting delete for ${recordIds.length} clients`);
    } else {
      console.log(`Continuing delete, offset: ${current_offset}, accumulated: ${accumulated_count}`);
    }

    // Use service role client for deletion via PostgreSQL function
    const serviceSupabase = createSupabaseClient();
    
    // Call batched PostgreSQL function
    const { data, error } = await serviceSupabase.rpc('bulk_delete_clients_batch', {
      p_record_ids: recordIds,
      p_batch_size: BATCH_SIZE,
      p_offset: current_offset,
    });

    if (error) {
      console.error('Error calling bulk_delete_clients_batch:', error);
      return errorResponse(`Failed to delete records: ${error.message}`, 500);
    }

    const batchDeleted = Number(data?.[0]?.deleted_count ?? 0);
    const hasMore = data?.[0]?.has_more ?? false;
    const nextOffset = Number(data?.[0]?.next_offset ?? 0);
    const totalDeleted = accumulated_count + batchDeleted;

    console.log(`Batch deleted: ${batchDeleted}, Total: ${totalDeleted}, Has more: ${hasMore}`);

    // If more records remain, call self to continue
    if (hasMore) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const selfUrl = `${supabaseUrl}/functions/v1/bulk-delete-clients`;
      
      // Fire-and-forget self-call for next batch
      fetch(selfUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader!,
        },
        body: JSON.stringify({
          recordIds,
          accumulated_count: totalDeleted,
          current_offset: nextOffset,
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
    console.log(`Bulk delete completed. Total deleted: ${totalDeleted}`);

    return successResponse({
      message: 'Bulk delete completed',
      successCount: totalDeleted,
      errorCount: 0,
      status: 'completed',
      hasMore: false,
    });

  } catch (error) {
    console.error('Bulk delete error:', error);
    return errorResponse(
      'Internal server error',
      500,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
});
