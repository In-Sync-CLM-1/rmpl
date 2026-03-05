import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Version tracking for deployment verification
const FUNCTION_VERSION = '2.0.0';

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log(`[FUNCTION_VERSION] Running admin-create-user v${FUNCTION_VERSION}`);
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get the authorization header to verify the calling user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verify the calling user is authenticated
    const { data: { user: callingUser }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !callingUser) {
      throw new Error('Unauthorized');
    }

    console.log('[AUTH] User creation request from:', callingUser.email);
    console.log('[AUTH] User ID:', callingUser.id);

    // Check if calling user has permission to create users
    const { data: roles, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', callingUser.id);

    if (roleError) {
      console.error('Error fetching roles:', roleError);
      throw new Error('Failed to verify permissions');
    }

    const userRoles = roles?.map((r: any) => r.role) || [];
    console.log('[PERMISSION_CHECK] User roles:', userRoles);
    
    // List of roles that can create users
    const allowedRoles = ['platform_admin', 'super_admin', 'admin_administration', 'admin_tech', 'admin'];
    
    const hasPermission = userRoles.some((role: string) => allowedRoles.includes(role));
    
    console.log('[PERMISSION_CHECK] Has permission:', hasPermission);
    console.log('[PERMISSION_CHECK] Allowed roles:', allowedRoles);

    if (!hasPermission) {
      console.error('[PERMISSION_DENIED] User lacks permission. User roles:', userRoles, 'Allowed roles:', allowedRoles);
      throw new Error('Insufficient permissions to create users');
    }
    
    console.log('[PERMISSION_GRANTED] User has permission to create users');

    const { email, password, full_name, role, designation_id, reports_to, team_id, phone } = await req.json();

    console.log('Creating user:', email, 'with role:', role);

    // Create user with admin client
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name }
    });

    if (createError) {
      console.error('Error creating user:', createError);
      throw createError;
    }

    console.log('User created successfully:', userData.user.id);

    // Remove ALL auto-assigned roles (trigger assigns 'agent' by default)
    const { error: deleteRoleError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', userData.user.id);

    if (deleteRoleError) {
      console.error('Error removing auto-assigned roles:', deleteRoleError);
    } else {
      console.log('Removed auto-assigned roles');
    }

    // Assign selected role
    const { error: roleInsertError } = await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: userData.user.id, role });

    if (roleInsertError) {
      console.error('Error assigning role:', roleInsertError);
      throw new Error('Failed to assign role: ' + roleInsertError.message);
    }

    console.log('Role assigned:', role);

    // Assign designation if provided
    if (designation_id) {
      const { error: desError } = await supabaseAdmin
        .from('user_designations')
        .insert({
          user_id: userData.user.id,
          designation_id,
          assigned_by: callingUser.id
        });
      
      if (desError) {
        console.error('Error assigning designation:', desError);
      }
    }

    // Update reports_to and phone if provided
    const profileUpdates: { reports_to?: string; phone?: string } = {};
    if (reports_to) profileUpdates.reports_to = reports_to;
    if (phone) profileUpdates.phone = phone;
    
    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update(profileUpdates)
        .eq('id', userData.user.id);
      
      if (profileError) {
        console.error('Error updating profile:', profileError);
      }
    }

    // Assign to team if provided
    if (team_id) {
      const { error: teamError } = await supabaseAdmin
        .from('team_members')
        .insert({
          user_id: userData.user.id,
          team_id,
          role_in_team: 'member'
        });
      
      if (teamError) {
        console.error('Error assigning team:', teamError);
      }
    }

    console.log('User setup completed successfully');

    return new Response(
      JSON.stringify({ success: true, user: userData.user }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Edge function error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
