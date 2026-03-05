import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const VAPI_API_KEY = Deno.env.get("VAPI_API_KEY");
    if (!VAPI_API_KEY) throw new Error("VAPI_API_KEY is not configured");

    const VAPI_ASSISTANT_ID = Deno.env.get("VAPI_ASSISTANT_ID");
    if (!VAPI_ASSISTANT_ID) throw new Error("VAPI_ASSISTANT_ID is not configured");

    const VAPI_PHONE_NUMBER_ID = Deno.env.get("VAPI_PHONE_NUMBER_ID");
    if (!VAPI_PHONE_NUMBER_ID) throw new Error("VAPI_PHONE_NUMBER_ID is not configured");

    // Find due scheduled calls
    const { data: dueSchedules, error: fetchError } = await supabase
      .from("vapi_scheduled_calls")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(5);

    if (fetchError) throw fetchError;
    if (!dueSchedules || dueSchedules.length === 0) {
      console.log("No due scheduled calls found");
      return new Response(JSON.stringify({ message: "No due calls" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${dueSchedules.length} due scheduled call batches`);

    for (const schedule of dueSchedules) {
      // Mark as processing
      await supabase
        .from("vapi_scheduled_calls")
        .update({ status: "processing" })
        .eq("id", schedule.id);

      let completedCount = 0;
      let failedCount = 0;

      // Fetch contact details for all demandcom_ids
      const { data: contacts, error: contactsError } = await supabase
        .from("demandcom")
        .select("id, name, mobile_numb, company_name, activity_name")
        .in("id", schedule.demandcom_ids);

      if (contactsError || !contacts) {
        console.error("Failed to fetch contacts:", contactsError);
        await supabase
          .from("vapi_scheduled_calls")
          .update({ status: "failed", failed_count: schedule.total_contacts })
          .eq("id", schedule.id);
        continue;
      }

      for (const contact of contacts) {
        if (!contact.mobile_numb) {
          failedCount++;
          continue;
        }

        try {
          const vapiPayload: Record<string, unknown> = {
            assistantId: VAPI_ASSISTANT_ID,
            phoneNumberId: VAPI_PHONE_NUMBER_ID,
            customer: {
              number: contact.mobile_numb,
              name: contact.name || undefined,
            },
          };

          if (schedule.first_message) {
            vapiPayload.assistantOverrides = {
              firstMessage: schedule.first_message,
            };
          }

          const vapiResponse = await fetch("https://api.vapi.ai/call", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${VAPI_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(vapiPayload),
          });

          const vapiData = await vapiResponse.json();

          if (!vapiResponse.ok) {
            console.error(`VAPI call failed for ${contact.mobile_numb}:`, vapiData);
            failedCount++;
            continue;
          }

          // Log the call
          await supabase.from("vapi_call_logs").insert({
            demandcom_id: contact.id,
            vapi_call_id: vapiData.id,
            assistant_id: VAPI_ASSISTANT_ID,
            phone_number: contact.mobile_numb,
            contact_name: contact.name || null,
            status: vapiData.status || "queued",
            created_by: schedule.created_by,
            scheduled_call_id: schedule.id,
          });

          completedCount++;
          console.log(`Call initiated for ${contact.name || contact.mobile_numb}`);

          // Delay between calls
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } catch (err) {
          console.error(`Error calling ${contact.mobile_numb}:`, err);
          failedCount++;
        }
      }

      // Update schedule status
      const finalStatus = failedCount === contacts.length ? "failed" : "completed";
      await supabase
        .from("vapi_scheduled_calls")
        .update({
          status: finalStatus,
          completed_count: completedCount,
          failed_count: failedCount,
        })
        .eq("id", schedule.id);

      console.log(`Batch ${schedule.id}: ${completedCount} completed, ${failedCount} failed`);
    }

    return new Response(
      JSON.stringify({ success: true, processed: dueSchedules.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("vapi-process-scheduled-calls error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
