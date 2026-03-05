import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createSupabaseClient } from "../_shared/supabase-client.ts";
import { corsHeaders } from "../_shared/cors-headers.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface NotificationEmailRequest {
  user_id: string;
  task_id: string;
  notification_type: 'task_assigned' | 'due_soon' | 'overdue';
  task_name: string;
  due_date: string;
  assigned_by_name?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createSupabaseClient();
    const payload: NotificationEmailRequest = await req.json();

    console.log("Processing task notification email:", payload);

    // Get user email
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", payload.user_id)
      .single();

    if (profileError || !profile?.email) {
      console.error("Failed to fetch user profile:", profileError);
      throw new Error("User email not found");
    }

    // Format due date
    const dueDate = new Date(payload.due_date);
    const formattedDate = dueDate.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Build email content based on notification type
    let subject = "";
    let htmlContent = "";

    switch (payload.notification_type) {
      case "task_assigned":
        subject = `New Task Assigned: ${payload.task_name}`;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">New Task Assignment</h2>
            <p>Hi ${profile.full_name || "there"},</p>
            <p>You have been assigned a new task:</p>
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #1f2937;">${payload.task_name}</h3>
              <p><strong>Due Date:</strong> ${formattedDate}</p>
              ${payload.assigned_by_name ? `<p><strong>Assigned By:</strong> ${payload.assigned_by_name}</p>` : ""}
            </div>
            <p>Please review and complete this task by the due date.</p>
            <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
              This is an automated notification from your task management system.
            </p>
          </div>
        `;
        break;

      case "due_soon":
        subject = `Task Due Soon: ${payload.task_name}`;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #f59e0b;">Task Due Soon</h2>
            <p>Hi ${profile.full_name || "there"},</p>
            <p>This is a reminder that the following task is due within 24 hours:</p>
            <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
              <h3 style="margin-top: 0; color: #92400e;">${payload.task_name}</h3>
              <p><strong>Due Date:</strong> ${formattedDate}</p>
            </div>
            <p>Please ensure you complete this task on time.</p>
            <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
              This is an automated notification from your task management system.
            </p>
          </div>
        `;
        break;

      case "overdue":
        subject = `⚠️ Overdue Task: ${payload.task_name}`;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc2626;">Task Overdue</h2>
            <p>Hi ${profile.full_name || "there"},</p>
            <p>The following task is now overdue and requires your immediate attention:</p>
            <div style="background-color: #fee2e2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
              <h3 style="margin-top: 0; color: #991b1b;">${payload.task_name}</h3>
              <p><strong>Was Due:</strong> ${formattedDate}</p>
            </div>
            <p><strong>Please complete this task as soon as possible.</strong></p>
            <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
              This is an automated notification from your task management system.
            </p>
          </div>
        `;
        break;
    }

    // Send email
    const emailResponse = await resend.emails.send({
      from: "Task Manager <onboarding@resend.dev>",
      to: [profile.email],
      subject: subject,
      html: htmlContent,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, emailResponse }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error sending task notification email:", error);
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
