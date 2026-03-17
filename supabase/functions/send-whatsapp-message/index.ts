 import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
 
 const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
 };
 
 interface SendMessageRequest {
   demandcomId?: string;
   phoneNumber: string;
   templateId?: string;
   templateName?: string;
   templateVariables?: Record<string, string>;
   templateComponents?: Array<{
     type: string;
     parameters: Array<{ type: string; text: string }>;
   }>;
   message?: string;
   mediaType?: 'image' | 'document' | 'video' | 'audio';
   mediaUrl?: string;
   mediaCaption?: string;
 }
 
 // Normalize phone number with + prefix for storage
 function normalizePhoneNumber(phone: string): string {
   let cleaned = phone.replace(/[^\d+]/g, '');
   if (!cleaned.startsWith('+')) {
     if (cleaned.length === 10) cleaned = '+91' + cleaned;
     else if (cleaned.startsWith('91') && cleaned.length === 12) cleaned = '+' + cleaned;
     else cleaned = '+' + cleaned;
   }
   return cleaned;
 }
 
 // Format phone for Exotel API (digits only)
 function phoneForExotel(phone: string): string {
   return normalizePhoneNumber(phone).replace(/^\+/, '');
 }
 
 // Extract message SID from Exotel response
 function extractMessageSid(exotelResult: any): string | null {
   return exotelResult?.response?.whatsapp?.messages?.[0]?.data?.sid ||
          exotelResult?.sid ||
          exotelResult?.id ||
          null;
 }
 
 // Find demandcom by phone number
