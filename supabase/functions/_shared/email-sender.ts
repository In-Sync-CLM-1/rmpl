// Shared sending pipeline used by both `send-bulk-email` (immediate sends)
// and `process-scheduled-emails` (cron-dispatched scheduled sends).
// Keeping a single implementation here avoids drift between the two paths.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

export interface AppliedFilters {
  nameEmail?: string;
  city?: string;
  activityName?: string;
  assignedTo?: string;
  disposition?: string[];
  subdisposition?: string[];
}

export interface SendEmailJob {
  mode: "individual" | "bulk";
  demandcomId?: string | null;
  filters?: AppliedFilters | null;
  templateId?: string | null;
  subject?: string | null;
  bodyHtml?: string | null;
  bodyText?: string | null;
  // Optional: user who initiated the send (used for email_activity_log.sent_by)
  sentBy?: string | null;
}

// Domain used for inbound reply threading. Replies arrive at
// reply+<email_activity_log.id>@<REPLY_DOMAIN>, are routed to a
// Cloudflare Email Worker, and posted to the email-inbound-webhook function.
const REPLY_DOMAIN = "reply.rmpl.in-sync.co.in";

function buildReplyTo(activityLogId: string): string {
  return `reply+${activityLogId}@${REPLY_DOMAIN}`;
}

export interface SendEmailResult {
  sent: number;
  skipped: number;
  failed: number;
  total: number;
}

interface DemandComRecord {
  id: string;
  name: string;
  personal_email_id: string | null;
  generic_email_id: string | null;
  mobile_numb: string | null;
  mobile2: string | null;
  official: string | null;
  designation: string | null;
  deppt: string | null;
  job_level_updated: string | null;
  linkedin: string | null;
  company_name: string | null;
  industry_type: string | null;
  sub_industry: string | null;
  turnover: string | null;
  emp_size: string | null;
  erp_name: string | null;
  erp_vendor: string | null;
  website: string | null;
  activity_name: string | null;
  address: string | null;
  location: string | null;
  city: string | null;
  state: string | null;
  zone: string | null;
  tier: string | null;
  pincode: string | null;
  latest_disposition: string | null;
  latest_subdisposition: string | null;
  last_call_date: string | null;
}

const DEMANDCOM_COLUMNS =
  "id, name, personal_email_id, generic_email_id, mobile_numb, mobile2, official, designation, deppt, job_level_updated, linkedin, company_name, industry_type, sub_industry, turnover, emp_size, erp_name, erp_vendor, website, activity_name, address, location, city, state, zone, tier, pincode, latest_disposition, latest_subdisposition, last_call_date";

function buildMergeData(record: DemandComRecord): Record<string, string> {
  const nameParts = (record.name || "").trim().split(/\s+/);
  const email = record.official || record.personal_email_id || record.generic_email_id || "";
  return {
    name: record.name || "",
    first_name: nameParts[0] || "",
    last_name: nameParts.length > 1 ? nameParts[nameParts.length - 1] : "",
    email,
    phone: record.mobile_numb || "",
    mobile2: record.mobile2 || "",
    official: record.official || "",
    linkedin: record.linkedin || "",
    designation: record.designation || "",
    department: record.deppt || "",
    job_level_updated: record.job_level_updated || "",
    company_name: record.company_name || "",
    industry: record.industry_type || "",
    sub_industry: record.sub_industry || "",
    turnover: record.turnover || "",
    emp_size: record.emp_size || "",
    erp_name: record.erp_name || "",
    erp_vendor: record.erp_vendor || "",
    website: record.website || "",
    activity_name: record.activity_name || "",
    address: record.address || "",
    location: record.location || "",
    city: record.city || "",
    state: record.state || "",
    zone: record.zone || "",
    tier: record.tier || "",
    pincode: record.pincode || "",
    latest_disposition: record.latest_disposition || "",
    latest_subdisposition: record.latest_subdisposition || "",
    last_call_date: record.last_call_date || "",
  };
}

