import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const LOGO_URL = "https://redefine.in/assets/img/logo.png";
const FROM_EMAIL = "RMPL OPM <approval@redefinemarcom.in>";
const APP_URL = "https://green-sky-073df2c10.3.azurestaticapps.net";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[^\d+]/g, "");
  if (!cleaned.startsWith("+")) {
    if (cleaned.length === 10) cleaned = "+91" + cleaned;
    else if (cleaned.startsWith("91") && cleaned.length === 12) cleaned = "+" + cleaned;
    else cleaned = "+" + cleaned;
  }
  return cleaned;
}

async function sendWhatsAppTemplate(
  supabase: any,
  phoneNumber: string,
  templateName: string,
  parameters: string[]
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

    const bodyParams = parameters.map((text) => ({ type: "text", text }));

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
              content: {
                type: "template",
                template: {
                  name: templateName,
                  language: { code: "en" },
                  components: [
                    { type: "body", parameters: bodyParams },
                  ],
                },
              },
            },
          ],
        },
      }),
    });

    const responseText = await response.text();
    console.log(`WhatsApp template [${templateName}] response:`, responseText);
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

function formatDate(dateStr: string): string {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function redirect(path: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: `${APP_URL}${path}` },
  });
}

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildResultEmailHtml(data: {
  employee_name: string;
  status: string;
  approver_name: string;
  request_type: string;
  leave_type?: string;
  start_date?: string;
  end_date?: string;
  total_days?: number;
  rejection_reason?: string;
}): { subject: string; html: string } {
  const isApproved = data.status === "approved";
  const statusColor = isApproved ? "#198754" : "#dc3545";
  const statusLabel = isApproved ? "Approved" : "Rejected";
  const statusIcon = isApproved ? "&#10003;" : "&#10007;";

  let typeInfo = "";
  let subject = "";

  if (data.request_type === "leave") {
    const leaveLabel = LEAVE_TYPE_LABELS[data.leave_type || ""] || data.leave_type || "Leave";
    subject = `Leave ${statusLabel}: ${leaveLabel} (${formatDate(data.start_date || "")} - ${formatDate(data.end_date || "")})`;
    typeInfo = `
      <tr><td style="padding:6px 0;color:#6c757d;font-size:13px;width:140px;">Leave Type</td>
      <td style="padding:6px 0;"><span style="background:#e7f1ff;color:#0d6efd;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600;">${leaveLabel}</span></td></tr>
      <tr><td style="padding:6px 0;color:#6c757d;font-size:13px;">Duration</td>
      <td style="padding:6px 0;color:#212529;font-size:14px;font-weight:600;">${formatDate(data.start_date || "")} &mdash; ${formatDate(data.end_date || "")}</td></tr>
      <tr><td style="padding:6px 0;color:#6c757d;font-size:13px;">Total Days</td>
      <td style="padding:6px 0;color:#212529;font-size:14px;font-weight:600;">${data.total_days} day(s)</td></tr>`;
  } else {
    subject = `Attendance Regularization ${statusLabel}`;
    typeInfo = `<tr><td style="padding:6px 0;color:#6c757d;font-size:13px;width:140px;">Type</td>
      <td style="padding:6px 0;color:#212529;font-size:14px;">Attendance Regularization</td></tr>`;
  }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f0f2f5;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:30px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.08);">
