import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'https://esm.sh/resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FROM_EMAIL = 'RMPL OPM <approval@redefinemarcom.in>';
const CC_EMAIL = 's.ray@redefine.in';
const LOGO_URL = 'https://redefine.in/assets/img/logo.png';
// Reminders at 7, 10, 13 days after event
const REMINDER_DAYS = [7, 10, 13];
const TEMPLATE_NAME = 'rmpl_invoice_reminder';

function formatDateIST(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00+05:30');
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (!cleaned.startsWith('+')) {
    if (cleaned.length === 10) cleaned = '+91' + cleaned;
    else if (cleaned.startsWith('91') && cleaned.length === 12) cleaned = '+' + cleaned;
    else cleaned = '+' + cleaned;
  }
  return cleaned;
}

function buildReminderEmail(
  ownerName: string,
  projectName: string,
  eventDate: string,
  daysSince: number
): string {
  const reminderNum = REMINDER_DAYS.indexOf(daysSince) + 1;
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background-color:#f0f2f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f2f5;padding:30px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#1e3a5f 0%,#0d2137 100%);padding:28px 30px;text-align:center;">
            <img src="${LOGO_URL}" alt="RMPL" height="48" style="height:48px;width:auto;" />
          </td>
        </tr>
        <tr>
          <td style="padding:36px 30px 24px 30px;">
            <h2 style="color:#1e3a5f;margin:0 0 6px 0;font-size:20px;">Invoice Reminder ${reminderNum > 1 ? `(Reminder ${reminderNum})` : ''}</h2>
            <p style="color:#6c757d;font-size:14px;margin:0 0 24px 0;">
              Hi ${ownerName}, this is a reminder to raise the invoice for the following project.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f9fa;border-radius:8px;margin-bottom:24px;">
              <tr><td style="padding:20px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:6px 0;color:#6c757d;font-size:13px;width:140px;">Project</td>
                    <td style="padding:6px 0;color:#212529;font-size:14px;font-weight:600;">${projectName}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;color:#6c757d;font-size:13px;">Event Date</td>
                    <td style="padding:6px 0;color:#212529;font-size:14px;font-weight:600;">${eventDate}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;color:#6c757d;font-size:13px;">Days Elapsed</td>
                    <td style="padding:6px 0;color:#dc3545;font-size:14px;font-weight:700;">${daysSince} days</td>
                  </tr>
                </table>
              </td></tr>
            </table>
            <p style="color:#495057;font-size:14px;margin:0 0 16px 0;">
              Please raise the invoice at your earliest convenience to ensure timely billing.
            </p>
            <p style="color:#adb5bd;font-size:12px;text-align:center;margin:0;">
              If the invoice has already been raised, please ignore this message.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#f8f9fa;padding:20px 30px;text-align:center;border-top:1px solid #e9ecef;">
            <p style="color:#6c757d;font-size:12px;margin:0 0 4px 0;"><strong>RMPL OPM</strong> &mdash; Operations &amp; Project Management</p>
            <p style="color:#adb5bd;font-size:11px;margin:0;">This is an automated notification. Please do not reply to this email.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendWhatsApp(
  settings: any,
  phone: string,
  params: string[]
): Promise<void> {
  try {
    const phoneDigits = normalizePhone(phone).replace(/^\+/, '');
    const url = `https://${settings.exotel_subdomain || 'api.exotel.com'}/v2/accounts/${settings.exotel_sid}/messages`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${btoa(`${settings.exotel_api_key}:${settings.exotel_api_token}`)}`,
      },
      body: JSON.stringify({
        whatsapp: {
          messages: [
            {
              from: settings.whatsapp_source_number,
              to: phoneDigits,
              content: {
                type: 'template',
                template: {
                  name: TEMPLATE_NAME,
                  language: { code: 'en' },
                  components: [
                    {
                      type: 'body',
                      parameters: params.map((text) => ({ type: 'text', text })),
                    },
                  ],
                },
              },
            },
          ],
        },
      }),
    });

    const result = await response.text();
    console.log(`WhatsApp [${TEMPLATE_NAME}] to ${phone}:`, result);
  } catch (err) {
    console.error('WhatsApp send failed (non-blocking):', err);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    });

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) throw new Error('RESEND_API_KEY not configured');
    const resend = new Resend(resendApiKey);

    // Get WhatsApp settings once (reused for all messages)
    const { data: waSettings } = await supabase
      .from('whatsapp_settings')
      .select('*')
      .eq('is_active', true)
      .single();

    // Today's date in IST (YYYY-MM-DD)
    const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayIST = `${nowIST.getFullYear()}-${pad(nowIST.getMonth() + 1)}-${pad(nowIST.getDate())}`;

    let totalSent = 0;
    const results: Array<{ project: string; day: number; email: boolean; wa: boolean }> = [];

    for (const daysAgo of REMINDER_DAYS) {
      const targetDate = new Date(nowIST);
      targetDate.setDate(targetDate.getDate() - daysAgo);
      const targetDateStr = `${targetDate.getFullYear()}-${pad(targetDate.getMonth() + 1)}-${pad(targetDate.getDate())}`;

      // Fetch projects whose event_dates array contains targetDateStr
      const { data: projects, error } = await supabase
        .from('projects')
        .select(`
          id,
          project_name,
          event_dates,
          project_owner,
          profiles!projects_project_owner_fkey (
            id, full_name, email, phone
          ),
          project_quotations (
            id, invoice_date, status
          )
        `)
        .contains('event_dates', [targetDateStr]);

      if (error) {
        console.error(`Day ${daysAgo} query error:`, error);
        continue;
      }

      for (const project of projects || []) {
        const owner = project.profiles as any;
        if (!owner?.email) {
          console.log(`Project ${project.id}: owner has no email, skipping`);
          continue;
        }

        // Skip if invoice already raised (invoice_date set OR status sent/approved)
        const quotations = (project.project_quotations as any[]) || [];
        const invoiceRaised = quotations.some(
          (q) => q.invoice_date !== null || ['sent', 'approved'].includes(q.status)
        );
        if (invoiceRaised) {
          console.log(`Project ${project.id}: invoice already raised, skipping`);
          continue;
        }

        const ownerName = owner.full_name || 'Project Owner';
        const projectName = project.project_name;
        const eventDateFormatted = formatDateIST(targetDateStr);
        const reminderNum = REMINDER_DAYS.indexOf(daysAgo) + 1;
        const subject = `Reminder ${reminderNum}: Raise Invoice for "${projectName}" (${daysAgo} days since event)`;

        let emailSent = false;
        let waSent = false;

        // Send email
        try {
          await resend.emails.send({
            from: FROM_EMAIL,
            to: [owner.email],
            cc: [CC_EMAIL],
            subject,
            html: buildReminderEmail(ownerName, projectName, eventDateFormatted, daysAgo),
          });
          emailSent = true;
          console.log(`Email sent → ${owner.email} | project: ${projectName} | day: ${daysAgo}`);
        } catch (emailErr) {
          console.error(`Email failed for project ${project.id}:`, emailErr);
        }

        // Send WhatsApp (non-blocking)
        if (waSettings?.exotel_sid && owner.phone) {
          await sendWhatsApp(waSettings, owner.phone, [
            ownerName,
            projectName,
            eventDateFormatted,
            String(daysAgo),
          ]);
          waSent = true;
        }

        results.push({ project: projectName, day: daysAgo, email: emailSent, wa: waSent });
        totalSent++;
      }
    }

    console.log(`Invoice reminders run complete. Sent: ${totalSent}`);

    return new Response(
      JSON.stringify({ success: true, reminders_sent: totalSent, details: results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in invoice-reminder-cron:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
