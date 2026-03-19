import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'
import { retrySupabaseOperation, retryWithBackoff } from '../_shared/retry-utils.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  let campaignId: string | null = null;

  try {
    const { campaign_id } = await req.json()
    campaignId = campaign_id;
    console.log('=== CAMPAIGN PROCESSING STARTED ===')
    console.log('Campaign ID:', campaign_id)
    console.log('Timestamp:', new Date().toISOString())

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendApiKey = Deno.env.get('RESEND_API_KEY')

    console.log('Environment check:', {
      supabaseUrl: !!supabaseUrl,
      supabaseKey: !!supabaseKey,
      resendApiKey: !!resendApiKey,
    })

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Fetch campaign details with retry logic
    const { data: campaign, error: campaignError } = await retrySupabaseOperation(
      async () => {
        const result = await supabase
          .from('campaigns')
          .select('*')
          .eq('id', campaign_id)
          .single()
        if (result.error) throw result.error
        return result
      },
      3,
      500
    )

    if (campaignError || !campaign) {
      console.error('Campaign not found after retries:', campaignError)
      return new Response(JSON.stringify({ error: 'Campaign not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Validate API keys based on campaign type
    if (campaign.type === 'email' && !resendApiKey) {
      console.error('FATAL: RESEND_API_KEY not configured for email campaign')
      throw new Error('RESEND_API_KEY not configured. Please add it in the backend settings.')
    }

    // For WhatsApp campaigns, fetch WhatsApp settings
    let whatsappSettings: any = null
    if (campaign.type === 'whatsapp') {
      const { data: waSettings, error: waError } = await supabase
        .from('whatsapp_settings')
        .select('*')
        .eq('is_active', true)
        .single()

      if (waError || !waSettings) {
        console.error('WhatsApp settings not found:', waError)
        throw new Error('WhatsApp not configured. Please set up WhatsApp settings first.')
      }

      const exotelSid = waSettings.exotel_sid || Deno.env.get('EXOTEL_SID')
      const exotelApiKey = waSettings.exotel_api_key || Deno.env.get('EXOTEL_API_KEY')
      const exotelApiToken = waSettings.exotel_api_token || Deno.env.get('EXOTEL_API_TOKEN')

      if (!exotelSid || !exotelApiKey || !exotelApiToken) {
        throw new Error('Exotel credentials not configured for WhatsApp.')
      }

      whatsappSettings = {
        ...waSettings,
        exotel_sid: exotelSid,
        exotel_api_key: exotelApiKey,
        exotel_api_token: exotelApiToken,
        exotel_subdomain: waSettings.exotel_subdomain || 'api.exotel.com',
      }
      console.log('WhatsApp settings loaded successfully')
    }

    // Fetch campaign creator's email for reply-to
    const { data: profileData } = await retrySupabaseOperation(
      async () => {
        const result = await supabase
          .from('profiles')
          .select('email')
          .eq('id', campaign.created_by)
          .single()
        if (result.error) throw result.error
        return result
      },
      2,
      500
    )
    
    const replyToEmail = profileData?.email
    console.log('Campaign creator email for reply-to:', replyToEmail || 'not found')

    // Update campaign status to sending with retry
    await retrySupabaseOperation(async () => {
      const { error } = await supabase
        .from('campaigns')
        .update({ status: 'sending' })
        .eq('id', campaign_id)
      if (error) throw error
    })

    // Get audience data from CSV upload
    const audienceData = (campaign.audience_data as any[]) || []
    console.log('Audience data validation:', {
      exists: !!audienceData,
      isArray: Array.isArray(audienceData),
      length: audienceData.length,
    })
    
    // Critical validation: Must have audience data
    if (!audienceData || !Array.isArray(audienceData) || audienceData.length === 0) {
      console.error('VALIDATION FAILED: No audience data')
      await retrySupabaseOperation(async () => {
        const { error } = await supabase
          .from('campaigns')
          .update({ status: 'failed' })
          .eq('id', campaign_id)
        if (error) throw error
      })
      return new Response(
        JSON.stringify({ error: 'No audience data found. Please upload a CSV file with recipients.' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
    
    // Filter out unsubscribed candidates
    const filteredAudience = audienceData.filter(recipient => {
      // If recipient has an email, check if they're unsubscribed
      // This will be cross-referenced with the candidates table later
      return true; // Initial pass, will filter during processing
    });

    console.log(`Found ${filteredAudience.length} recipients from CSV`)

    // Update total recipients with retry
    await retrySupabaseOperation(
      async () => {
        const { error } = await supabase
          .from('campaigns')
          .update({ total_recipients: filteredAudience.length })
          .eq('id', campaign_id)
        if (error) throw error
      },
      2,
      500
    )

    // Fetch template with retry
    const templateTable = campaign.type === 'whatsapp' ? 'whatsapp_templates' : 'email_templates'
    console.log('Fetching template:', { templateTable, templateId: campaign.template_id })
    
    const { data: template, error: templateError } = await retrySupabaseOperation(
      async () => {
        const result = await supabase
          .from(templateTable)
          .select('*')
          .eq('id', campaign.template_id)
          .single()
        if (result.error) throw result.error
        return result
      },
      3,
      500
    )

    if (templateError || !template) {
      console.error('VALIDATION FAILED: Template not found', { 
        error: templateError, 
        templateId: campaign.template_id,
        templateTable 
      })
      await retrySupabaseOperation(async () => {
        const { error } = await supabase
          .from('campaigns')
          .update({ status: 'failed' })
          .eq('id', campaign_id)
        if (error) throw error
      })
      return new Response(
        JSON.stringify({ error: `Template not found. Please select a valid ${campaign.type} template.` }), 
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('Template fetched successfully:', template.name || template.template_name)

    // --- Variable mapping: merge DemandCom data with CSV data ---
    const variableMapping = (campaign.filter_criteria as any)?.variable_mapping || {}
    const hasMappedVars = Object.values(variableMapping).some((v: any) => v && v !== '__custom__')

    // Mapping from merge-tag names to actual demandcom column names
    const TAG_TO_COLUMN: Record<string, string> = {
      name: 'name', first_name: 'name', last_name: 'name',
      email: 'email', phone: 'mobile_numb', mobile2: 'mobile2',
      official: 'official', linkedin: 'linkedin',
      designation: 'designation', department: 'deppt',
      job_level_updated: 'job_level_updated',
      company_name: 'company_name', industry: 'industry_type',
      sub_industry: 'sub_industry', turnover: 'turnover',
      emp_size: 'emp_size', erp_name: 'erp_name', erp_vendor: 'erp_vendor',
      website: 'website', activity_name: 'activity_name',
      address: 'address', location: 'location', city: 'city',
      state: 'state', zone: 'zone', tier: 'tier', pincode: 'pincode',
      latest_disposition: 'latest_disposition',
      latest_subdisposition: 'latest_subdisposition',
      last_call_date: 'last_call_date',
    }

    // If we have mapped variables, batch-lookup DemandCom records for all recipients
    const demandcomLookup = new Map<string, any>()
    if (hasMappedVars) {
      console.log('Variable mapping detected, looking up DemandCom records...')

      // Determine which DB columns we need
      const neededColumns = new Set<string>(['id', 'email', 'mobile_numb'])
      for (const [, tagName] of Object.entries(variableMapping)) {
        if (tagName && tagName !== '__custom__') {
          const col = TAG_TO_COLUMN[tagName as string]
          if (col) neededColumns.add(col)
        }
      }
      const selectCols = [...neededColumns].join(',')

      // Collect all contact identifiers from CSV
      const emails = filteredAudience
        .map((r: any) => r.email?.toLowerCase?.())
        .filter(Boolean)
      const phones = filteredAudience
        .map((r: any) => {
          const p = r.phone || r.mobile || r.mobile_numb || ''
          return p.replace(/[^\d]/g, '').slice(-10)
        })
        .filter((p: string) => p.length >= 10)

      // Batch fetch in chunks of 200
      const chunkSize = 200
      for (let c = 0; c < Math.max(emails.length, phones.length); c += chunkSize) {
        const emailChunk = emails.slice(c, c + chunkSize)
        const phoneChunk = phones.slice(c, c + chunkSize)

        let orFilters: string[] = []
        if (emailChunk.length > 0) {
          orFilters.push(`email.in.(${emailChunk.join(',')})`)
        }
        if (phoneChunk.length > 0) {
          // Match last 10 digits of mobile_numb
          for (const ph of phoneChunk) {
            orFilters.push(`mobile_numb.ilike.%${ph}`)
          }
        }

        if (orFilters.length > 0) {
          // Limit or filter size to avoid query issues
          const batchOr = orFilters.slice(0, 50).join(',')
          const { data: dcRecords } = await supabase
            .from('demandcom')
            .select(selectCols)
            .or(batchOr)
            .limit(500)

          if (dcRecords) {
            for (const rec of dcRecords) {
              // Index by email and by phone last-10
              if (rec.email) {
                demandcomLookup.set(rec.email.toLowerCase(), rec)
              }
              if (rec.mobile_numb) {
                const digits = rec.mobile_numb.replace(/[^\d]/g, '').slice(-10)
                if (digits.length >= 10) {
                  demandcomLookup.set(digits, rec)
                }
              }
            }
          }
        }
      }
      console.log(`DemandCom lookup: ${demandcomLookup.size} records found`)
    }

    // Helper: resolve a tag value from DemandCom record
    function resolveTagValue(tagName: string, dcRecord: any): string {
      if (!dcRecord) return ''
      if (tagName === 'first_name') {
        const name = dcRecord.name || ''
        return name.split(' ')[0] || ''
      }
      if (tagName === 'last_name') {
        const name = dcRecord.name || ''
        return name.split(' ').slice(1).join(' ') || ''
      }
      const col = TAG_TO_COLUMN[tagName]
      if (col && dcRecord[col] !== undefined && dcRecord[col] !== null) {
        return String(dcRecord[col])
      }
      return ''
    }

    // Helper: enrich a recipient with DemandCom data based on variable mapping
    function enrichRecipient(csvRow: any): any {
      if (!hasMappedVars) return csvRow

      // Look up DemandCom record by email or phone
      let dcRecord: any = null
      if (csvRow.email) {
        dcRecord = demandcomLookup.get(csvRow.email.toLowerCase())
      }
      if (!dcRecord && (csvRow.phone || csvRow.mobile || csvRow.mobile_numb)) {
        const rawPhone = csvRow.phone || csvRow.mobile || csvRow.mobile_numb || ''
        const digits = rawPhone.replace(/[^\d]/g, '').slice(-10)
        if (digits.length >= 10) {
          dcRecord = demandcomLookup.get(digits)
        }
      }

      // Merge: for each mapped variable, fill from DemandCom; for custom, keep CSV value
      const enriched = { ...csvRow }
      for (const [varName, tagName] of Object.entries(variableMapping)) {
        if (tagName && tagName !== '__custom__' && dcRecord) {
          enriched[varName] = resolveTagValue(tagName as string, dcRecord)
        }
      }
      return enriched
    }

    // Process each recipient with rate limiting
    let successCount = 0
    let skippedCount = 0
    const totalRecipients = filteredAudience.length;
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

    // Rate limiting
    const delayMs = 6000;
    const batchSize = 50;
    const batchDelayMs = 10000;

    console.log(`Starting campaign: ${totalRecipients} recipients, ${Object.keys(variableMapping).length} variable mappings`);

    for (let i = 0; i < filteredAudience.length; i++) {
      const recipient = enrichRecipient(filteredAudience[i]);
      try {
        // Check if recipient is unsubscribed with retry
        const emailOrPhone = recipient.email || recipient.phone;
        if (emailOrPhone) {
          const { data: unsubscribedCheck } = await retrySupabaseOperation(
            async () => {
              const result = await supabase
                .from('demandcom')
                .select('is_unsubscribed')
                .or(`email.eq.${recipient.email || ''},phone.ilike.%${recipient.phone || ''}%`)
                .eq('is_unsubscribed', true)
                .maybeSingle()
              if (result.error) throw result.error
              return result
            },
            2,
            500
          )
          
          if (unsubscribedCheck) {
            console.log(`Skipping unsubscribed DemandCom: ${emailOrPhone}`);
            skippedCount++;
            continue;
          }
        }
        
        // Check if same template was sent to this email in the last 15 days with retry
        if (recipient.email && campaign.template_id) {
          const { data: recentSends } = await retrySupabaseOperation(
            async () => {
              const result = await supabase
                .from('campaign_recipients')
                .select(`
                  id,
                  sent_at,
                  campaign_id,
                  campaigns!inner(template_id)
                `)
                .eq('campaigns.template_id', campaign.template_id)
                .gte('sent_at', fifteenDaysAgo.toISOString())
                .in('status', ['sent', 'delivered'])
                .limit(1)
              if (result.error) throw result.error
              return result
            },
            3,
            500
          );
          
          // Check if any of the recipients match this email by looking up in campaigns
          if (recentSends && recentSends.length > 0) {
            for (const recentSend of recentSends) {
              // Fetch the campaign to check audience data with retry
              const { data: recentCampaign } = await retrySupabaseOperation(
                async () => {
                  const result = await supabase
                    .from('campaigns')
                    .select('audience_data')
                    .eq('id', recentSend.campaign_id)
                    .single()
                  if (result.error) throw result.error
                  return result
                },
                2,
                500
              );
              
              if (recentCampaign?.audience_data) {
                const audienceArray = recentCampaign.audience_data as any[];
                const emailFound = audienceArray.some((aud: any) => 
                  aud.email?.toLowerCase() === recipient.email?.toLowerCase()
                );
                
                if (emailFound) {
                  console.log(`Skipping ${recipient.email}: Same template sent within 15 days (last sent: ${recentSend.sent_at})`);
                  skippedCount++;
                  continue;
                }
              }
            }
          }
        }
        
        // Create recipient record with retry
        const { data: recipientRecord, error: recipientError } = await retrySupabaseOperation(
          async () => {
            const result = await supabase
              .from('campaign_recipients')
              .insert({
                campaign_id: campaign.id,
                demandcom_id: null, // No job seeker match, using CSV data directly
                status: 'pending',
              })
              .select()
              .single()
            if (result.error) throw result.error
            return result
          },
          3,
          500
        )

        if (recipientError) {
          console.error('Error creating recipient after retries:', recipientError)
          continue
        }

        // Send email or WhatsApp
        if (campaign.type === 'email') {
          console.log(`Sending email to ${recipient.email} (${i + 1}/${filteredAudience.length})`)

          const { error: sendError } = await retryWithBackoff(
            async () => {
              const result = await supabase.functions.invoke('send-campaign-email', {
                body: {
                  recipient_id: recipientRecord.id,
                  campaign_id: campaign.id,
                  candidate: recipient,
                  template: template,
                  subject: campaign.subject,
                  reply_to_email: replyToEmail,
                },
              })
              if (result.error) throw result.error
              return result
            },
            2,
            2000,
            2,
            (error) => {
              return error.message?.includes('network') ||
                     error.message?.includes('timeout') ||
                     error.status >= 500
            }
          )

          if (sendError) {
            console.error(`✗ Failed to send email to ${recipient.email}:`, {
              error: sendError.message,
              recipientId: recipientRecord.id,
            })
            await retrySupabaseOperation(async () => {
              const { error } = await supabase
                .from('campaign_recipients')
                .update({
                  status: 'failed',
                  error_message: sendError.message,
                })
                .eq('id', recipientRecord.id)
              if (error) throw error
            })
          } else {
            console.log(`✓ Email sent successfully to ${recipient.email}`)
            successCount++
          }
        } else if (campaign.type === 'whatsapp' && whatsappSettings) {
          // WhatsApp sending via Exotel API
          const rawPhone = recipient.phone || recipient.mobile || recipient.mobile_numb || ''
          if (!rawPhone) {
            console.log(`Skipping recipient ${i + 1}: no phone number`)
            await retrySupabaseOperation(async () => {
              const { error } = await supabase
                .from('campaign_recipients')
                .update({ status: 'failed', error_message: 'No phone number' })
                .eq('id', recipientRecord.id)
              if (error) throw error
            })
            continue
          }

          // Normalize phone number — must be digits only for Exotel (e.g. 919876543210)
          let cleaned = rawPhone.replace(/[^\d+]/g, '')
          if (!cleaned.startsWith('+')) {
            if (cleaned.length === 10) cleaned = '+91' + cleaned
            else if (cleaned.startsWith('91') && cleaned.length === 12) cleaned = '+' + cleaned
            else cleaned = '+' + cleaned
          }
          const phoneForStorage = cleaned // e.g. +919876543210
          const phoneDigits = cleaned.replace(/^\+/, '') // e.g. 919876543210

          console.log(`Sending WhatsApp to ${phoneForStorage} (${i + 1}/${filteredAudience.length})`)

          // Build template variables from CSV data mapped to template variable indices
          const templateVars = template.variables || []
          const components: any[] = []
          if (templateVars.length > 0) {
            const bodyParams = templateVars
              .sort((a: any, b: any) => a.index - b.index)
              .map((v: any) => ({
                type: 'text',
                text: recipient[v.placeholder] || recipient[String(v.index)] || '',
              }))
            components.push({ type: 'body', parameters: bodyParams })
          }

          const exotelUrl = `https://${whatsappSettings.exotel_subdomain}/v2/accounts/${whatsappSettings.exotel_sid}/messages`
          const exotelPayload = {
            whatsapp: {
              messages: [{
                from: whatsappSettings.whatsapp_source_number,
                to: phoneDigits,
                content: {
                  type: 'template',
                  template: {
                    name: template.template_name,
                    language: { code: template.language || 'en' },
                    components,
                  },
                },
              }],
            },
          }

          try {
            const exotelResponse = await fetch(exotelUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${btoa(`${whatsappSettings.exotel_api_key}:${whatsappSettings.exotel_api_token}`)}`,
              },
              body: JSON.stringify(exotelPayload),
            })

            const responseText = await exotelResponse.text()
            let exotelResult: any
            try {
              exotelResult = JSON.parse(responseText)
            } catch {
              const jsonMatch = responseText.match(/\{[\s\S]*\}/)
              exotelResult = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: responseText }
            }

            const messageSid = exotelResult?.response?.whatsapp?.messages?.[0]?.data?.sid ||
              exotelResult?.sid || exotelResult?.id || null
            const success = !!messageSid

            // Log to whatsapp_messages table
            let messageContent = template.content || ''
            if (templateVars.length > 0) {
              for (const v of templateVars) {
                const val = recipient[v.placeholder] || recipient[String(v.index)] || ''
                messageContent = messageContent.replace(new RegExp(`\\{\\{${v.index}\\}\\}`, 'g'), val)
              }
            }

            await supabase.from('whatsapp_messages').insert({
              template_id: template.id,
              template_name: template.template_name,
              sent_by: campaign.created_by,
              phone_number: phoneForStorage,
              message_content: messageContent,
              template_variables: Object.fromEntries(
                templateVars.map((v: any) => [String(v.index), recipient[v.placeholder] || ''])
              ),
              exotel_message_id: messageSid,
              status: success ? 'sent' : 'failed',
              direction: 'outbound',
              sent_at: new Date().toISOString(),
              error_message: success ? null : (exotelResult?.message || exotelResult?.error || 'Failed to send'),
            })

            if (success) {
              console.log(`✓ WhatsApp sent to ${phoneForStorage}`)
              successCount++
              await retrySupabaseOperation(async () => {
                const { error } = await supabase
                  .from('campaign_recipients')
                  .update({ status: 'sent', sent_at: new Date().toISOString() })
                  .eq('id', recipientRecord.id)
                if (error) throw error
              })
            } else {
              console.error(`✗ WhatsApp failed to ${phoneForStorage}:`, exotelResult)
              await retrySupabaseOperation(async () => {
                const { error } = await supabase
                  .from('campaign_recipients')
                  .update({
                    status: 'failed',
                    error_message: exotelResult?.message || 'Exotel API error',
                  })
                  .eq('id', recipientRecord.id)
                if (error) throw error
              })
            }
          } catch (waError: any) {
            console.error(`✗ WhatsApp error for ${phoneForStorage}:`, waError.message)
            await retrySupabaseOperation(async () => {
              const { error } = await supabase
                .from('campaign_recipients')
                .update({ status: 'failed', error_message: waError.message })
                .eq('id', recipientRecord.id)
              if (error) throw error
            })
          }
        }
        
        // Apply rate limiting delay between sends
        if (i < filteredAudience.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        
        // Batch delay: pause after every batchSize emails
        if ((i + 1) % batchSize === 0 && i < filteredAudience.length - 1) {
          console.log(`Processed ${i + 1}/${totalRecipients} emails, pausing for ${batchDelayMs}ms before next batch...`);
          await new Promise(resolve => setTimeout(resolve, batchDelayMs));
        }
        
        // Update campaign progress after each recipient with retry
        await retrySupabaseOperation(
          async () => {
            const { error } = await supabase
              .from('campaigns')
              .update({
                sent_count: successCount,
              })
              .eq('id', campaign_id)
            if (error) throw error
          },
          2,
          500
        )
      } catch (error) {
        console.error('Error processing recipient:', error)
      }
    }

    // Update campaign status with retry (critical operation)
    // Only mark as 'sent' if we actually sent emails successfully
    const finalStatus = successCount > 0 ? 'sent' : 'failed';
    const updateData: any = {
      status: finalStatus,
      sent_count: successCount,
      delivered_count: 0, // Will be updated by webhooks
      opened_count: 0,
      clicked_count: 0,
    };

    // Only set sent_at if we actually sent emails
    if (successCount > 0) {
      updateData.sent_at = new Date().toISOString();
    }

    await retrySupabaseOperation(
      async () => {
        const { error } = await supabase
          .from('campaigns')
          .update(updateData)
          .eq('id', campaign_id)
        if (error) throw error
      },
      3,
      1000
    )

    console.log(`Campaign ${campaign_id} completed with status: ${finalStatus} (${successCount}/${audienceData.length} sent, ${skippedCount} skipped)`)

    return new Response(
        JSON.stringify({
        success: true,
        sent_count: successCount,
        skipped_count: skippedCount,
        total_recipients: filteredAudience.length,
        message: skippedCount > 0 
          ? `${successCount} sent, ${skippedCount} skipped (unsubscribed or sent same template within 15 days)`
          : `${successCount} sent successfully`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('=== CAMPAIGN PROCESSING FAILED ===')
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      campaignId,
    })

    // Critical: Rollback campaign status to failed
    if (campaignId) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseKey)
        
        await retrySupabaseOperation(async () => {
          const { error } = await supabase
            .from('campaigns')
            .update({ 
              status: 'failed',
              updated_at: new Date().toISOString()
            })
            .eq('id', campaignId)
          if (error) throw error
        })
        console.log('Campaign status rolled back to failed')
      } catch (rollbackError) {
        console.error('Failed to rollback campaign status:', rollbackError)
      }
    }

    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Check edge function logs for more information'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