<tr><td style="background:linear-gradient(135deg,#1e3a5f,#0d2137);padding:28px 30px;text-align:center;">
<img src="${LOGO_URL}" alt="RMPL" height="48" style="height:48px;width:auto;" /></td></tr>
<tr><td style="padding:36px 30px 24px;">
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr>
<td align="center" style="padding:20px;background:${isApproved ? "#d1e7dd" : "#f8d7da"};border-radius:8px;">
<p style="margin:0;font-size:32px;">${statusIcon}</p>
<h2 style="color:${statusColor};margin:8px 0 0;font-size:22px;">Request ${statusLabel}</h2>
</td></tr></table>
<p style="color:#6c757d;font-size:14px;margin:0 0 24px;">Hi ${data.employee_name}, your request has been <strong style="color:${statusColor};">${statusLabel.toLowerCase()}</strong> by <strong>${data.approver_name}</strong>.</p>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;border-radius:8px;margin-bottom:24px;"><tr><td style="padding:20px;">
<table width="100%" cellpadding="0" cellspacing="0">
${typeInfo}
<tr><td style="padding:6px 0;color:#6c757d;font-size:13px;">Actioned By</td>
<td style="padding:6px 0;color:#212529;font-size:14px;font-weight:600;">${data.approver_name}</td></tr>
${data.rejection_reason ? `<tr><td style="padding:6px 0;color:#6c757d;font-size:13px;vertical-align:top;">Reason</td><td style="padding:6px 0;color:#dc3545;font-size:14px;">${data.rejection_reason}</td></tr>` : ""}
</table></td></tr></table>
</td></tr>
<tr><td style="background:#f8f9fa;padding:20px 30px;text-align:center;border-top:1px solid #e9ecef;">
<p style="color:#6c757d;font-size:12px;margin:0 0 4px;"><strong>RMPL OPM</strong> &mdash; Operations & Project Management</p>
<p style="color:#adb5bd;font-size:11px;margin:0;">This is an automated notification.</p>
</td></tr></table></td></tr></table></body></html>`;

  return { subject, html };
}

async function sendEmployeeNotification(
  supabase: any,
  tokenRecord: any,
  status: string,
  rejectionReason?: string
) {
  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) return;

    const table = tokenRecord.request_type === "leave" ? "leave_applications"
      : tokenRecord.request_type === "expense" ? "travel_expense_claims"
      : "attendance_regularizations";

    const { data: request } = await supabase
      .from(table)
      .select("*")
      .eq("id", tokenRecord.request_id)
      .single();

    if (!request) return;

    const { data: employee } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", request.user_id)
      .single();

    const { data: approver } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", tokenRecord.approver_id)
      .single();

    if (!employee?.email) return;

    const emailData = buildResultEmailHtml({
      employee_name: employee.full_name || "there",
      status,
      approver_name: approver?.full_name || "your manager",
      request_type: tokenRecord.request_type,
      leave_type: request.leave_type,
      start_date: request.start_date,
      end_date: request.end_date,
      total_days: request.total_days,
      rejection_reason: rejectionReason,
    });

    const resend = new Resend(resendApiKey);
    await resend.emails.send({
      from: FROM_EMAIL,
      to: [employee.email],
      subject: emailData.subject,
      html: emailData.html,
    });

    console.log(`Employee notification sent to ${employee.email}`);
  } catch (err) {
    console.error("Failed to send employee notification:", err);
  }
}

async function processApproval(
  supabase: any,
  token: string,
  action: string,
  rejectionReason: string | null,
  isPost: boolean
): Promise<Response> {
  // Look up the token
  const { data: tokenRecord, error: tokenError } = await supabase
    .from("approval_tokens")
    .select("*")
    .eq("token", token)
    .single();

  if (tokenError || !tokenRecord) {
    return isPost
      ? jsonResponse({ success: false, error: "Invalid or expired approval link." }, 400)
      : redirect("/approval-result?error=invalid_link");
  }

  // Check if token is already used
  if (tokenRecord.used_at) {
    return isPost
      ? jsonResponse({ success: false, error: "This request has already been processed." }, 400)
      : redirect("/approval-result?error=already_processed");
  }

  // Check if token has expired
  if (new Date(tokenRecord.expires_at) < new Date()) {
    return isPost
      ? jsonResponse({ success: false, error: "This approval link has expired." }, 400)
      : redirect("/approval-result?error=expired");
  }

  // For reject action via GET, redirect to frontend rejection form
  if (action === "reject" && !isPost) {
    return redirect(`/approval-result?action=reject&token=${encodeURIComponent(token)}`);
  }

  // For POST reject without reason, return error
  if (action === "reject" && isPost && !rejectionReason?.trim()) {
    return jsonResponse({ success: false, error: "Please provide a reason for rejection." }, 400);
  }

  const effectiveAction = action || tokenRecord.action;

  // Check current status of the request
  const table =
    tokenRecord.request_type === "leave"
      ? "leave_applications"
      : tokenRecord.request_type === "expense"
      ? "travel_expense_claims"
      : "attendance_regularizations";

  const { data: currentRequest, error: fetchError } = await supabase
    .from(table)
    .select("status")
    .eq("id", tokenRecord.request_id)
    .single();

  if (fetchError || !currentRequest) {
    return isPost
      ? jsonResponse({ success: false, error: "Request not found." }, 404)
      : redirect("/approval-result?error=not_found");
  }

  const pendingStatus = tokenRecord.request_type === "expense" ? "submitted" : "pending";
  if (currentRequest.status !== pendingStatus) {
    await supabase
      .from("approval_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("request_type", tokenRecord.request_type)
      .eq("request_id", tokenRecord.request_id);

    return isPost
      ? jsonResponse({ success: false, error: "This request has already been processed." }, 400)
      : redirect("/approval-result?error=already_processed");
  }

  // Perform the approval/rejection
  const updateData: any = {
    approved_by: tokenRecord.approver_id,
    approved_at: new Date().toISOString(),
  };

  if (effectiveAction === "approve") {
    updateData.status = "approved";
  } else {
    updateData.status = "rejected";
    updateData.rejection_reason = rejectionReason?.trim() || "Rejected via email";
  }

  const { error: updateError } = await supabase
    .from(table)
    .update(updateData)
    .eq("id", tokenRecord.request_id)
    .eq("status", pendingStatus);

  if (updateError) {
    console.error("Failed to update request:", updateError);
    return isPost
      ? jsonResponse({ success: false, error: "Failed to process action." }, 500)
      : redirect("/approval-result?error=failed");
  }

  // Mark ALL tokens for this request as used
  await supabase
    .from("approval_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("request_type", tokenRecord.request_type)
    .eq("request_id", tokenRecord.request_id);

  // Get employee name for confirmation
  const { data: requestData } = await supabase
    .from(table)
    .select("user_id")
    .eq("id", tokenRecord.request_id)
    .single();

  let employeeName = "the employee";
  if (requestData?.user_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", requestData.user_id)
      .single();
    if (profile?.full_name) employeeName = profile.full_name;
  }

  // Send employee notification email (async, don't block response)
  sendEmployeeNotification(
    supabase,
    tokenRecord,
    updateData.status,
    rejectionReason?.trim()
  );

  // Send WhatsApp template notification to employee (async, non-blocking)
  (async () => {
    try {
      const { data: empProfile } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", requestData?.user_id)
        .single();

      const { data: approverProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", tokenRecord.approver_id)
        .single();

      if (empProfile?.phone) {
        const empName = empProfile.full_name || "there";
        const approverName = approverProfile?.full_name || "your manager";
        const rtLabel =
          tokenRecord.request_type === "leave" ? "leave application"
          : tokenRecord.request_type === "expense" ? "expense claim"
          : "attendance regularization";

        if (effectiveAction === "approve") {
          // rmpl_request_approved: {{1}}=employee, {{2}}=request_type, {{3}}=approver
          await sendWhatsAppTemplate(supabase, empProfile.phone, "rmpl_request_approved", [
            empName,
            rtLabel,
            approverName,
          ]);
        } else {
          // rmpl_request_rejected: {{1}}=employee, {{2}}=request_type, {{3}}=approver, {{4}}=reason
          await sendWhatsAppTemplate(supabase, empProfile.phone, "rmpl_request_rejected", [
            empName,
            rtLabel,
            approverName,
            rejectionReason?.trim() || "No reason provided",
          ]);
        }
      }
    } catch (err) {
      console.error("WhatsApp to employee failed:", err);
    }
  })();

  const statusStr = effectiveAction === "approve" ? "approved" : "rejected";

  if (isPost) {
    return jsonResponse({
      success: true,
      status: statusStr,
      name: employeeName,
      type: tokenRecord.request_type,
    });
  }

  return redirect(
    `/approval-result?status=${statusStr}&name=${encodeURIComponent(employeeName)}&type=${tokenRecord.request_type}`
  );
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    let token: string | null = null;
    let action: string | null = null;
    let rejectionReason: string | null = null;
    const isPost = req.method === "POST";

    if (req.method === "GET") {
      const url = new URL(req.url);
      token = url.searchParams.get("token");
      action = url.searchParams.get("action");
    } else if (isPost) {
      const contentType = req.headers.get("content-type") || "";
      if (contentType.includes("application/x-www-form-urlencoded")) {
        const formData = await req.text();
        const params = new URLSearchParams(formData);
        token = params.get("token");
        action = params.get("action");
        rejectionReason = params.get("reason");
      } else {
        const body = await req.json();
        token = body.token;
        action = body.action;
        rejectionReason = body.reason;
      }
    }

    if (!token) {
      return isPost
        ? jsonResponse({ success: false, error: "Token is required." }, 400)
        : redirect("/approval-result?error=invalid_link");
    }

    return await processApproval(supabase, token, action || "", rejectionReason, isPost);
  } catch (error: any) {
    console.error("Error in handle-approval:", error);
    return req.method === "POST"
      ? jsonResponse({ success: false, error: "An unexpected error occurred." }, 500)
      : redirect("/approval-result?error=failed");
  }
});
