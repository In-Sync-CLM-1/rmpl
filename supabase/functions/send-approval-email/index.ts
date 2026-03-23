import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOGO_URL = "https://redefine.in/assets/img/logo.png";
const FROM_EMAIL = "RMPL OPM <approval@redefinemarcom.in>";

function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[^\d+]/g, "");
  if (!cleaned.startsWith("+")) {
    if (cleaned.length === 10) cleaned = "+91" + cleaned;
    else if (cleaned.startsWith("91") && cleaned.length === 12) cleaned = "+" + cleaned;
    else cleaned = "+" + cleaned;
  }
  return cleaned;
}

async function sendWhatsAppNotification(
  supabase: any,
  phoneNumber: string,
  message: string
) {
  try {
    if (!phoneNumber) return;

    const { data: settings } = await supabase
      .from("whatsapp_settings")
      .select("*")
      .eq("is_active", true)
      .single();

    if (!settings) {
      console.log("WhatsApp not configured, skipping notification");
      return;
    }

    const exotelSid = settings.exotel_sid;
    const exotelApiKey = settings.exotel_api_key;
    const exotelApiToken = settings.exotel_api_token;
    const exotelSubdomain = settings.exotel_subdomain || "api.exotel.com";
    const sourceNumber = settings.whatsapp_source_number;

    if (!exotelSid || !exotelApiKey || !exotelApiToken || !sourceNumber) {
      console.log("Exotel credentials incomplete, skipping WhatsApp");
      return;
    }

    const phoneDigits = normalizePhone(phoneNumber).replace(/^\+/, "");
    const url = `https://${exotelSubdomain}/v2/accounts/${exotelSid}/messages`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${btoa(`${exotelApiKey}:${exotelApiToken}`)}`,
      },
      body: JSON.stringify({
        whatsapp: {
          messages: [
            {
              from: sourceNumber,
              to: phoneDigits,
              content: { type: "text", text: { body: message } },
            },
          ],
        },
      }),
    });

    const responseText = await response.text();
    console.log("WhatsApp notification response:", responseText);
  } catch (err) {
    console.error("WhatsApp notification failed (non-blocking):", err);
  }
}

const LEAVE_TYPE_LABELS: Record<string, string> = {
  casual_leave: "Casual Leave",
  earned_leave: "Earned Leave",
  sick_leave: "Sick Leave",
  unpaid_leave: "Unpaid Leave",
  compensatory_off: "Compensatory Off",
  maternity_leave: "Maternity Leave",
  paternity_leave: "Paternity Leave",
};

const REGULARIZATION_TYPE_LABELS: Record<string, string> = {
  forgot_signin: "Forgot Sign-In",
  forgot_signout: "Forgot Sign-Out",
  time_correction: "Time Correction",
  location_issue: "Location Issue",
  other: "Other",
};

function formatDate(dateStr: string): string {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(timeStr: string): string {
  if (!timeStr) return "N/A";
  const d = new Date(timeStr);
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function buildEmailWrapper(content: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f0f2f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0f2f5; padding: 30px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.08);">
          <!-- Header with RMPL Logo -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a5f 0%, #0d2137 100%); padding: 28px 30px; text-align: center;">
              <img src="${LOGO_URL}" alt="RMPL" height="48" style="height: 48px; width: auto;" />
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 36px 30px 24px 30px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #e9ecef;">
              <p style="color: #6c757d; font-size: 12px; margin: 0 0 4px 0;">
                <strong>RMPL OPM</strong> &mdash; Operations & Project Management
              </p>
              <p style="color: #adb5bd; font-size: 11px; margin: 0;">
                This is an automated notification. Please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildLeaveApprovalEmail(data: any): { subject: string; html: string } {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const approveUrl = `${supabaseUrl}/functions/v1/handle-approval?token=${data.approve_token}&action=approve`;
  const rejectUrl = `${supabaseUrl}/functions/v1/handle-approval?token=${data.reject_token}&action=reject`;
  const leaveLabel =
    LEAVE_TYPE_LABELS[data.leave_type] || data.leave_type || "Leave";

  const subject = `Leave Approval Required: ${data.employee_name} — ${leaveLabel}`;

  const content = `
    <h2 style="color: #1e3a5f; margin: 0 0 6px 0; font-size: 20px;">Leave Approval Request</h2>
    <p style="color: #6c757d; font-size: 14px; margin: 0 0 24px 0;">
      Hi ${data.manager_name || "Manager"}, a leave request needs your attention.
    </p>

    <!-- Request Details Card -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-radius: 8px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 20px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding: 6px 0; color: #6c757d; font-size: 13px; width: 140px;">Employee</td>
              <td style="padding: 6px 0; color: #212529; font-size: 14px; font-weight: 600;">${data.employee_name}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6c757d; font-size: 13px;">Leave Type</td>
              <td style="padding: 6px 0;">
                <span style="background-color: #e7f1ff; color: #0d6efd; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;">${leaveLabel}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6c757d; font-size: 13px;">Duration</td>
              <td style="padding: 6px 0; color: #212529; font-size: 14px; font-weight: 600;">${formatDate(data.start_date)} &mdash; ${formatDate(data.end_date)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6c757d; font-size: 13px;">Total Days</td>
              <td style="padding: 6px 0; color: #212529; font-size: 14px; font-weight: 600;">${data.total_days} day(s)</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6c757d; font-size: 13px; vertical-align: top;">Reason</td>
              <td style="padding: 6px 0; color: #212529; font-size: 14px;">${data.reason || "Not specified"}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Action Buttons -->
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding: 8px 0 24px 0;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-right: 12px;">
                <a href="${approveUrl}" style="display: inline-block; background-color: #198754; color: #ffffff; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: 700; letter-spacing: 0.3px;">
                  &#10003; Approve
                </a>
              </td>
              <td style="padding-left: 12px;">
                <a href="${rejectUrl}" style="display: inline-block; background-color: #dc3545; color: #ffffff; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: 700; letter-spacing: 0.3px;">
                  &#10007; Reject
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <p style="color: #adb5bd; font-size: 12px; text-align: center; margin: 0;">
      This link expires in 72 hours. You can also log in to RMPL OPM to take action.
    </p>`;

  return { subject, html: buildEmailWrapper(content) };
}

function buildRegularizationApprovalEmail(data: any): {
  subject: string;
  html: string;
} {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const approveUrl = `${supabaseUrl}/functions/v1/handle-approval?token=${data.approve_token}&action=approve`;
  const rejectUrl = `${supabaseUrl}/functions/v1/handle-approval?token=${data.reject_token}&action=reject`;
  const typeLabel =
    REGULARIZATION_TYPE_LABELS[data.regularization_type] ||
    data.regularization_type ||
    "Regularization";

  const subject = `Attendance Regularization: ${data.employee_name} — ${formatDate(data.attendance_date)}`;

  const content = `
    <h2 style="color: #1e3a5f; margin: 0 0 6px 0; font-size: 20px;">Attendance Regularization Request</h2>
    <p style="color: #6c757d; font-size: 14px; margin: 0 0 24px 0;">
      Hi ${data.manager_name || "Manager"}, an attendance regularization request needs your attention.
    </p>

    <!-- Request Details Card -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-radius: 8px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 20px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding: 6px 0; color: #6c757d; font-size: 13px; width: 140px;">Employee</td>
              <td style="padding: 6px 0; color: #212529; font-size: 14px; font-weight: 600;">${data.employee_name}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6c757d; font-size: 13px;">Type</td>
              <td style="padding: 6px 0;">
                <span style="background-color: #fff3cd; color: #856404; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;">${typeLabel}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6c757d; font-size: 13px;">Date</td>
              <td style="padding: 6px 0; color: #212529; font-size: 14px; font-weight: 600;">${formatDate(data.attendance_date)}</td>
            </tr>
            ${
              data.requested_sign_in_time
                ? `<tr>
              <td style="padding: 6px 0; color: #6c757d; font-size: 13px;">Requested Sign-In</td>
              <td style="padding: 6px 0; color: #212529; font-size: 14px; font-weight: 600;">${formatTime(data.requested_sign_in_time)}</td>
            </tr>`
                : ""
            }
            ${
              data.requested_sign_out_time
                ? `<tr>
              <td style="padding: 6px 0; color: #6c757d; font-size: 13px;">Requested Sign-Out</td>
              <td style="padding: 6px 0; color: #212529; font-size: 14px; font-weight: 600;">${formatTime(data.requested_sign_out_time)}</td>
            </tr>`
                : ""
            }
            <tr>
              <td style="padding: 6px 0; color: #6c757d; font-size: 13px; vertical-align: top;">Reason</td>
              <td style="padding: 6px 0; color: #212529; font-size: 14px;">${data.reason || "Not specified"}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Action Buttons -->
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding: 8px 0 24px 0;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-right: 12px;">
                <a href="${approveUrl}" style="display: inline-block; background-color: #198754; color: #ffffff; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: 700; letter-spacing: 0.3px;">
                  &#10003; Approve
                </a>
              </td>
              <td style="padding-left: 12px;">
                <a href="${rejectUrl}" style="display: inline-block; background-color: #dc3545; color: #ffffff; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: 700; letter-spacing: 0.3px;">
                  &#10007; Reject
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <p style="color: #adb5bd; font-size: 12px; text-align: center; margin: 0;">
      This link expires in 72 hours. You can also log in to RMPL OPM to take action.
    </p>`;

  return { subject, html: buildEmailWrapper(content) };
}

function buildResultNotificationEmail(data: any): {
  subject: string;
  html: string;
} {
  const isApproved = data.status === "approved";
  const statusColor = isApproved ? "#198754" : "#dc3545";
  const statusLabel = isApproved ? "Approved" : "Rejected";
  const statusIcon = isApproved ? "&#10003;" : "&#10007;";

  let typeInfo = "";
  let subject = "";

  if (data.request_type === "leave") {
    const leaveLabel =
      LEAVE_TYPE_LABELS[data.leave_type] || data.leave_type || "Leave";
    subject = `Leave ${statusLabel}: ${leaveLabel} (${formatDate(data.start_date)} - ${formatDate(data.end_date)})`;
    typeInfo = `
      <tr>
        <td style="padding: 6px 0; color: #6c757d; font-size: 13px; width: 140px;">Leave Type</td>
        <td style="padding: 6px 0;">
          <span style="background-color: #e7f1ff; color: #0d6efd; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;">${leaveLabel}</span>
        </td>
      </tr>
      <tr>
        <td style="padding: 6px 0; color: #6c757d; font-size: 13px;">Duration</td>
        <td style="padding: 6px 0; color: #212529; font-size: 14px; font-weight: 600;">${formatDate(data.start_date)} &mdash; ${formatDate(data.end_date)}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; color: #6c757d; font-size: 13px;">Total Days</td>
        <td style="padding: 6px 0; color: #212529; font-size: 14px; font-weight: 600;">${data.total_days} day(s)</td>
      </tr>`;
  } else {
    subject = `Attendance Regularization ${statusLabel}`;
    typeInfo = `
      <tr>
        <td style="padding: 6px 0; color: #6c757d; font-size: 13px; width: 140px;">Request Type</td>
        <td style="padding: 6px 0; color: #212529; font-size: 14px;">Attendance Regularization</td>
      </tr>`;
  }

  const content = `
    <!-- Status Banner -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
      <tr>
        <td align="center" style="padding: 20px; background-color: ${isApproved ? "#d1e7dd" : "#f8d7da"}; border-radius: 8px;">
          <p style="margin: 0; font-size: 32px;">${statusIcon}</p>
          <h2 style="color: ${statusColor}; margin: 8px 0 0 0; font-size: 22px;">Request ${statusLabel}</h2>
        </td>
      </tr>
    </table>

    <p style="color: #6c757d; font-size: 14px; margin: 0 0 24px 0;">
      Hi ${data.employee_name || "there"}, your request has been <strong style="color: ${statusColor};">${statusLabel.toLowerCase()}</strong> by <strong>${data.approver_name || "your manager"}</strong>.
    </p>

    <!-- Details Card -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-radius: 8px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 20px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            ${typeInfo}
            <tr>
              <td style="padding: 6px 0; color: #6c757d; font-size: 13px;">Actioned By</td>
              <td style="padding: 6px 0; color: #212529; font-size: 14px; font-weight: 600;">${data.approver_name || "HR Admin"}</td>
            </tr>
            ${
              data.rejection_reason
                ? `<tr>
              <td style="padding: 6px 0; color: #6c757d; font-size: 13px; vertical-align: top;">Reason</td>
              <td style="padding: 6px 0; color: #dc3545; font-size: 14px;">${data.rejection_reason}</td>
            </tr>`
                : ""
            }
          </table>
        </td>
      </tr>
    </table>`;

  return { subject, html: buildEmailWrapper(content) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const payload = await req.json();
    console.log("send-approval-email invoked:", {
      notification_type: payload.notification_type,
      request_type: payload.request_type,
      request_id: payload.request_id,
    });

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }
    const resend = new Resend(resendApiKey);

    // Handle employee result notification (sent after approval/rejection)
    if (payload.notification_type === "result") {
      const emailData = buildResultNotificationEmail(payload);
      const emailResponse = await resend.emails.send({
        from: FROM_EMAIL,
        to: [payload.employee_email],
        subject: emailData.subject,
        html: emailData.html,
      });
      if (emailResponse.error) throw new Error(emailResponse.error.message);
      console.log(`Result notification sent to ${payload.employee_email}`);
      return new Response(
        JSON.stringify({ success: true, email_id: emailResponse.data?.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For approval request emails: look up everything from DB
    const { request_type, request_id } = payload;
    if (!request_type || !request_id) {
      throw new Error("request_type and request_id are required");
    }

    // Fetch request details from DB
    let requestData: any;
    let employeeId: string;

    if (request_type === "leave") {
      const { data, error } = await supabase
        .from("leave_applications")
        .select("*")
        .eq("id", request_id)
        .single();
      if (error || !data) throw new Error("Leave application not found");
      if (data.status !== "pending") {
        return new Response(
          JSON.stringify({ success: false, message: "Request is no longer pending" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      requestData = data;
      employeeId = data.user_id;
    } else if (request_type === "regularization") {
      const { data, error } = await supabase
        .from("attendance_regularizations")
        .select("*")
        .eq("id", request_id)
        .single();
      if (error || !data) throw new Error("Regularization request not found");
      if (data.status !== "pending") {
        return new Response(
          JSON.stringify({ success: false, message: "Request is no longer pending" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      requestData = data;
      employeeId = data.user_id;
    } else {
      throw new Error(`Unknown request_type: ${request_type}`);
    }

    // Get employee profile and their manager
    const { data: employee, error: empError } = await supabase
      .from("profiles")
      .select("id, full_name, email, reports_to")
      .eq("id", employeeId)
      .single();

    if (empError || !employee) throw new Error("Employee profile not found");
    if (!employee.reports_to) {
      console.log("No manager assigned, skipping approval email");
      return new Response(
        JSON.stringify({ success: false, message: "No manager assigned to employee" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get manager details
    const { data: manager, error: mgrError } = await supabase
      .from("profiles")
      .select("id, full_name, email, phone")
      .eq("id", employee.reports_to)
      .single();

    if (mgrError || !manager?.email) {
      console.log("Manager profile/email not found, skipping");
      return new Response(
        JSON.stringify({ success: false, message: "Manager email not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Invalidate any existing unused tokens for this request (in case of re-send)
    await supabase
      .from("approval_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("request_type", request_type)
      .eq("request_id", request_id)
      .is("used_at", null);

    // Generate new approval and rejection tokens
    const { data: approveToken, error: atErr } = await supabase
      .from("approval_tokens")
      .insert({
        request_type,
        request_id,
        approver_id: manager.id,
        action: "approve",
      })
      .select("token")
      .single();

    const { data: rejectToken, error: rtErr } = await supabase
      .from("approval_tokens")
      .insert({
        request_type,
        request_id,
        approver_id: manager.id,
        action: "reject",
      })
      .select("token")
      .single();

    if (atErr || rtErr || !approveToken || !rejectToken) {
      throw new Error("Failed to generate approval tokens");
    }

    // Build and send the email
    let emailData: { subject: string; html: string };

    if (request_type === "leave") {
      emailData = buildLeaveApprovalEmail({
        employee_name: employee.full_name,
        manager_name: manager.full_name,
        approve_token: approveToken.token,
        reject_token: rejectToken.token,
        leave_type: requestData.leave_type,
        start_date: requestData.start_date,
        end_date: requestData.end_date,
        total_days: requestData.total_days,
        reason: requestData.reason,
      });
    } else {
      emailData = buildRegularizationApprovalEmail({
        employee_name: employee.full_name,
        manager_name: manager.full_name,
        approve_token: approveToken.token,
        reject_token: rejectToken.token,
        regularization_type: requestData.regularization_type,
        attendance_date: requestData.attendance_date,
        requested_sign_in_time: requestData.requested_sign_in_time,
        requested_sign_out_time: requestData.requested_sign_out_time,
        reason: requestData.reason,
      });
    }

    const emailResponse = await resend.emails.send({
      from: FROM_EMAIL,
      to: [manager.email],
      subject: emailData.subject,
      html: emailData.html,
    });

    if (emailResponse.error) {
      console.error("Resend error:", emailResponse.error);
      throw new Error(
        emailResponse.error.message || "Failed to send approval email"
      );
    }

    console.log(
      `Approval email sent to ${manager.email} (${manager.full_name}). Resend ID: ${emailResponse.data?.id}`
    );

    // Send WhatsApp notification to manager (non-blocking)
    if (manager.phone) {
      const empName = employee.full_name || "An employee";
      let whatsappMsg = "";

      if (request_type === "leave") {
        const leaveLabel =
          LEAVE_TYPE_LABELS[requestData.leave_type] || requestData.leave_type || "Leave";
        whatsappMsg = `Hi ${manager.full_name || "Manager"}, ${empName} has submitted a *${leaveLabel}* request (${formatDate(requestData.start_date)} — ${formatDate(requestData.end_date)}, ${requestData.total_days} day(s)).\n\nPlease check your email or log in to RMPL OPM to approve/reject.\n\n— RMPL OPM`;
      } else {
        const typeLabel =
          REGULARIZATION_TYPE_LABELS[requestData.regularization_type] ||
          requestData.regularization_type || "Regularization";
        whatsappMsg = `Hi ${manager.full_name || "Manager"}, ${empName} has submitted an attendance regularization request.\n\nType: ${typeLabel}\nDate: ${formatDate(requestData.attendance_date)}\nReason: ${requestData.reason || "Not specified"}\n\nPlease check your email or log in to RMPL OPM to approve/reject.\n\n— RMPL OPM`;
      }

      sendWhatsAppNotification(supabase, manager.phone, whatsappMsg);
    }

    return new Response(
      JSON.stringify({
        success: true,
        email_id: emailResponse.data?.id,
        sent_to: manager.email,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-approval-email:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send email" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
