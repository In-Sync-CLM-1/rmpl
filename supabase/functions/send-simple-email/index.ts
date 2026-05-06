import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendSimpleEmailRequest {
  to_email: string;
  to_name: string;
  from_name?: string;
  reply_to?: string;
  subject: string;
  html_body: string;
  demandcom_id?: string;
  template_id?: string;
  merge_data?: Record<string, any>;
}

function replaceMergeTags(text: string, data: Record<string, any>): string {
  let result = text;
  
  Object.keys(data).forEach(key => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    const value = data[key] || '';
    result = result.replace(regex, String(value));
  });
  
  return result;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Verify user is authenticated
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { 
      to_email, 
      to_name, 
      from_name = 'RMPL',
      reply_to,
      subject, 
      html_body,
      demandcom_id,
      template_id,
      merge_data = {}
    }: SendSimpleEmailRequest = await req.json();

    // Validation
    if (!to_email || !subject || !html_body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to_email, subject, html_body' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to_email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email address format' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Sending email from ${user.email} to ${to_email} (${to_name})`);

    // Replace merge tags in subject and body
    const processedSubject = replaceMergeTags(subject, merge_data);
    const processedBody = replaceMergeTags(html_body, merge_data);

    // Log to email_activity_log first so we can use the row id as the
    // reply-thread token. If caller passed an explicit reply_to, we honour it
    // and skip threading (back-compat for approval/system emails).
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    let activityLogId: string | null = null;
    if (!reply_to) {
      const { data: logRow, error: logErr } = await serviceClient
        .from('email_activity_log')
        .insert({
          sent_by: user.id,
          provider: 'resend',
          from_email: 'approval@redefinemarcom.in',
          to_email,
          subject: processedSubject,
          demandcom_id: demandcom_id || null,
          template_id: template_id || null,
          status: 'pending',
          sent_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      if (logErr) {
        console.warn('email_activity_log insert failed (continuing without threading):', logErr);
      } else if (logRow) {
        activityLogId = (logRow as any).id;
      }
    }

    const threadedReplyTo = activityLogId
      ? `reply+${activityLogId}@reply.rmpl.in-sync.co.in`
      : reply_to || undefined;

    // Initialize Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const resend = new Resend(resendApiKey);

    // Send email
    const emailResponse = await resend.emails.send({
      from: `${from_name} <approval@redefinemarcom.in>`,
      to: [to_email],
      subject: processedSubject,
      html: processedBody,
      reply_to: threadedReplyTo,
    });

    if (emailResponse.error) {
      console.error('Resend error:', emailResponse.error);
      if (activityLogId) {
        await serviceClient
          .from('email_activity_log')
          .update({ status: 'failed', error_message: emailResponse.error.message })
          .eq('id', activityLogId);
      }
      throw new Error(emailResponse.error.message || 'Failed to send email');
    }

    if (activityLogId) {
      await serviceClient
        .from('email_activity_log')
        .update({ status: 'sent' })
        .eq('id', activityLogId);
    }

    console.log(`Email sent successfully. Resend ID: ${emailResponse.data?.id}`);

    // Optional: Log to database (future enhancement)
    // Uncomment when email_logs table is created
    /*
    if (demandcom_id) {
      await supabase.from('email_logs').insert({
        demandcom_id,
        to_email,
        subject: processedSubject,
        template_id,
        sent_at: new Date().toISOString(),
        email_id: emailResponse.data?.id,
        sent_by: user.id,
      });
    }
    */

    return new Response(
      JSON.stringify({ 
        success: true, 
        email_id: emailResponse.data?.id,
        message: 'Email sent successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error: any) {
    console.error('Error in send-simple-email:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to send email',
        details: error.toString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
