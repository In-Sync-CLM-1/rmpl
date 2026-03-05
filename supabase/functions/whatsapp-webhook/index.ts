 import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
 
 const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
 };
 
 // Exotel status code mapping
 const EXOTEL_STATUS_MAP: Record<number, string> = {
   30001: 'sent',
   30002: 'delivered',
   30003: 'read',
   30004: 'failed',
   30005: 'failed', // expired
 };
 
 // Normalize phone number with + prefix
 function normalizePhoneNumber(phone: string): string {
   let cleaned = phone.replace(/[^\d+]/g, '');
   if (!cleaned.startsWith('+')) {
     if (cleaned.length === 10) cleaned = '+91' + cleaned;
     else if (cleaned.startsWith('91') && cleaned.length === 12) cleaned = '+' + cleaned;
     else cleaned = '+' + cleaned;
   }
   return cleaned;
 }
 
 interface ParsedMessage {
   type: 'inbound' | 'dlr' | 'unknown';
   sid: string;
   from: string;
   to: string;
   body: string;
   status: string;
   profileName: string;
   timestamp: string | null;
   errorMessage: string | null;
   mediaUrl: string | null;
   mediaType: string | null;
 }
 
 // Parse Exotel nested payload format
 function parseExotelPayload(payload: any): ParsedMessage | null {
   if (payload?.whatsapp?.messages?.[0]) {
     const msg = payload.whatsapp.messages[0];
 
     let type: 'inbound' | 'dlr' | 'unknown' = 'unknown';
     if (msg.callback_type === 'incoming_message') type = 'inbound';
     else if (msg.callback_type === 'dlr') type = 'dlr';
 
     // Extract body and media from content
     let body = '';
     let mediaUrl: string | null = null;
     let mediaType: string | null = null;
     const contentType = msg.content?.type;
 
     if (contentType === 'text') {
       body = msg.content.text?.body || '';
     } else if (contentType === 'button') {
       body = msg.content.button?.text || '';
     } else if (['image', 'document', 'video', 'audio', 'sticker'].includes(contentType)) {
       mediaUrl = msg.content[contentType]?.url || msg.content[contentType]?.link;
       mediaType = contentType;
       body = msg.content[contentType]?.caption || `[${contentType}]`;
     }
 
     // Map status code for DLR
     let status = '';
     if (msg.exo_status_code) {
       status = EXOTEL_STATUS_MAP[msg.exo_status_code] || 'unknown';
     }
 
     return {
       type,
       sid: msg.sid || '',
       from: msg.from || '',
       to: msg.to || '',
       body,
       status,
       profileName: msg.profile_name || '',
       timestamp: msg.timestamp || null,
       errorMessage: msg.description || null,
       mediaUrl,
       mediaType,
     };
   }
   return null;
 }
 
 Deno.serve(async (req) => {
   if (req.method === 'OPTIONS') {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
     const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
     
     const supabase = createClient(supabaseUrl, supabaseServiceKey, {
       auth: { persistSession: false },
     });
 
     const payload = await req.json();
     console.log('Received webhook:', JSON.stringify(payload));
 
     const normalizedMsg = parseExotelPayload(payload);
     if (!normalizedMsg) {
       console.log('Could not parse payload');
       return new Response(
         JSON.stringify({ success: true, message: 'Payload not recognized' }),
         { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     // Handle INBOUND messages
     if (normalizedMsg.type === 'inbound' && (normalizedMsg.body || normalizedMsg.mediaUrl)) {
       const phoneNumber = normalizePhoneNumber(normalizedMsg.from);
       console.log('Processing inbound message from:', phoneNumber);
 
       // Try to find matching demandcom by phone
       const digitsOnly = phoneNumber.replace(/[^\d]/g, '');
       const { data: demandcom } = await supabase
         .from('demandcom')
         .select('id')
         .or(`mobile_numb.eq.${phoneNumber},mobile_numb.eq.${digitsOnly},mobile_numb.ilike.%${digitsOnly.slice(-10)}`)
         .limit(1)
         .single();
 
       const demandcomId = demandcom?.id || null;
 
       // Store inbound message
       const { error: insertError } = await supabase.from('whatsapp_messages').insert({
         demandcom_id: demandcomId,
         direction: 'inbound',
         message_content: normalizedMsg.body,
         phone_number: phoneNumber,
         exotel_message_id: normalizedMsg.sid,
         status: 'received',
         sent_at: normalizedMsg.timestamp ? new Date(normalizedMsg.timestamp).toISOString() : new Date().toISOString(),
         media_url: normalizedMsg.mediaUrl,
         media_type: normalizedMsg.mediaType,
       });
 
       if (insertError) {
         console.error('Error storing inbound message:', insertError);
       }
 
       return new Response(
         JSON.stringify({ success: true, message: 'Inbound message stored' }),
         { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     // Handle DELIVERY REPORTS (DLR)
     if (normalizedMsg.type === 'dlr' && normalizedMsg.status && normalizedMsg.sid) {
       console.log('Processing DLR for SID:', normalizedMsg.sid, 'Status:', normalizedMsg.status);
 
       const timestamp = normalizedMsg.timestamp 
         ? new Date(normalizedMsg.timestamp).toISOString() 
         : new Date().toISOString();
 
       // Find message by exotel_message_id
       const { data: message } = await supabase
         .from('whatsapp_messages')
         .select('*')
         .eq('exotel_message_id', normalizedMsg.sid)
         .single();
 
       if (message) {
         const updateData: any = { status: normalizedMsg.status };
 
         if (normalizedMsg.status === 'delivered' || normalizedMsg.status === 'sent') {
           updateData.delivered_at = timestamp;
         } else if (normalizedMsg.status === 'read') {
           updateData.read_at = timestamp;
           if (!message.delivered_at) {
             updateData.delivered_at = timestamp;
           }
         } else if (normalizedMsg.status === 'failed') {
           updateData.error_message = normalizedMsg.errorMessage || 'Delivery failed';
         }
 
         const { error: updateError } = await supabase
           .from('whatsapp_messages')
           .update(updateData)
           .eq('id', message.id);
 
         if (updateError) {
           console.error('Error updating message status:', updateError);
         }
       } else {
         console.log('Message not found for SID:', normalizedMsg.sid);
       }
 
       return new Response(
         JSON.stringify({ success: true, message: 'DLR processed' }),
         { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     return new Response(
       JSON.stringify({ success: true, message: 'Webhook received' }),
       { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
   } catch (error) {
     console.error('Error in whatsapp-webhook:', error);
     return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
       { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
   }
 });