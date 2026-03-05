import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    // Verify bearer token
    const authHeader = req.headers.get('Authorization');
    const expectedSecret = Deno.env.get('CRM_WEBHOOK_SECRET');
    
    if (!expectedSecret) {
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader?.replace('Bearer ', '');
    if (!token || token !== expectedSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = await req.json();
    const { tableName, operation, triggerData, orgId } = payload;

    if (!tableName || !triggerData) {
      return new Response(JSON.stringify({ error: 'Missing tableName or triggerData' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Resolve org_id from external orgId
    let localOrgId: string | null = null;
    if (orgId) {
      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('external_org_id', orgId)
        .limit(1)
        .single();
      localOrgId = org?.id || null;
    }

    // If no org found by external ID, use first org (single-tenant fallback)
    if (!localOrgId) {
      const { data: fallbackOrg } = await supabase
        .from('organizations')
        .select('id')
        .limit(1)
        .single();
      localOrgId = fallbackOrg?.id || null;
    }

    let result;

    switch (tableName) {
      case 'support_tickets': {
        const ticketData: Record<string, any> = {
          external_ticket_id: triggerData.id,
          ticket_number: triggerData.ticket_number || null,
          subject: triggerData.subject || null,
          description: triggerData.description || null,
          category: triggerData.category || null,
          priority: triggerData.priority || 'medium',
          status: triggerData.status || 'new',
          contact_name: triggerData.contact_name || null,
          contact_email: triggerData.contact_email || null,
          contact_phone: triggerData.contact_phone || null,
          source: triggerData.source || null,
          assigned_to: triggerData.assigned_to || null,
          due_at: triggerData.due_at || null,
          resolved_at: triggerData.resolved_at || null,
          org_id: localOrgId,
          updated_at: new Date().toISOString(),
        };

        result = await supabase
          .from('crm_tickets')
          .upsert(ticketData, { onConflict: 'external_ticket_id' });
        break;
      }

      case 'support_ticket_comments': {
        // Skip internal comments
        if (triggerData.is_internal === true) {
          return new Response(JSON.stringify({ success: true, skipped: 'internal_comment' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Resolve crm_ticket_id from external ticket id
        const { data: ticket } = await supabase
          .from('crm_tickets')
          .select('id')
          .eq('external_ticket_id', triggerData.ticket_id)
          .single();

        if (!ticket) {
          return new Response(JSON.stringify({ error: 'Ticket not found for comment' }), {
            status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const commentData = {
          external_comment_id: triggerData.id,
          crm_ticket_id: ticket.id,
          comment: triggerData.comment || null,
          is_internal: false,
          created_by: triggerData.created_by || null,
          org_id: localOrgId,
        };

        result = await supabase
          .from('crm_ticket_comments')
          .upsert(commentData, { onConflict: 'external_comment_id' });
        break;
      }

      case 'support_ticket_escalations': {
        const { data: ticket } = await supabase
          .from('crm_tickets')
          .select('id')
          .eq('external_ticket_id', triggerData.ticket_id)
          .single();

        if (!ticket) {
          return new Response(JSON.stringify({ error: 'Ticket not found for escalation' }), {
            status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const escalationData = {
          external_escalation_id: triggerData.id,
          crm_ticket_id: ticket.id,
          remarks: triggerData.remarks || null,
          escalated_by: triggerData.escalated_by || null,
          escalated_to: triggerData.escalated_to || null,
          attachments: triggerData.attachments || [],
          org_id: localOrgId,
        };

        result = await supabase
          .from('crm_ticket_escalations')
          .upsert(escalationData, { onConflict: 'external_escalation_id' });
        break;
      }

      case 'support_ticket_history': {
        const { data: ticket } = await supabase
          .from('crm_tickets')
          .select('id')
          .eq('external_ticket_id', triggerData.ticket_id)
          .single();

        if (!ticket) {
          return new Response(JSON.stringify({ error: 'Ticket not found for history' }), {
            status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const historyData = {
          external_history_id: triggerData.id,
          crm_ticket_id: ticket.id,
          action: triggerData.action || null,
          old_value: triggerData.old_value || null,
          new_value: triggerData.new_value || null,
          changed_by: triggerData.changed_by || null,
          org_id: localOrgId,
        };

        result = await supabase
          .from('crm_ticket_history')
          .upsert(historyData, { onConflict: 'external_history_id' });
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown tableName: ${tableName}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    if (result?.error) {
      console.error('Upsert error:', result.error);
      return new Response(JSON.stringify({ error: result.error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
