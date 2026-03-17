import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, otp, newPassword } = await req.json();

    if (!email || !otp || !newPassword) {
      throw new Error("Email, OTP code, and new password are required");
    }

    const normalizedEmail = email.trim().toLowerCase();
    console.log("Verifying OTP for:", normalizedEmail);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Find the OTP record
    const { data: otpRecords, error: fetchError } = await supabaseAdmin
      .from("password_reset_otps")
      .select("*")
      .ilike("email", normalizedEmail)
      .eq("otp_code", otp)
      .eq("used", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1);

    if (fetchError) {
      console.error("Error fetching OTP:", fetchError);
      throw new Error("Failed to verify code");
    }

    if (!otpRecords || otpRecords.length === 0) {
      throw new Error("Invalid or expired verification code");
    }

    const otpRecord = otpRecords[0];

    // Resolve user via profiles table
    const { data: profileMatches, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, email")
      .ilike("email", normalizedEmail);

    if (profileError) {
      console.error("Error querying profiles:", profileError);
      throw new Error("Failed to resolve user identity");
    }

    let resolvedUserId: string | null = null;

    if (profileMatches && profileMatches.length === 1) {
      resolvedUserId = profileMatches[0].id;
    } else if (profileMatches && profileMatches.length > 1) {
      console.error("SECURITY: Multiple profiles for email:", normalizedEmail);
      throw new Error("Unable to resolve user identity - please contact support");
    } else {
      // Fallback: paginated auth scan
      let page = 1;
      const perPage = 50;
      let found = false;
      while (!found) {
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage,
        });
        if (listError) break;
        if (!users || users.length === 0) break;

        const match = users.find((u: any) => u.email?.toLowerCase() === normalizedEmail);
        if (match) {
          resolvedUserId = match.id;
          found = true;
        }
        if (users.length < perPage) break;
        page++;
      }
    }

    if (!resolvedUserId) {
      throw new Error("User not found");
    }

    // Safety guard: verify resolved user's email matches
    const { data: { user: resolvedUser }, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(resolvedUserId);

    if (getUserError || !resolvedUser) {
      throw new Error("Failed to verify user identity");
    }

    if (resolvedUser.email?.toLowerCase() !== normalizedEmail) {
      console.error("SECURITY: Email mismatch!", normalizedEmail, resolvedUser.email);
      throw new Error("User identity verification failed");
    }

    // Update password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      resolvedUserId,
      { password: newPassword }
    );

    if (updateError) {
      console.error("Failed to update password:", updateError);
      throw new Error("Failed to update password");
    }

    // Mark OTP as used
    await supabaseAdmin
      .from("password_reset_otps")
      .update({ used: true, used_at: new Date().toISOString() })
      .eq("id", otpRecord.id);

    console.log("Password updated successfully for:", normalizedEmail);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in verify-password-otp:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
