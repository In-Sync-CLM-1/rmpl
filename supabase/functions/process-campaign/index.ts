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

    // Critical validation: RESEND_API_KEY must exist
    if (!resendApiKey) {
      console.error('FATAL: RESEND_API_KEY not configured')
      throw new Error('RESEND_API_KEY not configured. Please add it in the backend settings.')
    }

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
    const templateTable = campaign.type === 'email' ? 'email_templates' : 'sms_templates'
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

    console.log('Template fetched successfully:', template.name)

    // Process each recipient with rate limiting
    let successCount = 0
    let skippedCount = 0
    const totalRecipients = filteredAudience.length;
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
    
    // Hardcoded rate limiting: 10 emails/min (6 second delay) - slow/safe mode
    const delayMs = 6000; // 6 seconds between emails
    const batchSize = 50; // Process in batches to avoid timeouts
    const batchDelayMs = 10000; // 10 second pause between batches
    
    console.log(`Starting campaign with rate limit: 10 emails/min, ${delayMs}ms delay between sends`);
    
    for (let i = 0; i < filteredAudience.length; i++) {
      const recipient = filteredAudience[i];
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

        // Send email or SMS with retry for edge function invocation
        if (campaign.type === 'email') {
          console.log(`Sending email to ${recipient.email} (${i + 1}/${filteredAudience.length})`)
          console.log('Invoking send-campaign-email with:', {
            recipient_id: recipientRecord.id,
            campaign_id: campaign.id,
            candidate_email: recipient.email,
            candidate_name: `${recipient.first_name} ${recipient.last_name}`,
            template_name: template.name,
            subject: campaign.subject
          })
          
          const { error: sendError } = await retryWithBackoff(
            async () => {
              const result = await supabase.functions.invoke('send-campaign-email', {
                body: {
                  recipient_id: recipientRecord.id,
                  campaign_id: campaign.id,
                  candidate: recipient, // FIXED: Changed from job_seeker to candidate
                  template: template,
                  subject: campaign.subject,
                  reply_to_email: replyToEmail,
                },
              })
              if (result.error) throw result.error
              return result
            },
            2, // max attempts for edge function
            2000, // 2 second initial delay
            2,
            (error) => {
              // Retry on network/timeout errors, but not on validation errors
              return error.message?.includes('network') || 
                     error.message?.includes('timeout') ||
                     error.status >= 500
            }
          )

          if (sendError) {
            console.error(`✗ Failed to send email to ${recipient.email}:`, {
              error: sendError.message,
              recipientId: recipientRecord.id,
              stack: sendError.stack
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
