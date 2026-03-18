import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'
import { Resend } from 'https://esm.sh/resend@2.0.0'
import { retryApiCall, retrySupabaseOperation } from '../_shared/retry-utils.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function replaceMergeTags(text: string, candidate: any): string {
  return text
    .replace(/\{\{first_name\}\}/g, candidate.first_name || '')
    .replace(/\{\{last_name\}\}/g, candidate.last_name || '')
    .replace(/\{\{email\}\}/g, candidate.email || '')
    .replace(/\{\{phone\}\}/g, candidate.phone || '')
    .replace(/\{\{specialty\}\}/g, candidate.specialty || '')
    .replace(/\{\{license_type\}\}/g, candidate.license_type || '')
    .replace(/\{\{location_city\}\}/g, candidate.location_city || '')
    .replace(/\{\{location_state\}\}/g, candidate.location_state || '')
}

function generateShortCode(): string {
  return Math.random().toString(36).substring(2, 8)
}

async function processLinks(html: string, campaignId: string, supabase: any): Promise<string> {
  const linkRegex = /<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/gi
  const links: Map<string, string> = new Map()
  let match

  // Extract all links
  while ((match = linkRegex.exec(html)) !== null) {
    const originalUrl = match[2]
    if (!originalUrl.startsWith('http')) continue
    
    if (!links.has(originalUrl)) {
      const shortCode = generateShortCode()
      links.set(originalUrl, shortCode)

      // Store in database with retry logic
      await retrySupabaseOperation(
        async () => {
          const { error } = await supabase.from('campaign_links').insert({
            campaign_id: campaignId,
            original_url: originalUrl,
            short_code: shortCode,
          })
          if (error) throw error
        },
        3, // max attempts
        500 // initial delay ms
      )
    }
  }

  // Replace links with tracked versions
  let processedHtml = html
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  
  for (const [originalUrl, shortCode] of links.entries()) {
    const trackedUrl = `${supabaseUrl}/functions/v1/track-link-click?code=${shortCode}`
    processedHtml = processedHtml.replace(
      new RegExp(`href=(["'])${originalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\1`, 'g'),
      `href=$1${trackedUrl}$1`
    )
  }

  return processedHtml
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('=== SEND EMAIL FUNCTION INVOKED ===')
    const { recipient_id, campaign_id, candidate, template, subject, reply_to_email } = await req.json()
    console.log('Email send request:', {
      recipientId: recipient_id,
      campaignId: campaign_id,
      toEmail: candidate?.email,
      templateName: template?.name,
      subject,
      timestamp: new Date().toISOString(),
    })

    // CRITICAL VALIDATION: Check all required parameters
    if (!candidate || !candidate.email) {
      console.error('VALIDATION FAILED: Missing candidate or email', { candidate })
      throw new Error('Recipient email is required')
    }
    if (!template || !template.body_html) {
      console.error('VALIDATION FAILED: Missing template or body', { template: template?.name })
      throw new Error('Email template is required')
    }
    if (!subject) {
      console.error('VALIDATION FAILED: Missing subject')
      throw new Error('Email subject is required')
    }
    console.log('✓ All required parameters validated')

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    console.log('RESEND_API_KEY check:', { configured: !!resendApiKey })
    
    if (!resendApiKey) {
      console.error('FATAL: RESEND_API_KEY not configured')
      throw new Error('RESEND_API_KEY not configured')
    }

    const resend = new Resend(resendApiKey)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Replace merge tags in subject and body
    const processedSubject = replaceMergeTags(subject, candidate)
    let processedHtml = replaceMergeTags(template.body_html, candidate)

    // Process and track links
    processedHtml = await processLinks(processedHtml, campaign_id, supabase)

    // Add tracking pixel
    const trackingPixelUrl = `${supabaseUrl}/functions/v1/track-email-open?recipient=${recipient_id}`
    processedHtml += `<img src="${trackingPixelUrl}" width="1" height="1" alt="" />`

    // Send email via Resend with retry logic
    console.log('Calling Resend API with:', {
      from: 'campaigns@resend.dev',
      to: candidate.email,
      subject: processedSubject,
      hasHtml: !!processedHtml,
      htmlLength: processedHtml.length,
      resendApiKeyConfigured: !!resendApiKey
    })
    const emailResponse = await retryApiCall(
      async () => await resend.emails.send({
        from: 'RMPL <noreply@redefinemarcom.in>',
        to: [candidate.email],
        subject: processedSubject,
        html: processedHtml,
        reply_to: reply_to_email || undefined,
      }),
      5, // max attempts for email sending (higher priority)
      1000 // 1 second initial delay
    )

    if (emailResponse.error) {
      console.error('Resend API error after retries:', {
        error: emailResponse.error,
        toEmail: candidate.email,
      })
      
      await retrySupabaseOperation(async () => {
        const { error } = await supabase
          .from('campaign_recipients')
          .update({
            status: 'failed',
            error_message: emailResponse.error?.message || 'Unknown email error',
          })
          .eq('id', recipient_id)
        if (error) throw error
      })

      return new Response(
        JSON.stringify({ error: emailResponse.error?.message || 'Unknown email error' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Update recipient status with retry
    await retrySupabaseOperation(async () => {
      const { error } = await supabase
        .from('campaign_recipients')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', recipient_id)
      if (error) throw error
    })

    // Increment campaign sent count with retry
    await retrySupabaseOperation(async () => {
      const { data: campaignData, error: fetchError } = await supabase
        .from('campaigns')
        .select('sent_count')
        .eq('id', campaign_id)
        .single()
      
      if (fetchError) throw fetchError

      if (campaignData) {
        const { error: updateError } = await supabase
          .from('campaigns')
          .update({ sent_count: (campaignData.sent_count || 0) + 1 })
          .eq('id', campaign_id)
        if (updateError) throw updateError
      }
    })

    console.log('Email sent successfully:', {
      emailId: emailResponse.data?.id,
      toEmail: candidate.email,
    })

    return new Response(
      JSON.stringify({ success: true, email_id: emailResponse.data?.id }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('=== SEND EMAIL FUNCTION FAILED ===')
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    })
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
