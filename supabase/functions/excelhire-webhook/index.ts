import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ExcelHireWebhookData {
  project_id?: string
  project_title?: string
  city?: string
  state?: string
  zip_code?: string
  primary_skill?: string[]
  job_seeker_name?: string
  job_seeker_email?: string
  job_seeker_phone?: string
  event_type?: string // 'project_created', 'project_updated', 'application_received'
}

Deno.serve(async (req) => {
  console.log('=== EXCELHIRE WEBHOOK START ===')

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const supabase = createClient(supabaseUrl!, supabaseKey!)

    // Parse webhook data
    const webhookData: ExcelHireWebhookData = await req.json()
    console.log('ExcelHire webhook received:', webhookData)

    const eventType = webhookData.event_type || 'unknown'

    if (eventType === 'project_created' || eventType === 'project_updated') {
      // Handle project creation/update
      if (!webhookData.project_id) {
        return new Response(
          JSON.stringify({ error: 'Missing project_id' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      // Geocode location if we have city and state
      let latitude = null
      let longitude = null

      if (webhookData.city && webhookData.state) {
        try {
          const geocodeResponse = await supabase.functions.invoke('geocode-location', {
            body: { location: `${webhookData.city}, ${webhookData.state}` }
          })

          if (geocodeResponse.data && !geocodeResponse.error) {
            latitude = geocodeResponse.data.latitude
            longitude = geocodeResponse.data.longitude
          }
        } catch (error) {
          console.warn('Geocoding failed:', error)
        }
      }

      // Check if project already exists
      const { data: existingProject } = await supabase
        .from('jobs')
        .select('id')
        .eq('excelhire_id', webhookData.project_id)
        .maybeSingle()

      const projectData = {
        excelhire_id: webhookData.project_id,
        title: webhookData.project_title || 'Untitled',
        location_city: webhookData.city || null,
        location_state: webhookData.state || null,
        location_zip: webhookData.zip_code || null,
        specialty: webhookData.primary_skill && webhookData.primary_skill.length > 0 
          ? webhookData.primary_skill[0] 
          : null,
        latitude,
        longitude,
        status: 'open',
        updated_at: new Date().toISOString()
      }

      if (existingProject) {
        // Update existing project
        const { error } = await supabase
          .from('jobs')
          .update(projectData)
          .eq('id', existingProject.id)

        if (error) throw error

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Project updated', 
            project_id: existingProject.id 
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      } else {
        // Create new project
        const { data: newProject, error } = await supabase
          .from('jobs')
          .insert(projectData)
          .select()
          .single()

        if (error) throw error

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Project created', 
            project_id: newProject.id 
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

    } else if (eventType === 'application_received') {
      // Handle job seeker application
      if (!webhookData.job_seeker_email) {
        return new Response(
          JSON.stringify({ error: 'Missing job seeker email' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      // Parse job seeker name
      const nameParts = (webhookData.job_seeker_name || '').split(' ')
      const firstName = nameParts[0] || 'Unknown'
      const lastName = nameParts.slice(1).join(' ') || ''

      // Check if job seeker exists
      const { data: existingJobSeeker } = await supabase
        .from('demandcom')
        .select('id')
        .eq('email', webhookData.job_seeker_email)
        .maybeSingle()

      const jobSeekerData = {
        first_name: firstName,
        last_name: lastName,
        email: webhookData.job_seeker_email,
        phone: webhookData.job_seeker_phone || null,
        source: 'ExcelHire',
        status: 'active',
        updated_at: new Date().toISOString()
      }

      if (existingJobSeeker) {
        // Update existing job seeker
        const { error } = await supabase
          .from('demandcom')
          .update(jobSeekerData)
          .eq('id', existingJobSeeker.id)

        if (error) throw error

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Job seeker updated', 
            demandcom_id: existingJobSeeker.id 
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      } else {
        // Create new job seeker
        const { data: newJobSeeker, error } = await supabase
          .from('demandcom')
          .insert(jobSeekerData)
          .select()
          .single()

        if (error) throw error

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Job seeker created', 
            demandcom_id: newJobSeeker.id 
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Webhook received but no action taken',
        event_type: eventType 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('ExcelHire webhook error:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})