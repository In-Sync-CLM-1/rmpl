import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { targetUserId, newPassword, adminPassword } = await req.json()

    console.log('Admin reset password request for user:', targetUserId)

    const { data: { user: adminUser }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !adminUser) {
      console.error('Admin authentication failed:', userError)
      throw new Error('Admin authentication failed')
    }

    console.log('Admin user authenticated:', adminUser.email)

    // Verify admin has proper role
    const { data: adminRoles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', adminUser.id)

    if (rolesError) {
      console.error('Failed to fetch admin roles:', rolesError)
      throw new Error('Failed to verify admin permissions')
    }

    const hasAdminRole = adminRoles?.some(r => 
      r.role.includes('admin') || 
      r.role === 'super_admin' || 
      r.role === 'platform_admin'
    )

    if (!hasAdminRole) {
      console.error('User does not have admin privileges:', adminUser.email)
      throw new Error('Insufficient permissions to reset passwords')
    }

    console.log('Admin role verified:', adminRoles?.map(r => r.role).join(', '))

    const { error: verifyError } = await supabaseClient.auth.signInWithPassword({
      email: adminUser.email!,
      password: adminPassword
    })
    
    if (verifyError) {
      console.error('Admin password verification failed:', verifyError)
      throw new Error('Admin password verification failed')
    }

    console.log('Admin password verified, updating target user password')

    const { data: targetProfile } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name')
      .eq('id', targetUserId)
      .single()

    const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
      targetUserId,
      { password: newPassword }
    )

    if (passwordError) {
      console.error('Password update failed:', passwordError)
      throw passwordError
    }

    console.log('Password updated successfully for user:', targetProfile?.email)

    await supabaseAdmin.from('password_reset_logs').insert({
      admin_user_id: adminUser.id,
      admin_email: adminUser.email,
      admin_full_name: adminUser.user_metadata?.full_name || 'Unknown',
      target_user_id: targetUserId,
      target_email: targetProfile?.email || 'Unknown',
      target_full_name: targetProfile?.full_name || 'Unknown',
      action_status: 'success',
      ip_address: req.headers.get('x-forwarded-for') || 'unknown',
      user_agent: req.headers.get('user-agent') || 'unknown'
    })

    return new Response(
      JSON.stringify({ success: true, message: 'Password updated successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Password reset error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
