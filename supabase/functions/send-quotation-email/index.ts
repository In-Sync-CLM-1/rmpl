import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface QuotationEmailRequest {
  quotation_id: string;
  recipient_email: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { quotation_id, recipient_email }: QuotationEmailRequest = await req.json();

    console.log("Fetching quotation:", quotation_id);

    // Fetch quotation with project and master details
    const { data: quotation, error: quotationError } = await supabaseClient
      .from("project_quotations")
      .select(`
        *,
        projects (
          project_name,
          brief,
          location_city,
          location_state,
          master (
            name,
            company_name,
            official
          )
        )
      `)
      .eq("id", quotation_id)
      .single();

    if (quotationError) {
      console.error("Error fetching quotation:", quotationError);
      throw new Error(`Failed to fetch quotation: ${quotationError.message}`);
    }

    console.log("Quotation fetched successfully:", quotation);

    // Prepare email content
    const project = quotation.projects;
    const client = project.master;
    
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9fafb; }
            .quotation-details { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; }
            .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
            .detail-label { font-weight: bold; color: #6b7280; }
            .detail-value { color: #111827; }
            .total { font-size: 24px; font-weight: bold; color: #2563eb; text-align: right; margin-top: 20px; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Project Quotation</h1>
              <p>${quotation.quotation_number}</p>
            </div>
            <div class="content">
              <h2>Dear ${client?.name || 'Valued Client'},</h2>
              <p>Thank you for considering our services. Please find below the quotation for your project:</p>
              
              <div class="quotation-details">
                <div class="detail-row">
                  <span class="detail-label">Project Name:</span>
                  <span class="detail-value">${project.project_name}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Company:</span>
                  <span class="detail-value">${client?.company_name || 'N/A'}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Location:</span>
                  <span class="detail-value">${project.location_city}, ${project.location_state}</span>
                </div>
                ${quotation.notes ? `
                <div class="detail-row">
                  <span class="detail-label">Notes:</span>
                  <span class="detail-value">${quotation.notes}</span>
                </div>
                ` : ''}
                <div class="total">
                  Total: ${quotation.currency} ${parseFloat(quotation.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              
              <p>If you have any questions or would like to discuss this quotation, please don't hesitate to contact us.</p>
              <p>We look forward to working with you on this project.</p>
            </div>
            <div class="footer">
              <p>This is an automated email. Please do not reply directly to this message.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    console.log("Sending email to:", recipient_email);

    const emailResponse = await resend.emails.send({
      from: "Projects <onboarding@resend.dev>",
      to: [recipient_email],
      subject: `Project Quotation - ${quotation.quotation_number}`,
      html: emailHtml,
    });

    console.log("Email sent successfully:", emailResponse);

    // Update quotation status to 'sent'
    const { error: updateError } = await supabaseClient
      .from("project_quotations")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        sent_to_email: recipient_email,
      })
      .eq("id", quotation_id);

    if (updateError) {
      console.error("Error updating quotation status:", updateError);
    }

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-quotation-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
