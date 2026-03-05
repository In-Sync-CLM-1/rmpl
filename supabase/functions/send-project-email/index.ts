import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProjectEmailRequest {
  project_id: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { project_id }: ProjectEmailRequest = await req.json();
    
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch project details
    const { data: project, error: projectError } = await supabaseClient
      .from("projects")
      .select("*")
      .eq("id", project_id)
      .single();

    if (projectError || !project) {
      console.error("Error fetching project:", projectError);
      return new Response(
        JSON.stringify({ error: "Project not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch team members
    const { data: teamMembers, error: teamError } = await supabaseClient
      .from("project_team_members")
      .select("user_id, role_in_project, profiles(email, full_name)")
      .eq("project_id", project_id);

    if (teamError || !teamMembers || teamMembers.length === 0) {
      console.log("No team members found for project:", project_id);
      return new Response(
        JSON.stringify({ sent: 0, failed: 0, already_notified: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check who has already been notified
    const { data: alreadyNotified } = await supabaseClient
      .from("project_team_notifications")
      .select("user_id")
      .eq("project_id", project_id)
      .eq("notification_type", "project_assignment");

    const notifiedUserIds = new Set(alreadyNotified?.map(n => n.user_id) || []);
    const newTeamMembers = teamMembers.filter(m => !notifiedUserIds.has(m.user_id));

    if (newTeamMembers.length === 0) {
      console.log("All team members already notified for project:", project_id);
      return new Response(
        JSON.stringify({ sent: 0, failed: 0, already_notified: teamMembers.length }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch project files
    const { data: files, error: filesError } = await supabaseClient
      .from("project_files")
      .select("*")
      .eq("project_id", project_id);

    if (filesError) {
      console.error("Error fetching files:", filesError);
    }

    // Format locations
    const locations = Array.isArray(project.locations) 
      ? project.locations.map((loc: any) => `${loc.city} - ${loc.venue}`).join(", ")
      : "Not specified";

    // Format event dates
    const eventDates = Array.isArray(project.event_dates)
      ? project.event_dates.map((ed: any) => {
          const typeLabel = ed.type === 'full_day' ? 'Full Day' : ed.type === 'first_half' ? '1st Half' : '2nd Half';
          return `${new Date(ed.date).toLocaleDateString()} (${typeLabel})`;
        }).join(", ")
      : "Not specified";

    // Prepare attachments
    const attachments: { filename: string; content: string }[] = [];
    if (files && files.length > 0) {
      for (const file of files) {
        const { data: fileData } = await supabaseClient
          .storage
          .from("project-files")
          .download(file.file_path);

        if (fileData) {
          const buffer = await fileData.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
          attachments.push({
            filename: file.file_name,
            content: base64,
          });
        }
      }
    }

    // Send email to each new team member
    const emailPromises = newTeamMembers.map(async (member: any) => {
      const profile = member.profiles;
      if (!profile?.email) return null;

      const emailHtml = `
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2 style="color: #2563eb;">New Project Assignment: ${project.project_name}</h2>
            
            <p>Hello ${profile.full_name || 'Team Member'},</p>
            
            <p>You have been assigned to a new project. Here are the details:</p>
            
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Project Details</h3>
              <p><strong>Project Name:</strong> ${project.project_name}</p>
              <p><strong>Client:</strong> ${project.client_id || 'N/A'}</p>
              <p><strong>Status:</strong> ${project.status}</p>
              <p><strong>Your Role:</strong> ${member.role_in_project}</p>
              <p><strong>Locations:</strong> ${locations}</p>
              <p><strong>Event Dates:</strong> ${eventDates}</p>
              ${project.brief ? `<p><strong>Brief:</strong><br/>${project.brief}</p>` : ''}
            </div>
            
            ${files && files.length > 0 ? `<p><strong>Attached Files:</strong> ${files.length} file(s)</p>` : ''}
            
            <p>Please review the project details and attached files. If you have any questions, contact the project creator.</p>
            
            <p style="margin-top: 30px;">Best regards,<br/>Project Management Team</p>
          </body>
        </html>
      `;

      return resend.emails.send({
        from: "Projects <onboarding@resend.dev>",
        to: [profile.email],
        subject: `New Project Assignment: ${project.project_name}`,
        html: emailHtml,
        attachments: attachments.length > 0 ? attachments : undefined,
      });
    });

    const results = await Promise.allSettled(emailPromises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    // Record successful notifications
    if (successful > 0) {
      const notificationRecords = newTeamMembers
        .slice(0, successful)
        .map(member => ({
          project_id: project_id,
          user_id: member.user_id,
          notification_type: 'project_assignment',
        }));

      const { error: insertError } = await supabaseClient
        .from("project_team_notifications")
        .insert(notificationRecords);

      if (insertError) {
        console.error("Error recording notifications:", insertError);
      }
    }

    console.log(`Sent ${successful} emails successfully, ${failed} failed, ${notifiedUserIds.size} already notified`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: successful, 
        failed: failed,
        already_notified: notifiedUserIds.size
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-project-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
