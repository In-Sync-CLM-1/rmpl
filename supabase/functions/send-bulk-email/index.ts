import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AppliedFilters {
  nameEmail?: string;
  city?: string;
  activityName?: string;
  assignedTo?: string;
  disposition?: string[];
  subdisposition?: string[];
}

interface SendBulkEmailRequest {
  mode: "individual" | "bulk";
  demandcomId?: string;
  filters?: AppliedFilters;
  templateId?: string;
  subject?: string;
  bodyText?: string;
  bodyHtml?: string;
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

function applyFiltersToQuery(
  query: ReturnType<typeof createClient>["from"] extends (table: string) => infer Q ? Q : never,
  filters: AppliedFilters
) {
  let q = query as any;

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify user auth
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service client for data fetching (bypasses RLS for bulk reads)
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");
    const resend = new Resend(resendApiKey);

    const body: SendBulkEmailRequest = await req.json();
    const { mode, demandcomId, filters, templateId, subject, bodyText, bodyHtml } = body;

    // Resolve template if provided
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
      templateSubject = tpl.subject;
      templateBodyHtml = tpl.body_html;
    }

    if (!templateSubject || !templateBodyHtml) {
      return new Response(JSON.stringify({ error: "Missing subject or body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch recipients
    let records: DemandComRecord[] = [];

    if (mode === "individual" && demandcomId) {
      const { data, error } = await serviceClient
        .from("demandcom" as any)
        .select(
          "id, name, personal_email_id, generic_email_id, mobile_numb, mobile2, official, designation, deppt, job_level_updated, linkedin, company_name, industry_type, sub_industry, turnover, emp_size, erp_name, erp_vendor, website, activity_name, address, location, city, state, zone, tier, pincode, latest_disposition, latest_subdisposition, last_call_date"
        )
        .eq("id", demandcomId)
        .single();
      if (error) throw error;
      if (data) {
        const rec = data as DemandComRecord;
        if (!rec.official && !rec.personal_email_id && !rec.generic_email_id) {
          return new Response(
            JSON.stringify({ error: "Recipient has no email address on record" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        records = [rec];
      }
    } else if (mode === "bulk" && filters) {
      // Fetch all matching records in pages of 1000
      const PAGE_SIZE = 1000;
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        let q = serviceClient
          .from("demandcom" as any)
          .select(
            "id, name, personal_email_id, generic_email_id, mobile_numb, mobile2, official, designation, deppt, job_level_updated, linkedin, company_name, industry_type, sub_industry, turnover, emp_size, erp_name, erp_vendor, website, activity_name, address, location, city, state, zone, tier, pincode, latest_disposition, latest_subdisposition, last_call_date"
          )
          .range(from, from + PAGE_SIZE - 1);

        q = applyFiltersToQuery(q, filters);

        const { data, error } = await q;
        if (error) throw error;

        const page = (data || []) as DemandComRecord[];
        records = records.concat(page);
        hasMore = page.length === PAGE_SIZE;
        from += PAGE_SIZE;
      }
    }

    // Send emails in batches of 100 (Resend batch limit)
    let sent = 0;
    let skipped = 0;
    let failed = 0;
    const BATCH_SIZE = 100;

    const emailRecords = records.filter((r) => r.official || r.personal_email_id || r.generic_email_id);
    skipped = records.length - emailRecords.length;

    for (let i = 0; i < emailRecords.length; i += BATCH_SIZE) {
      const batch = emailRecords.slice(i, i + BATCH_SIZE);
      const emails = batch.map((record) => {
        const mergeData = buildMergeData(record);
        const toEmail = record.official || record.personal_email_id || record.generic_email_id || "";
        return {
          from: "Redefine <events@redefinemarcom.in>",
          to: [toEmail],
          subject: replaceMergeTags(templateSubject, mergeData),
          html: replaceMergeTags(templateBodyHtml, mergeData),
        };
      });

      try {
        const { error: batchError } = await resend.batch.send(emails as any);
        if (batchError) {
          console.error("Batch send error:", batchError);
          failed += batch.length;
        } else {
          sent += batch.length;
        }
      } catch (err) {
        console.error("Batch send exception:", err);
        failed += batch.length;
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent, skipped, failed, total: records.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("send-bulk-email error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send email" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
