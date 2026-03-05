import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { apiKey, changes } = await req.json();

    // Validate API key
    const expectedKey = Deno.env.get('DEPLOYMENT_WEBHOOK_KEY');
    if (!expectedKey || apiKey !== expectedKey) {
      console.error("Invalid or missing API key");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Unauthorized - Invalid API key" 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401
        }
      );
    }

    // Validate changes array
    if (!Array.isArray(changes) || changes.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Changes array is required and must not be empty" 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400
        }
      );
    }

    console.log(`Processing ${changes.length} changes for announcement generation`);

    // Combine changes into a single description
    const changeDescription = changes.join("\n- ");
    const fullDescription = `Recent deployment changes:\n- ${changeDescription}`;

    // Call generate-announcement function with autoSave
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const generateResponse = await fetch(`${supabaseUrl}/functions/v1/generate-announcement`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        changeDescription: fullDescription,
        autoSave: true,
        targetRoles: null, // Available to all roles
      }),
    });

    const generateResult = await generateResponse.json();

    if (!generateResult.success) {
      console.error("Failed to generate announcement:", generateResult);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Failed to generate announcement",
          details: generateResult.error 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500
        }
      );
    }

    console.log("Announcement generated and saved successfully");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Announcement generated and published successfully",
        announcement: generateResult.announcement
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      }
    );

  } catch (error: any) {
    console.error("Error in deployment-webhook function:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      }
    );
  }
});