async function findDemandcomByPhone(supabase: any, phoneNumber: string): Promise<string | undefined> {
   const normalized = normalizePhoneNumber(phoneNumber);
   const digitsOnly = phoneNumber.replace(/[^\d]/g, '');
   
   // Try multiple phone formats
   const { data } = await supabase
     .from('demandcom')
     .select('id')
     .or(`mobile_numb.eq.${normalized},mobile_numb.eq.${digitsOnly},mobile_numb.ilike.%${digitsOnly.slice(-10)}`)
     .limit(1)
     .single();
   
  return data?.id || undefined;
 }
 
 Deno.serve(async (req) => {
   if (req.method === 'OPTIONS') {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     const authHeader = req.headers.get('Authorization');
     if (!authHeader?.startsWith('Bearer ')) {
       return new Response(
         JSON.stringify({ error: 'Unauthorized' }),
         { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
     const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
     
     const supabase = createClient(supabaseUrl, supabaseAnonKey, {
       global: { headers: { Authorization: authHeader } },
       auth: { persistSession: false },
     });
 
     // Verify user
     const { data: { user }, error: userError } = await supabase.auth.getUser();
     if (userError || !user) {
       return new Response(
         JSON.stringify({ error: 'Unauthorized' }),
         { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
     const userId = user.id;
 
     const body: SendMessageRequest = await req.json();
     const { 
       demandcomId, 
       phoneNumber, 
       templateId, 
       templateName,
       templateVariables, 
       templateComponents,
       message, 
       mediaType, 
       mediaUrl, 
       mediaCaption 
     } = body;
 
     if (!phoneNumber) {
       return new Response(
         JSON.stringify({ error: 'Phone number is required' }),
         { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     // Get WhatsApp settings
     const { data: whatsappSettings, error: settingsError } = await supabase
       .from('whatsapp_settings')
       .select('*')
       .eq('is_active', true)
       .single();
 
     if (settingsError || !whatsappSettings) {
       return new Response(
         JSON.stringify({ error: 'WhatsApp not configured. Please set up WhatsApp settings.' }),
         { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     // Use env vars if not stored in settings
     const exotelSid = whatsappSettings.exotel_sid || Deno.env.get('EXOTEL_SID');
     const exotelApiKey = whatsappSettings.exotel_api_key || Deno.env.get('EXOTEL_API_KEY');
     const exotelApiToken = whatsappSettings.exotel_api_token || Deno.env.get('EXOTEL_API_TOKEN');
     const exotelSubdomain = whatsappSettings.exotel_subdomain || 'api.exotel.com';
 
     if (!exotelSid || !exotelApiKey || !exotelApiToken) {
       return new Response(
         JSON.stringify({ error: 'Exotel credentials not configured' }),
         { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     // Resolve demandcom ID
     let resolvedDemandcomId = demandcomId;
     if (!resolvedDemandcomId) {
       resolvedDemandcomId = await findDemandcomByPhone(supabase, phoneNumber);
     }
 
     // Format phone numbers
     const phoneDigits = phoneForExotel(phoneNumber);
     const phoneForStorage = normalizePhoneNumber(phoneNumber);
 
     let messageContent = message || '';
     let useTemplateApi = false;
 
     // If using templateName directly (hardcoded template)
     if (templateName) {
       useTemplateApi = true;
       messageContent = `[Template: ${templateName}]`;
     }
     // If using database template, fetch and replace variables
     else if (templateId) {
       const { data: template } = await supabase
         .from('whatsapp_templates')
         .select('*')
         .eq('id', templateId)
         .single();
 
       if (template) {
         messageContent = template.content;
         useTemplateApi = true;
         
         // Replace {{key}} placeholders with values for logging
         if (templateVariables) {
           Object.entries(templateVariables).forEach(([key, value]) => {
             messageContent = messageContent.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
           });
         }
       }
     }
 
     // Build Exotel API URL
     const exotelUrl = `https://${exotelSubdomain}/v2/accounts/${exotelSid}/messages`;
 
     let exotelPayload: any;
 
     if (useTemplateApi && templateName) {
       // Template message with direct name
       exotelPayload = {
         whatsapp: {
           messages: [{
             from: whatsappSettings.whatsapp_source_number,
             to: phoneDigits,
             content: {
               type: 'template',
               template: {
                 name: templateName,
                 language: { code: 'en' },
                 components: templateComponents || []
               }
             }
           }]
         }
       };
     } else if (useTemplateApi && templateId) {
       // Template message from database
       const { data: template } = await supabase
         .from('whatsapp_templates')
         .select('template_name, language')
         .eq('id', templateId)
         .single();
 
       if (template) {
         // Build components from template variables
         const components: any[] = [];
         if (templateVariables && Object.keys(templateVariables).length > 0) {
           const bodyParams = Object.values(templateVariables).map(value => ({
             type: 'text',
             text: value
           }));
           components.push({
             type: 'body',
             parameters: bodyParams
           });
         }
 
         exotelPayload = {
           whatsapp: {
             messages: [{
               from: whatsappSettings.whatsapp_source_number,
               to: phoneDigits,
               content: {
                 type: 'template',
                 template: {
                   name: template.template_name,
                   language: { code: template.language || 'en' },
                   components
                 }
               }
             }]
           }
         };
       }
     } else if (mediaUrl && mediaType) {
       // Media message
       exotelPayload = {
         whatsapp: {
           messages: [{
             from: whatsappSettings.whatsapp_source_number,
             to: phoneDigits,
             content: {
               type: mediaType,
               [mediaType]: {
                 link: mediaUrl,
                 ...(mediaCaption && { caption: mediaCaption })
               }
             }
           }]
         }
       };
       messageContent = mediaCaption || `[${mediaType}]`;
     } else {
       // Text message
       exotelPayload = {
         whatsapp: {
           messages: [{
             from: whatsappSettings.whatsapp_source_number,
             to: phoneDigits,
             content: {
               type: 'text',
               text: { body: messageContent }
             }
           }]
         }
       };
     }
 
     console.log('Sending WhatsApp message:', JSON.stringify(exotelPayload));
 
     // Send via Exotel API
     const exotelResponse = await fetch(exotelUrl, {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         'Authorization': `Basic ${btoa(`${exotelApiKey}:${exotelApiToken}`)}`,
       },
       body: JSON.stringify(exotelPayload),
     });
 
     const responseText = await exotelResponse.text();
     console.log('Exotel response:', responseText);
 
     // Parse response
     let exotelResult: any;
     try {
       exotelResult = JSON.parse(responseText);
     } catch {
       const jsonMatch = responseText.match(/\{[\s\S]*\}/);
       exotelResult = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: responseText };
     }
 
     const exotelSidResult = extractMessageSid(exotelResult);
     const success = !!exotelSidResult;
 
     // Log message to database
     const { error: insertError } = await supabase.from('whatsapp_messages').insert({
       demandcom_id: resolvedDemandcomId,
       template_id: templateId || null,
       template_name: templateName || null,
       sent_by: userId,
       phone_number: phoneForStorage,
       message_content: messageContent,
       template_variables: templateVariables || null,
       exotel_message_id: exotelSidResult,
       status: success ? 'sent' : 'failed',
       direction: 'outbound',
       sent_at: new Date().toISOString(),
       media_url: mediaUrl || null,
       media_type: mediaType || null,
       error_message: success ? null : (exotelResult?.message || exotelResult?.error || 'Failed to send'),
     });
 
     if (insertError) {
       console.error('Error logging message:', insertError);
     }
 
     return new Response(
       JSON.stringify({ 
         success, 
         messageId: exotelSidResult,
         error: success ? null : (exotelResult?.message || 'Failed to send message')
       }),
       { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
   } catch (error) {
     console.error('Error in send-whatsapp-message:', error);
     return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
       { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
   }
 });