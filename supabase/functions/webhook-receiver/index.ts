import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WebhookPayload {
  [key: string]: any
}

interface FieldMapping {
  id: string
  sourceField: string
  targetField: string
  transform: string
}

interface WebhookConnector {
  id: string
  name: string
  connector_type: string
  webhook_token: string
  webhook_config: {
    source_name?: string
    field_mappings?: FieldMapping[]
  }
  target_table: string
  rate_limit_per_minute: number
}

Deno.serve(async (req) => {
  const startTime = Date.now()
  console.log('=== WEBHOOK REQUEST START ===')
  console.log('Method:', req.method)
  console.log('URL:', req.url)

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('CORS preflight - returning 200')
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Extract webhook token from URL query parameter
    const url = new URL(req.url)
    const webhookToken = url.searchParams.get('token')
    console.log('Extracted webhook token:', webhookToken)

    if (!webhookToken) {
      console.error('ERROR: Missing webhook token in URL')
      return errorResponse(400, 'Missing webhook token in URL')
    }

    // Create Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    const supabase = createClient(supabaseUrl!, supabaseKey!)

    const requestId = `req_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`
    const forwardedFor = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    const clientIp = forwardedFor.split(',')[0].trim()
    console.log('Request ID:', requestId)
    console.log('Client IP:', clientIp)

    // Parse request body
    let payload: WebhookPayload
    try {
      const rawBody = await req.text()
      console.log('Raw request body:', rawBody)
      payload = JSON.parse(rawBody)
      console.log('Parsed payload:', payload)
    } catch (e) {
      console.error('ERROR: Failed to parse JSON:', e)
      return errorResponse(400, 'Invalid JSON payload', requestId)
    }

    // Step 1: Get webhook connector by token
    console.log('STEP 1: Fetching webhook connector...')
    const { data: connector, error: connectorError } = await supabase
      .from('webhook_connectors')
      .select('*')
      .eq('webhook_token', webhookToken)
      .eq('is_active', true)
      .maybeSingle()

    if (connectorError || !connector) {
      console.error('ERROR: Webhook connector not found:', connectorError)
      await logWebhook(supabase, null, requestId, 'error', 404, payload, 'Webhook endpoint not found', clientIp)
      return errorResponse(404, 'Webhook endpoint not found', requestId)
    }

    console.log('Webhook connector found:', { id: connector.id, name: connector.name })

    const typedConnector = connector as unknown as WebhookConnector

    // Step 2: Check rate limit
    console.log('STEP 2: Checking rate limit...')
    const { data: rateLimitOk, error: rateLimitError } = await supabase
      .rpc('check_webhook_rate_limit', {
        _webhook_id: typedConnector.id,
        _limit: typedConnector.rate_limit_per_minute || 60
      })

    if (!rateLimitOk) {
      console.warn('WARN: Rate limit exceeded')
      await logWebhook(supabase, typedConnector.id, requestId, 'error', 429, payload, 'Rate limit exceeded', clientIp)
      return errorResponse(429, `Rate limit exceeded. Maximum ${typedConnector.rate_limit_per_minute || 60} requests per minute`, requestId)
    }

    // Step 3: Map fields using webhook_config
    console.log('STEP 3: Mapping fields...')
    const mappedData = mapFields(payload, typedConnector.webhook_config?.field_mappings || [])
    console.log('Mapped data:', mappedData)

    // Step 4: Validate required fields based on target table
    console.log('STEP 4: Validating data...')
    const errors = validateData(mappedData, typedConnector.target_table)
    if (errors.length > 0) {
      console.error('ERROR: Validation failed:', errors)
      await logWebhook(supabase, typedConnector.id, requestId, 'error', 400, payload, `Validation failed: ${errors.join(', ')}`, clientIp)
      return errorResponse(400, 'Validation failed', requestId, errors)
    }

    let recordId: string
    let isDuplicate = false
    let responseData: any

    if (typedConnector.target_table === 'master') {
      // Handle master creation/update
      console.log('Processing master record...')
      
      // Check for duplicate by mobile_numb
      const { data: existingMaster } = await supabase
        .from('master')
        .select('id, mobile_numb')
        .eq('mobile_numb', mappedData.mobile_numb)
        .maybeSingle()

      if (existingMaster) {
        isDuplicate = true
        recordId = existingMaster.id

        // Update existing master record
        const { error: updateError } = await supabase
          .from('master')
          .update({
            mobile_numb: mappedData.mobile_numb,
            name: mappedData.name || null,
            designation: mappedData.designation || null,
            company_name: mappedData.company_name || null,
            personal_email_id: mappedData.personal_email_id || null,
            generic_email_id: mappedData.generic_email_id || null,
            official: mappedData.official || null,
            city: mappedData.city || null,
            state: mappedData.state || null,
            pincode: mappedData.pincode || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', recordId)

        if (updateError) throw updateError

        responseData = {
          success: true,
          message: 'Master record updated (duplicate mobile_numb)',
          master_id: recordId,
          status: 'duplicate',
          request_id: requestId,
          timestamp: new Date().toISOString()
        }
      } else {
        // Create new master record
        const { data: newMaster, error: insertError } = await supabase
          .from('master')
          .insert({
            mobile_numb: mappedData.mobile_numb,
            name: mappedData.name || null,
            designation: mappedData.designation || null,
            company_name: mappedData.company_name || null,
            personal_email_id: mappedData.personal_email_id || null,
            generic_email_id: mappedData.generic_email_id || null,
            official: mappedData.official || null,
            city: mappedData.city || null,
            state: mappedData.state || null,
            pincode: mappedData.pincode || null
          })
          .select()
          .single()

        if (insertError) throw insertError

        recordId = newMaster.id

        responseData = {
          success: true,
          message: 'Master record created successfully',
          master_id: recordId,
          status: 'created',
          request_id: requestId,
          timestamp: new Date().toISOString()
        }
      }

      await logWebhook(
        supabase,
        typedConnector.id,
        requestId,
        isDuplicate ? 'duplicate' : 'success',
        200,
        payload,
        null,
        clientIp,
        null,
        null,
        responseData
      )

    } else if (typedConnector.target_table === 'job_seekers') {
      // Handle DemandCom creation/update
      console.log('Processing DemandCom record...')
      
      // Check for duplicate by email
      const { data: existingDemandCom } = await supabase
        .from('demandcom')
        .select('id, first_name, last_name, email')
        .eq('email', mappedData.email)
        .maybeSingle()

      if (existingDemandCom) {
        isDuplicate = true
        recordId = existingDemandCom.id

        // Update existing DemandCom record
        const { error: updateError } = await supabase
          .from('demandcom')
          .update({
            first_name: mappedData.first_name,
            last_name: mappedData.last_name || null,
            phone: mappedData.phone || null,
            specialty: mappedData.specialty || null,
            location_city: mappedData.location_city || null,
            location_state: mappedData.location_state || null,
            location_zip: mappedData.location_zip || null,
            source: typedConnector.webhook_config?.source_name || typedConnector.name,
            updated_at: new Date().toISOString()
          })
          .eq('id', recordId)

        if (updateError) throw updateError

        responseData = {
          success: true,
          message: 'DemandCom updated (duplicate email)',
          demandcom_id: recordId,
          status: 'duplicate',
          request_id: requestId,
          timestamp: new Date().toISOString()
        }
      } else {
        // Create new DemandCom record
        const { data: newDemandCom, error: insertError } = await supabase
          .from('demandcom')
          .insert({
            first_name: mappedData.first_name,
            last_name: mappedData.last_name || null,
            email: mappedData.email,
            phone: mappedData.phone || null,
            specialty: mappedData.specialty || null,
            location_city: mappedData.location_city || null,
            location_state: mappedData.location_state || null,
            location_zip: mappedData.location_zip || null,
            source: typedConnector.webhook_config?.source_name || typedConnector.name,
            status: 'active'
          })
          .select()
          .single()

        if (insertError) throw insertError

        recordId = newDemandCom.id

        responseData = {
          success: true,
          message: 'DemandCom created successfully',
          demandcom_id: recordId,
          status: 'created',
          request_id: requestId,
          timestamp: new Date().toISOString()
        }
      }

      await logWebhook(
        supabase,
        typedConnector.id,
        requestId,
        isDuplicate ? 'duplicate' : 'success',
        200,
        payload,
        null,
        clientIp,
        recordId,
        null,
        responseData
      )

    } else if (typedConnector.target_table === 'jobs') {
      // Handle project creation/update
      console.log('Processing project...')

      // Check for duplicate by title and location
      const { data: existingProject } = await supabase
        .from('jobs')
        .select('id, title')
        .eq('title', mappedData.title)
        .eq('location_city', mappedData.location_city || '')
        .maybeSingle()

      if (existingProject) {
        isDuplicate = true
        recordId = existingProject.id

        // Update existing project
        const { error: updateError } = await supabase
          .from('jobs')
          .update({
            title: mappedData.title,
            location_city: mappedData.location_city || null,
            location_state: mappedData.location_state || null,
            location_zip: mappedData.location_zip || null,
            specialty: mappedData.specialty || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', recordId)

        if (updateError) throw updateError

        responseData = {
          success: true,
          message: 'Project updated (duplicate)',
          project_id: recordId,
          status: 'duplicate',
          request_id: requestId,
          timestamp: new Date().toISOString()
        }
      } else {
        // Create new project
        const { data: newProject, error: insertError } = await supabase
          .from('jobs')
          .insert({
            title: mappedData.title,
            location_city: mappedData.location_city || null,
            location_state: mappedData.location_state || null,
            location_zip: mappedData.location_zip || null,
            specialty: mappedData.specialty || null,
            status: 'open'
          })
          .select()
          .single()

        if (insertError) throw insertError

        recordId = newProject.id

        responseData = {
          success: true,
          message: 'Project created successfully',
          project_id: recordId,
          status: 'created',
          request_id: requestId,
          timestamp: new Date().toISOString()
        }
      }

      await logWebhook(
        supabase,
        typedConnector.id,
        requestId,
        isDuplicate ? 'duplicate' : 'success',
        200,
        payload,
        null,
        clientIp,
        null,
        recordId,
        responseData
      )
    }

    const elapsedTime = Date.now() - startTime
    console.log('=== WEBHOOK REQUEST SUCCESS ===')
    console.log('Elapsed time:', elapsedTime, 'ms')

    return new Response(
      JSON.stringify(responseData),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    const elapsedTime = Date.now() - startTime
    console.error('=== WEBHOOK REQUEST ERROR ===')
    console.error('Error:', error)
    console.error('Elapsed time:', elapsedTime, 'ms')

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return errorResponse(500, 'Internal server error: ' + errorMessage)
  }
})

// Helper Functions

function applyTransform(value: string, transform: string): string {
  switch (transform) {
    case 'lowercase':
      return value.toLowerCase()
    case 'uppercase':
      return value.toUpperCase()
    case 'trim':
      return value.trim()
    case 'trim_lowercase':
      return value.trim().toLowerCase()
    case 'none':
    default:
      return value
  }
}

// Helper function to extract nested values from JSON using dot notation and array brackets
function getNestedValue(obj: any, path: string): any {
  try {
    // Split by dots and brackets: "user.contact.email" or "data[0].name"
    const keys = path.split(/[\.\[\]]/).filter(key => key !== '')
    
    return keys.reduce((current, key) => {
      if (current === null || current === undefined) return undefined
      return current[key]
    }, obj)
  } catch {
    return undefined
  }
}

function mapFields(payload: WebhookPayload, fieldMappings: FieldMapping[]): any {
  const mapped: any = {}

  // Apply field mappings from webhook_config
  for (const mapping of fieldMappings) {
    // Support nested JSON paths like "user.email" or "data[0].name"
    const value = getNestedValue(payload, mapping.sourceField)
    if (value !== undefined && value !== null) {
      let stringValue = String(value)
      stringValue = applyTransform(stringValue, mapping.transform)
      mapped[mapping.targetField] = stringValue
    }
  }

  // Default mappings for common fields if not already mapped
  if (!mapped.first_name && payload.first_name) {
    mapped.first_name = String(payload.first_name).trim()
  }
  if (!mapped.first_name && payload.name) {
    const nameParts = String(payload.name).trim().split(' ')
    mapped.first_name = nameParts[0]
    mapped.last_name = nameParts.slice(1).join(' ') || null
  }
  if (!mapped.last_name && payload.last_name) {
    mapped.last_name = String(payload.last_name).trim()
  }
  if (!mapped.email && payload.email) {
    mapped.email = String(payload.email).trim().toLowerCase()
  }
  if (!mapped.phone && payload.phone) {
    mapped.phone = String(payload.phone).trim()
  }
  if (!mapped.phone && payload.mobile) {
    mapped.phone = String(payload.mobile).trim()
  }
  if (!mapped.title && payload.title) {
    mapped.title = String(payload.title).trim()
  }
  if (!mapped.title && payload.job_title) {
    mapped.title = String(payload.job_title).trim()
  }
  if (!mapped.specialty && payload.specialty) {
    mapped.specialty = String(payload.specialty).trim()
  }
  if (!mapped.location_city && payload.city) {
    mapped.location_city = String(payload.city).trim()
  }
  if (!mapped.location_state && payload.state) {
    mapped.location_state = String(payload.state).trim()
  }
  if (!mapped.location_zip && payload.zip) {
    mapped.location_zip = String(payload.zip).trim()
  }
  
  // Master-specific mappings
  if (!mapped.mobile_numb && payload.mobile_numb) {
    mapped.mobile_numb = String(payload.mobile_numb).trim()
  }
  if (!mapped.mobile_numb && payload.mobile) {
    mapped.mobile_numb = String(payload.mobile).trim()
  }
  if (!mapped.name && payload.name) {
    mapped.name = String(payload.name).trim()
  }
  if (!mapped.designation && payload.designation) {
    mapped.designation = String(payload.designation).trim()
  }
  if (!mapped.company_name && payload.company_name) {
    mapped.company_name = String(payload.company_name).trim()
  }
  if (!mapped.name && payload.company_name) {
    mapped.name = String(payload.company_name).trim()
  }
  if (!mapped.name && payload.client_name) {
    mapped.name = String(payload.client_name).trim()
  }
  if (!mapped.contact_name && payload.contact_name) {
    mapped.contact_name = String(payload.contact_name).trim()
  }
  if (!mapped.address && payload.address) {
    mapped.address = String(payload.address).trim()
  }
  if (!mapped.city && payload.city) {
    mapped.city = String(payload.city).trim()
  }
  if (!mapped.state && payload.state) {
    mapped.state = String(payload.state).trim()
  }
  if (!mapped.zip && payload.zip) {
    mapped.zip = String(payload.zip).trim()
  }
  if (!mapped.notes && payload.notes) {
    mapped.notes = String(payload.notes).trim()
  }

  return mapped
}

function validateData(data: any, targetTable: string): string[] {
  const errors: string[] = []

  if (targetTable === 'job_seekers') {
    // Required fields for job seekers
    if (!data.first_name || data.first_name.trim() === '') {
      errors.push('first_name is required')
    }
    if (!data.email || data.email.trim() === '') {
      errors.push('email is required')
    }

    // Email format
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errors.push('invalid email format')
    }

    // Phone format (if provided)
    if (data.phone) {
      const digits = data.phone.replace(/\D/g, '')
      if (digits.length < 10) {
        errors.push('phone number must have at least 10 digits')
      }
    }
  } else if (targetTable === 'jobs') {
    // Required fields for jobs
    if (!data.title || data.title.trim() === '') {
      errors.push('title is required')
    }
  } else if (targetTable === 'clients') {
    // Required fields for clients
    if (!data.name || data.name.trim() === '') {
      errors.push('name is required')
    }

    // Email format (if provided)
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errors.push('invalid email format')
    }
  }

  return errors
}

async function logWebhook(
  supabase: any,
  webhookId: string | null,
  requestId: string,
  status: string,
  httpCode: number,
  request: any,
  errorMsg: string | null = null,
  ipAddress: string = 'unknown',
  jobSeekerId: string | null = null,
  jobId: string | null = null,
  response: any = null
) {
  if (!webhookId) return

  try {
    await supabase.from('webhook_logs').insert({
      webhook_connector_id: webhookId,
      request_id: requestId,
      status,
      http_status_code: httpCode,
      request_payload: request,
      response_payload: response || {},
      error_message: errorMsg,
      demandcom_id: jobSeekerId,
      job_id: jobId,
      ip_address: ipAddress
    })
  } catch (e) {
    console.error('Failed to log webhook:', e)
  }
}

function errorResponse(status: number, message: string, requestId?: string, errors?: string[]) {
  return new Response(
    JSON.stringify({
      success: false,
      error: message,
      errors: errors,
      request_id: requestId,
      timestamp: new Date().toISOString()
    }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  )
}