function replaceMergeTags(text: string, data: Record<string, string>): string {
  let result = text;
  for (const [key, value] of Object.entries(data)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}

function textToHtml(text: string): string {
  return `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333;">
    ${text
      .split("\n")
      .map((line) => `<p style="margin: 0 0 8px 0;">${line || "&nbsp;"}</p>`)
      .join("")}
  </div>`;
}

function wrapEmailHtml(html: string): string {
  return `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333;">${html}</div>`;
}

function applyFiltersToQuery(query: any, filters: AppliedFilters) {
  let q = query;

  if (filters.nameEmail) {
    const pat = `%${filters.nameEmail}%`;
    q = q.or(
      `name.ilike.${pat},personal_email_id.ilike.${pat},generic_email_id.ilike.${pat},mobile_numb.ilike.${pat}`
    );
  }
  if (filters.city) {
    q = q.ilike("city", `%${filters.city}%`);
  }
  if (filters.activityName) {
    q = q.ilike("activity_name", `%${filters.activityName}%`);
  }
  if (filters.assignedTo && filters.assignedTo !== "all") {
    if (filters.assignedTo === "unassigned") {
      q = q.is("assigned_to", null);
    } else {
      q = q.eq("assigned_to", filters.assignedTo);
    }
  }
  if (filters.disposition && filters.disposition.length > 0) {
    const hasNone = filters.disposition.includes("No Disposition");
    const real = filters.disposition.filter((d) => d !== "No Disposition");
    if (hasNone && real.length > 0) {
      q = q.or(`latest_disposition.is.null,latest_disposition.in.(${real.join(",")})`);
    } else if (hasNone) {
      q = q.is("latest_disposition", null);
    } else {
      q = q.in("latest_disposition", real);
    }
  }
  if (filters.subdisposition && filters.subdisposition.length > 0) {
    q = q.in("latest_subdisposition", filters.subdisposition);
  }

  return q;
}

export async function sendEmailJob(
  serviceClient: SupabaseClient,
  resend: Resend,
  job: SendEmailJob
): Promise<SendEmailResult> {
  const { mode, demandcomId, filters, templateId, subject, bodyHtml, bodyText, sentBy = null } = job;

  let templateSubject = subject || "";
  let templateBodyHtml = bodyHtml
    ? wrapEmailHtml(bodyHtml)
    : bodyText
      ? textToHtml(bodyText)
      : "";

  if (templateId) {
    const { data: tpl, error: tplErr } = await serviceClient
      .from("email_templates")
      .select("subject, body_html")
      .eq("id", templateId)
      .single();
    if (tplErr || !tpl) throw new Error("Email template not found");
    templateSubject = tpl.subject as string;
    templateBodyHtml = tpl.body_html as string;
  }

  if (!templateSubject || !templateBodyHtml) {
    throw new Error("Missing subject or body");
  }

  let records: DemandComRecord[] = [];

  if (mode === "individual" && demandcomId) {
    const { data, error } = await serviceClient
      .from("demandcom" as any)
      .select(DEMANDCOM_COLUMNS)
      .eq("id", demandcomId)
      .single();
    if (error) throw error;
    if (data) {
      const rec = data as unknown as DemandComRecord;
      if (!rec.official && !rec.personal_email_id && !rec.generic_email_id) {
        throw new Error("Recipient has no email address on record");
      }
      records = [rec];
    }
  } else if (mode === "bulk" && filters) {
    const PAGE_SIZE = 1000;
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      let q = serviceClient
        .from("demandcom" as any)
        .select(DEMANDCOM_COLUMNS)
        .range(from, from + PAGE_SIZE - 1);
      q = applyFiltersToQuery(q, filters);
      const { data, error } = await q;
      if (error) throw error;
      const page = ((data || []) as unknown) as DemandComRecord[];
      records = records.concat(page);
      hasMore = page.length === PAGE_SIZE;
      from += PAGE_SIZE;
    }
  }

  let sent = 0;
  let failed = 0;
  const BATCH_SIZE = 100;

  const emailRecords = records.filter(
    (r) => r.official || r.personal_email_id || r.generic_email_id
  );
  const skipped = records.length - emailRecords.length;

  for (let i = 0; i < emailRecords.length; i += BATCH_SIZE) {
    const batch = emailRecords.slice(i, i + BATCH_SIZE);

    // Log each outbound email up-front so we can use the row id as the
    // reply-thread token. Resend gets `Reply-To: reply+<id>@reply.rmpl.in-sync.co.in`.
    const logRows = batch.map((record) => {
      const toEmail = record.official || record.personal_email_id || record.generic_email_id || "";
      const mergeData = buildMergeData(record);
      return {
        sent_by: sentBy,
        provider: "resend",
        from_email: "events@redefinemarcom.in",
        to_email: toEmail,
        subject: replaceMergeTags(templateSubject, mergeData),
        demandcom_id: record.id,
        template_id: templateId || null,
        status: "pending",
        sent_at: new Date().toISOString(),
      };
    });

    const { data: insertedLogs, error: logErr } = await serviceClient
      .from("email_activity_log" as any)
      .insert(logRows)
      .select("id");

    if (logErr || !insertedLogs || insertedLogs.length !== batch.length) {
      console.error("Email activity log insert failed:", logErr);
      failed += batch.length;
      continue;
    }

    const emails = batch.map((record, idx) => {
      const mergeData = buildMergeData(record);
      const toEmail = record.official || record.personal_email_id || record.generic_email_id || "";
      const logId = (insertedLogs[idx] as any).id;
      return {
        from: "Redefine <events@redefinemarcom.in>",
        to: [toEmail],
        subject: replaceMergeTags(templateSubject, mergeData),
        html: replaceMergeTags(templateBodyHtml, mergeData),
        reply_to: buildReplyTo(logId),
      };
    });

    const logIds = insertedLogs.map((r: any) => r.id);

    try {
      const { error: batchError } = await resend.batch.send(emails as any);
      if (batchError) {
        console.error("Batch send error:", batchError);
        failed += batch.length;
        await serviceClient
          .from("email_activity_log" as any)
          .update({ status: "failed", error_message: String(batchError) })
          .in("id", logIds);
      } else {
        sent += batch.length;
        await serviceClient
          .from("email_activity_log" as any)
          .update({ status: "sent" })
          .in("id", logIds);
      }
    } catch (err) {
      console.error("Batch send exception:", err);
      failed += batch.length;
      await serviceClient
        .from("email_activity_log" as any)
        .update({ status: "failed", error_message: String(err) })
        .in("id", logIds);
    }
  }

  return { sent, skipped, failed, total: records.length };
}

export function getServiceClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

export function getResend(): Resend {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");
  return new Resend(resendApiKey);
}
