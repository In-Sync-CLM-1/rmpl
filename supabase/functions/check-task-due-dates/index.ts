import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { corsHeaders } from '../_shared/cors-headers.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get tasks due within 24 hours that are not completed/cancelled
    const tomorrow = new Date();
    tomorrow.setHours(tomorrow.getHours() + 24);
    
    const { data: tasksDueSoon, error: tasksError } = await supabase
      .from('project_tasks')
      .select('id, task_name, assigned_to, due_date, status')
      .lt('due_date', tomorrow.toISOString())
      .gt('due_date', new Date().toISOString())
      .in('status', ['pending', 'in_progress']);

    if (tasksError) throw tasksError;

    // Check which tasks already have due_soon notifications
    const taskIds = tasksDueSoon?.map(t => t.id) || [];
    
    if (taskIds.length > 0) {
      const { data: existingNotifs } = await supabase
        .from('notifications')
        .select('task_id')
        .in('task_id', taskIds)
        .eq('notification_type', 'due_soon')
        .gte('created_at', new Date(Date.now() - 24*60*60*1000).toISOString());

      const notifiedTaskIds = new Set(existingNotifs?.map(n => n.task_id) || []);
      
      // Create notifications for tasks not yet notified
      const newNotifications = tasksDueSoon
        ?.filter(task => !notifiedTaskIds.has(task.id))
        .map(task => {
          const hoursUntilDue = Math.round(
            (new Date(task.due_date).getTime() - Date.now()) / (1000 * 60 * 60)
          );
          
          return {
            user_id: task.assigned_to,
            task_id: task.id,
            notification_type: 'due_soon',
            title: 'Task Due Soon',
            message: `Task "${task.task_name}" is due in ${hoursUntilDue} hours`
          };
        });

      if (newNotifications && newNotifications.length > 0) {
        const { error: insertError } = await supabase
          .from('notifications')
          .insert(newNotifications);

        if (insertError) throw insertError;
        
        console.log(`Created ${newNotifications.length} due-soon notifications`);
        
        // Send email notifications for due soon tasks
        for (const task of tasksDueSoon?.filter(t => !notifiedTaskIds.has(t.id)) || []) {
          try {
            await supabase.functions.invoke('send-task-notification-email', {
              body: {
                user_id: task.assigned_to,
                task_id: task.id,
                notification_type: 'due_soon',
                task_name: task.task_name,
                due_date: task.due_date,
              },
            });
            console.log(`Email sent for due soon task: ${task.task_name}`);
          } catch (emailError) {
            console.error(`Failed to send email for task ${task.id}:`, emailError);
          }
        }
      }
    }

    // Get overdue tasks
    const { data: overdueTasks, error: overdueError } = await supabase
      .from('project_tasks')
      .select('id, task_name, assigned_to, due_date')
      .lt('due_date', new Date().toISOString())
      .in('status', ['pending', 'in_progress']);

    if (overdueError) throw overdueError;

    const overdueTaskIds = overdueTasks?.map(t => t.id) || [];
    
    if (overdueTaskIds.length > 0) {
      // Check for existing overdue notifications from today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      
      const { data: existingOverdue } = await supabase
        .from('notifications')
        .select('task_id')
        .in('task_id', overdueTaskIds)
        .eq('notification_type', 'overdue')
        .gte('created_at', todayStart.toISOString());

      const notifiedOverdueIds = new Set(existingOverdue?.map(n => n.task_id) || []);
      
      const overdueNotifications = overdueTasks
        ?.filter(task => !notifiedOverdueIds.has(task.id))
        .map(task => {
          const daysOverdue = Math.ceil(
            (Date.now() - new Date(task.due_date).getTime()) / (1000 * 60 * 60 * 24)
          );
          
          return {
            user_id: task.assigned_to,
            task_id: task.id,
            notification_type: 'overdue',
            title: 'Task Overdue',
            message: `Task "${task.task_name}" is overdue by ${daysOverdue} day(s)`
          };
        });

      if (overdueNotifications && overdueNotifications.length > 0) {
        const { error: insertError } = await supabase
          .from('notifications')
          .insert(overdueNotifications);

        if (insertError) throw insertError;
        
        console.log(`Created ${overdueNotifications.length} overdue notifications`);
        
        // Send email notifications for overdue tasks
        for (const task of overdueTasks?.filter(t => !notifiedOverdueIds.has(t.id)) || []) {
          try {
            await supabase.functions.invoke('send-task-notification-email', {
              body: {
                user_id: task.assigned_to,
                task_id: task.id,
                notification_type: 'overdue',
                task_name: task.task_name,
                due_date: task.due_date,
              },
            });
            console.log(`Email sent for overdue task: ${task.task_name}`);
          } catch (emailError) {
            console.error(`Failed to send email for task ${task.id}:`, emailError);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        dueSoon: tasksDueSoon?.length || 0,
        overdue: overdueTasks?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error checking task due dates:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
