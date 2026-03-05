import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[INIT] Starting admin delete users function');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error('[AUTH] Authentication failed:', authError?.message);
      throw new Error('Unauthorized');
    }

    // Check if user has admin permissions
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (rolesError) {
      console.error('[AUTH] Failed to fetch user roles:', rolesError.message);
      throw new Error('Failed to verify permissions');
    }

    const roles = userRoles?.map(r => r.role) || [];
    const isAdmin = roles.some(role => 
      ['platform_admin', 'admin', 'super_admin', 'admin_administration', 'admin_tech'].includes(role)
    );

    if (!isAdmin) {
      console.error('[AUTH] User lacks admin permissions');
      throw new Error('Insufficient permissions - admin role required');
    }

    const { userIds } = await req.json();

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      throw new Error('userIds must be a non-empty array');
    }

    console.log(`[DELETE] Deleting ${userIds.length} users from import job`);

    let successCount = 0;
    let errorCount = 0;
    const errors: any[] = [];

    // Delete each user from auth
    for (const userId of userIds) {
      try {
        console.log(`[DELETE] Starting deletion for user ${userId}`);

        // Check if user is a project owner - prevent deletion to maintain data integrity
        const { count: ownedProjectsCount, error: projectsError } = await supabase
          .from('projects')
          .select('*', { count: 'exact', head: true })
          .eq('project_owner', userId);

        if (projectsError) {
          console.error(`[DELETE] Failed to check projects for user ${userId}:`, projectsError);
        }

        if ((ownedProjectsCount || 0) > 0) {
          const message = 'Cannot delete user because they are the owner of one or more projects. Please reassign those projects first.';
          console.warn(`[DELETE] ${message} User: ${userId}, projects: ${ownedProjectsCount}`);
          errorCount++;
          errors.push({ userId, error: message });
          continue;
        }
        
        // Delete all related records using PostgreSQL function (faster than individual deletes)
        const { error: relatedDataError } = await supabase.rpc('delete_user_related_data', {
          p_user_id: userId,
        });

        if (relatedDataError) {
          console.error(`[DELETE] Failed to delete related data for ${userId}:`, relatedDataError);
          // Continue anyway - we'll try to delete the auth user
        }
        
        // Now delete from auth.users
        const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
        
        if (deleteError) {
          console.error(`[DELETE] Failed to delete user ${userId} from auth:`, deleteError);
          errorCount++;
          errors.push({ userId, error: deleteError.message });
        } else {
          console.log(`[DELETE] Successfully deleted user ${userId}`);
          successCount++;
        }
      } catch (error) {
        console.error(`[DELETE] Error deleting user ${userId}:`, error);
        errorCount++;
        errors.push({ userId, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    console.log(`[COMPLETE] Deletion finished: ${successCount} success, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        successCount,
        errorCount,
        errors: errors.length > 0 ? errors : undefined
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[ERROR] Failed to delete users:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error instanceof Error ? error.stack : undefined
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});