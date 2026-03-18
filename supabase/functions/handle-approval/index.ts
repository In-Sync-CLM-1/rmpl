import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const LOGO_URL = "https://redefine.in/assets/img/logo.png";
const FROM_EMAIL = "RMPL OPM <approval@redefinemarcom.in>";

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

function buildHtmlPage(
  title: string,
  message: string,
  isSuccess: boolean,
  extraContent = ""
): string {
  const color = isSuccess ? "#198754" : "#dc3545";
  const icon = isSuccess ? "&#10003;" : "&#10007;";
  const bgColor = isSuccess ? "#d1e7dd" : "#f8d7da";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - RMPL OPM</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f0f2f5; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: #fff; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.1); max-width: 500px; width: 100%; overflow: hidden; }
    .header { background: linear-gradient(135deg, #1e3a5f 0%, #0d2137 100%); padding: 24px; text-align: center; }
    .header img { height: 40px; width: auto; }
    .body { padding: 40px 30px; text-align: center; }
    .status-icon { width: 64px; height: 64px; border-radius: 50%; background: ${bgColor}; display: inline-flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 28px; }
    .title { color: ${color}; font-size: 22px; font-weight: 700; margin-bottom: 12px; }
    .message { color: #6c757d; font-size: 15px; line-height: 1.6; margin-bottom: 24px; }
    .footer { background: #f8f9fa; padding: 16px; text-align: center; border-top: 1px solid #e9ecef; }
    .footer p { color: #adb5bd; font-size: 12px; }
    textarea { width: 100%; padding: 12px; border: 1px solid #dee2e6; border-radius: 8px; font-size: 14px; font-family: inherit; resize: vertical; min-height: 100px; margin-bottom: 16px; }
    textarea:focus { outline: none; border-color: #dc3545; box-shadow: 0 0 0 3px rgba(220,53,69,0.15); }
    .btn { display: inline-block; padding: 12px 32px; border-radius: 8px; font-size: 15px; font-weight: 700; cursor: pointer; border: none; text-decoration: none; }
    .btn-danger { background: #dc3545; color: #fff; }
    .btn-danger:hover { background: #c82333; }
    label { display: block; text-align: left; font-size: 14px; font-weight: 600; color: #495057; margin-bottom: 8px; }
    .error-text { color: #dc3545; font-size: 13px; text-align: left; margin-bottom: 12px; display: none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <img src="${LOGO_URL}" alt="RMPL" />
    </div>
    <div class="body">
      <div class="status-icon">${icon}</div>
      <h1 class="title">${title}</h1>
      <p class="message">${message}</p>
      ${extraContent}
    </div>
    <div class="footer">
      <p><strong>RMPL OPM</strong> &mdash; Operations & Project Management</p>
    </div>
  </div>
</body>
</html>`;
}

function buildRejectForm(token: string): string {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const submitUrl = `${supabaseUrl}/functions/v1/handle-approval`;

  return buildHtmlPage(
    "Reject Request",
    "Please provide a reason for rejection. This will be shared with the employee.",
    false,
    `<form method="POST" action="${submitUrl}" onsubmit="return validateForm()">
        <input type="hidden" name="token" value="${token}" />
        <input type="hidden" name="action" value="reject" />
        <label for="reason">Reason for Rejection <span style="color: #dc3545;">*</span></label>
        <textarea id="reason" name="reason" placeholder="Enter reason for rejection..." required></textarea>
        <p class="error-text" id="error-msg">Please enter a reason for rejection.</p>
        <div style="display: flex; justify-content: center; gap: 12px;">
          <button type="submit" class="btn btn-danger">Confirm Rejection</button>
        </div>
      </form>
      <script>
        function validateForm() {
          var reason = document.getElementById('reason').value.trim();
          var errorMsg = document.getElementById('error-msg');
          if (!reason) {
            errorMsg.style.display = 'block';
            return false;
          }
          errorMsg.style.display = 'none';
          return true;
        }
      </script>`
  );
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

    const table = tokenRecord.request_type === "leave" ? "leave_applications" : "attendance_regularizations";

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

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    let token: string | null = null;
    let action: string | null = null;
    let rejectionReason: string | null = null;

    if (req.method === "GET") {
      const url = new URL(req.url);
      token = url.searchParams.get("token");
      action = url.searchParams.get("action");
    } else if (req.method === "POST") {
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
      return new Response(
        buildHtmlPage(
          "Invalid Link",
          "This approval link is invalid or malformed. Please check your email or log in to RMPL OPM.",
          false
        ),
        { headers: { "Content-Type": "text/html" } }
      );
    }

    // Look up the token
    const { data: tokenRecord, error: tokenError } = await supabase
      .from("approval_tokens")
      .select("*")
      .eq("token", token)
      .single();

    if (tokenError || !tokenRecord) {
      return new Response(
        buildHtmlPage(
          "Invalid Token",
          "This approval link is invalid or has already been used. Please log in to RMPL OPM to take action.",
          false
        ),
        { headers: { "Content-Type": "text/html" } }
      );
    }

    // Check if token is already used
    if (tokenRecord.used_at) {
      return new Response(
        buildHtmlPage(
          "Already Processed",
          "This request has already been processed. No further action is needed.",
          false
        ),
        { headers: { "Content-Type": "text/html" } }
      );
    }

    // Check if token has expired
    if (new Date(tokenRecord.expires_at) < new Date()) {
      return new Response(
        buildHtmlPage(
          "Link Expired",
          "This approval link has expired (72-hour limit). Please log in to RMPL OPM to take action.",
          false
        ),
        { headers: { "Content-Type": "text/html" } }
      );
    }

    // For reject action via GET, show the rejection reason form
    if (action === "reject" && req.method === "GET") {
      return new Response(buildRejectForm(token), {
        headers: { "Content-Type": "text/html" },
      });
    }

    // Validate rejection reason for reject action
    if (action === "reject" && !rejectionReason?.trim()) {
      return new Response(buildRejectForm(token), {
        headers: { "Content-Type": "text/html" },
      });
    }

    const effectiveAction = action || tokenRecord.action;

    // Check current status of the request
    const table =
      tokenRecord.request_type === "leave"
        ? "leave_applications"
        : "attendance_regularizations";

    const { data: currentRequest, error: fetchError } = await supabase
      .from(table)
      .select("status")
      .eq("id", tokenRecord.request_id)
      .single();

    if (fetchError || !currentRequest) {
      return new Response(
        buildHtmlPage(
          "Request Not Found",
          "The original request could not be found. It may have been deleted.",
          false
        ),
        { headers: { "Content-Type": "text/html" } }
      );
    }

    if (currentRequest.status !== "pending") {
      await supabase
        .from("approval_tokens")
        .update({ used_at: new Date().toISOString() })
        .eq("request_type", tokenRecord.request_type)
        .eq("request_id", tokenRecord.request_id);

      return new Response(
        buildHtmlPage(
          "Already Processed",
          `This request has already been ${currentRequest.status}. No further action is needed.`,
          false
        ),
        { headers: { "Content-Type": "text/html" } }
      );
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
      updateData.rejection_reason =
        rejectionReason?.trim() || "Rejected via email";
    }

    const { error: updateError } = await supabase
      .from(table)
      .update(updateData)
      .eq("id", tokenRecord.request_id)
      .eq("status", "pending");

    if (updateError) {
      console.error("Failed to update request:", updateError);
      return new Response(
        buildHtmlPage(
          "Action Failed",
          "Something went wrong while processing your action. Please try again or log in to RMPL OPM.",
          false
        ),
        { headers: { "Content-Type": "text/html" } }
      );
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

    const requestTypeLabel =
      tokenRecord.request_type === "leave"
        ? "leave application"
        : "attendance regularization";

    if (effectiveAction === "approve") {
      return new Response(
        buildHtmlPage(
          "Request Approved",
          `You have successfully approved the ${requestTypeLabel} for <strong>${employeeName}</strong>. They will be notified via email.`,
          true
        ),
        { headers: { "Content-Type": "text/html" } }
      );
    } else {
      return new Response(
        buildHtmlPage(
          "Request Rejected",
          `You have rejected the ${requestTypeLabel} for <strong>${employeeName}</strong>. They will be notified via email with the reason provided.`,
          false
        ),
        { headers: { "Content-Type": "text/html" } }
      );
    }
  } catch (error: any) {
    console.error("Error in handle-approval:", error);
    return new Response(
      buildHtmlPage(
        "Error",
        "An unexpected error occurred. Please try again or log in to RMPL OPM.",
        false
      ),
      { headers: { "Content-Type": "text/html" } }
    );
  }
});
