import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { corsHeaders } from "../_shared/cors-headers.ts";
import { successResponse, errorResponse, unauthorizedResponse } from "../_shared/response-helpers.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Initiating screen call");

    // Create Supabase client
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return unauthorizedResponse("Missing authorization header");
    }

    // Get the user from the auth token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      console.error("User authentication error:", userError);
      return unauthorizedResponse("Invalid authentication token");
    }

    console.log("Authenticated user:", user.id);

    // Parse request body
    const {
      to_number,
      demandcom_id,
      call_method = 'screen',
      edited_contact_info = {},
      disposition = null,
      subdisposition = null,
      notes = null,
      next_call_date = null
    } = await req.json();

    // Validate required fields
    if (!to_number) {
      return errorResponse("to_number is required", 400);
    }

    // Generate a unique call SID for tracking
    const callSid = crypto.randomUUID();

    // Create call log entry
    const callLogData = {
      call_sid: callSid,
      to_number,
      from_number: to_number, // For screen calls, both are the same
      demandcom_id: demandcom_id || null,
      initiated_by: user.id,
      status: 'completed', // Mark as completed since we can't track screen calls
      direction: 'outbound-screen',
      call_method: call_method,
      edited_contact_info: edited_contact_info,
      disposition: disposition,
      subdisposition: subdisposition,
      notes: notes,
      start_time: new Date().toISOString(),
      end_time: new Date().toISOString(),
    };

    console.log("Creating call log with data:", callLogData);

    const { data: callLog, error: insertError } = await supabaseClient
      .from("call_logs")
      .insert(callLogData)
      .select()
      .single();

    if (insertError) {
      console.error("Error creating call log:", insertError);
      return errorResponse("Failed to create call log", 500, insertError);
    }

    console.log("Screen call logged successfully:", callLog.id);

    // Update demandcom with next call date if provided
    if (next_call_date && demandcom_id) {
      const { error: updateError } = await supabaseClient
        .from('demandcom')
        .update({ next_call_date: next_call_date })
        .eq('id', demandcom_id);
      
      if (updateError) {
        console.error('Error updating next call date:', updateError);
      } else {
        console.log(`Next call date updated for demandcom ${demandcom_id}`);
      }
    }

    return successResponse({
      success: true,
      call_log_id: callLog.id,
      call_sid: callSid,
      message: "Screen call logged successfully"
    });

  } catch (error) {
    console.error("Error in initiate-screen-call function:", error);
    return errorResponse(
      "An error occurred while initiating screen call",
      500,
      { error: error instanceof Error ? error.message : String(error) }
    );
  }
});
