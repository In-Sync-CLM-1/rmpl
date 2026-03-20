import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { corsHeaders } from '../_shared/cors-headers.ts';

interface FilterParams {
  nameEmail?: string;
  city?: string;
  activityName?: string;
  assignedTo?: string;
  disposition?: string[];
  subdisposition?: string[];
}

interface AssignmentRequest {
  assignedTo: string;
  // New batch-based parameters
  offset?: number;
  limit?: number;
  filters?: FilterParams;
  // Legacy support for direct record IDs (small sets)
  recordIds?: string[];
}

const BATCH_SIZE = 500;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create client with service role for batch updates
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user authentication using the user's token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Authenticated user:', user.id);

    const { assignedTo, offset, limit, filters, recordIds }: AssignmentRequest = await req.json();

    if (!assignedTo) {
      return new Response(JSON.stringify({ error: 'assignedTo is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify assignee exists
    const { data: assigneeProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('id', assignedTo)
      .single();

    if (profileError || !assigneeProfile) {
      console.error('Assignee not found:', profileError);
      return new Response(JSON.stringify({ error: 'Invalid assignee user' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Assigning to user:', assigneeProfile.full_name);

    let totalAssigned = 0;

    // Check if using legacy recordIds approach (for small sets)
    if (recordIds && recordIds.length > 0 && recordIds.length <= 100) {
      console.log(`Using direct recordIds approach for ${recordIds.length} records`);
      
      const { error: updateError } = await supabase
        .from('demandcom')
        .update({
          assigned_to: assignedTo,
          assigned_by: user.id,
          assigned_at: new Date().toISOString(),
          assignment_status: 'assigned',
        })
        .in('id', recordIds);

      if (updateError) {
        console.error('Error updating records:', updateError);
        return new Response(JSON.stringify({ error: 'Failed to assign records' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      totalAssigned = recordIds.length;
    } else {
      // Use batch processing with filters
      if (offset === undefined || limit === undefined) {
        return new Response(JSON.stringify({ error: 'offset and limit are required for batch processing' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`Processing batch assignment: offset=${offset}, limit=${limit}`);
      
      // Process in batches of BATCH_SIZE
      let currentOffset = offset;
      let remaining = limit;
      let batchNumber = 0;

      while (remaining > 0) {
        batchNumber++;
        const batchLimit = Math.min(BATCH_SIZE, remaining);
        
        console.log(`Processing batch ${batchNumber}: offset=${currentOffset}, limit=${batchLimit}`);

        // Build query to fetch IDs for this batch
        let query = supabase
          .from('demandcom')
          .select('id');

        // Apply filters
        const hasFilters = filters && (
          filters.nameEmail || 
          filters.city || 
          filters.activityName || 
          (filters.assignedTo && filters.assignedTo !== 'all') ||
          (filters.disposition && filters.disposition.length > 0) ||
          (filters.subdisposition && filters.subdisposition.length > 0)
        );

        if (!hasFilters) {
          // Default: last 30 days
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          query = query.gte('created_at', thirtyDaysAgo.toISOString());
        }

        if (filters?.nameEmail) {
          const filterPattern = `%${filters.nameEmail}%`;
          query = query.or(`name.ilike.${filterPattern},personal_email_id.ilike.${filterPattern},generic_email_id.ilike.${filterPattern},mobile_numb.ilike.${filterPattern}`);
        }

        if (filters?.city) {
          query = query.ilike('city', `%${filters.city}%`);
        }

        if (filters?.activityName) {
          query = query.ilike('activity_name', `%${filters.activityName}%`);
        }

        if (filters?.assignedTo && filters.assignedTo !== 'all') {
          if (filters.assignedTo === 'unassigned') {
            query = query.is('assigned_to', null);
          } else {
            query = query.eq('assigned_to', filters.assignedTo);
          }
        }

        if (filters?.disposition && filters.disposition.length > 0) {
          query = query.in('latest_disposition', filters.disposition);
        }

        if (filters?.subdisposition && filters.subdisposition.length > 0) {
          query = query.in('latest_subdisposition', filters.subdisposition);
        }

        // Apply ordering and range
        query = query
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(currentOffset, currentOffset + batchLimit - 1);

        const { data: batchRecords, error: fetchError } = await query;

        if (fetchError) {
          console.error(`Batch ${batchNumber} fetch error:`, fetchError);
          throw fetchError;
        }

        if (!batchRecords || batchRecords.length === 0) {
          console.log(`Batch ${batchNumber}: No more records to process`);
          break;
        }

        const batchIds = batchRecords.map((r: any) => r.id);
        console.log(`Batch ${batchNumber}: Updating ${batchIds.length} records`);

        // Update this batch
        const { error: updateError } = await supabase
          .from('demandcom')
          .update({
            assigned_to: assignedTo,
            assigned_by: user.id,
            assigned_at: new Date().toISOString(),
            assignment_status: 'assigned',
          })
          .in('id', batchIds);

        if (updateError) {
          console.error(`Batch ${batchNumber} update error:`, updateError);
          throw updateError;
        }

        totalAssigned += batchIds.length;
        currentOffset += batchLimit;
        remaining -= batchLimit;

        console.log(`Batch ${batchNumber} complete. Total assigned so far: ${totalAssigned}`);
      }
    }

    console.log(`Successfully assigned ${totalAssigned} records to ${assigneeProfile.full_name}`);

    return new Response(JSON.stringify({ 
      successCount: totalAssigned,
      message: `Successfully assigned ${totalAssigned} record(s) to ${assigneeProfile.full_name}`,
      assigneeName: assigneeProfile.full_name,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
