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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Verify the caller's session
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: caller }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !caller) {
      throw new Error('Unauthorized');
    }

    // Check if caller has admin permissions
    const { data: callerRoles, error: roleError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id);

    if (roleError) {
      throw new Error('Failed to check permissions');
    }

    const hasAdminRole = callerRoles?.some(r => 
      ['platform_admin', 'super_admin', 'admin_administration', 'admin_tech', 'admin'].includes(r.role)
    );

    if (!hasAdminRole) {
      throw new Error('Insufficient permissions');
    }

    // Parse request body
    const {
      user_id,
      full_name,
      email,
      phone,
      reports_to,
      designation_id,
      team_id,
    } = await req.json();

    console.log('Updating user profile:', { user_id, designation_id, team_id });

    // Update profiles table
    const { error: profileError } = await supabaseClient
      .from('profiles')
      .update({
        full_name,
        email,
        phone,
        reports_to: reports_to || null,
      })
      .eq('id', user_id);

    if (profileError) {
      console.error('Profile update error:', profileError);
      throw new Error(`Failed to update profile: ${profileError.message}`);
    }

    // Handle designation update
    if (designation_id) {
      // Mark all current designations as not current
      const { error: markError } = await supabaseClient
        .from('user_designations')
        .update({ is_current: false })
        .eq('user_id', user_id)
        .eq('is_current', true);

      if (markError) {
        console.error('Error marking old designations:', markError);
      }

      // Check if this designation already exists for the user
      const { data: existingDesignation, error: checkError } = await supabaseClient
        .from('user_designations')
        .select('*')
        .eq('user_id', user_id)
        .eq('designation_id', designation_id)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking existing designation:', checkError);
        throw new Error(`Failed to check designation: ${checkError.message}`);
      }

      if (existingDesignation) {
        // Update existing record to make it current
        const { error: updateError } = await supabaseClient
          .from('user_designations')
          .update({ is_current: true })
          .eq('user_id', user_id)
          .eq('designation_id', designation_id);

        if (updateError) {
          console.error('Designation update error:', updateError);
          throw new Error(`Failed to update designation: ${updateError.message}`);
        }
        console.log('Updated existing designation to current');
      } else {
        // Insert new designation
        const { error: insertDesignationError } = await supabaseClient
          .from('user_designations')
          .insert({
            user_id,
            designation_id,
            is_current: true,
          });

        if (insertDesignationError) {
          console.error('Designation insert error:', insertDesignationError);
          throw new Error(`Failed to insert designation: ${insertDesignationError.message}`);
        }
        console.log('Inserted new designation');
      }
    }

    // Handle team update
    if (team_id) {
      // Mark all current team memberships as inactive
      const { error: markTeamError } = await supabaseClient
        .from('team_members')
        .update({ is_active: false })
        .eq('user_id', user_id)
        .eq('is_active', true);

      if (markTeamError) {
        console.error('Error marking old team memberships:', markTeamError);
      }

      // Check if this team membership already exists for the user
      const { data: existingTeamMember, error: checkTeamError } = await supabaseClient
        .from('team_members')
        .select('*')
        .eq('user_id', user_id)
        .eq('team_id', team_id)
        .maybeSingle();

      if (checkTeamError) {
        console.error('Error checking existing team membership:', checkTeamError);
        throw new Error(`Failed to check team membership: ${checkTeamError.message}`);
      }

      if (existingTeamMember) {
        // Update existing record to make it active
        const { error: updateTeamError } = await supabaseClient
          .from('team_members')
          .update({ is_active: true })
          .eq('user_id', user_id)
          .eq('team_id', team_id);

        if (updateTeamError) {
          console.error('Team update error:', updateTeamError);
          throw new Error(`Failed to update team membership: ${updateTeamError.message}`);
        }
        console.log('Updated existing team membership to active');
      } else {
        // Insert new team membership
        const { error: insertTeamError } = await supabaseClient
          .from('team_members')
          .insert({
            team_id,
            user_id,
            is_active: true,
          });

        if (insertTeamError) {
          console.error('Team insert error:', insertTeamError);
          throw new Error(`Failed to insert team membership: ${insertTeamError.message}`);
        }
        console.log('Inserted new team membership');
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: 'User profile updated successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in update-user-profile:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: errorMessage === 'Unauthorized' || errorMessage === 'Insufficient permissions' ? 403 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
