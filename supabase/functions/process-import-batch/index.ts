import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { corsHeaders } from '../_shared/cors-headers.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization');
    const isInternalCall = req.headers.get('x-internal-call') === 'true';
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader || '' } },
    });

    const { importId, batchNumber, records, tableName, userId: bodyUserId } = await req.json();

    let userId: string;

    if (isInternalCall && bodyUserId) {
      // Internal call from process-import-job with userId in body
      userId = bodyUserId;
      console.log(`Internal call for import ${importId}, batch ${batchNumber}, userId: ${userId}`);
    } else {
      // External call - require authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      userId = user.id;
    }
    
    if (!importId || batchNumber === undefined || !records || !tableName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if import was cancelled
    const { data: importSession } = await supabase
      .from('bulk_import_history')
      .select('status')
      .eq('id', importId)
      .single();

    if (importSession?.status === 'cancelled') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          cancelled: true, 
          message: 'Import was cancelled' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update status to processing on first batch
    if (batchNumber === 1) {
      await supabase
        .from('bulk_import_history')
        .update({ status: 'processing' })
        .eq('id', importId);
    }

    const errors: Array<{ row: number; message: string }> = [];
    let inserted = 0;
    const insertedRecords: Array<{ record_id: string; row_number: number }> = [];

    // Helper to clean and normalize field values
    const cleanValue = (value: any): any => {
      if (value === null || value === undefined) return null;
      if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed === '' ? null : trimmed;
      }
      return value;
    };

    // Helper to parse various date formats into YYYY-MM-DD
    const parseDate = (dateStr: string): string | null => {
      if (!dateStr?.trim()) return null;
      
      const cleaned = dateStr.trim();
      
      // Already in ISO format (YYYY-MM-DD)
      if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(cleaned)) {
        const date = new Date(cleaned);
        if (!isNaN(date.getTime())) {
          return cleaned.split('-').map((part, i) => 
            i === 0 ? part : part.padStart(2, '0')
          ).join('-');
        }
      }
      
      // Try M/D/YYYY or MM/DD/YYYY format (US format - most common in Excel/CSV)
      const slashMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (slashMatch) {
        const [, month, day, year] = slashMatch;
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        if (!isNaN(date.getTime())) {
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
      }
      
      return null;
    };

    // For projects, use BATCH processing with parallel inserts
    if (tableName === 'projects') {
      console.log('Processing projects batch with parallel processing');
      
      // Step 1: Collect all unique emails (project owners + team members)
      const allEmails = new Set<string>();
      records.forEach((record: any) => {
        if (record['Project Owner Email']?.trim()) {
          allEmails.add(record['Project Owner Email'].trim().toLowerCase());
        }
        if (record['Team Member Email']?.trim()) {
          allEmails.add(record['Team Member Email'].trim().toLowerCase());
        }
      });

      // Step 2: Batch lookup all profiles in ONE query
      const emailArray = Array.from(allEmails);
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, email')
        .in('email', emailArray);

      const emailToIdMap = new Map<string, string>();
      profilesData?.forEach((profile: any) => {
        emailToIdMap.set(profile.email.toLowerCase(), profile.id);
      });

      // Step 3: Collect all project numbers and check for duplicates
      const projectNumbers = records
        .map((record: any) => record['Project Number']?.trim())
        .filter(Boolean);

      if (projectNumbers.length > 0) {
        const { data: existingProjects } = await supabase
          .from('projects')
          .select('project_number')
          .in('project_number', projectNumbers);

        const existingNumbers = new Set(
          existingProjects?.map((p: any) => p.project_number) || []
        );

        // Mark duplicate project numbers
        records.forEach((record: any, index: number) => {
          const projectNumber = record['Project Number']?.trim();
          if (projectNumber && existingNumbers.has(projectNumber)) {
            const baseRecordsProcessed = (batchNumber - 1) * records.length;
            const rowNumber = baseRecordsProcessed + index + 1;
            errors.push({
              row: rowNumber,
              message: `Duplicate project number: ${projectNumber} already exists`
            });
          }
        });
      }

      // Step 4: Prepare all projects in parallel
      const projectInsertPromises = records.map(async (record: any, index: number) => {
        const baseRecordsProcessed = (batchNumber - 1) * records.length;
        const rowNumber = baseRecordsProcessed + index + 1;

        try {
          // Validate required fields
          if (!record['Project Number']?.trim()) {
            errors.push({
              row: rowNumber,
              message: 'Missing required field: Project Number'
            });
            return null;
          }

          if (!record['Project Name']?.trim()) {
            errors.push({
              row: rowNumber,
              message: 'Missing required field: Project Name'
            });
            return null;
          }

          if (!record['Project Owner Email']?.trim()) {
            errors.push({
              row: rowNumber,
              message: 'Missing required field: Project Owner Email'
            });
            return null;
          }

          if (!record['Team Member Email']?.trim()) {
            errors.push({
              row: rowNumber,
              message: 'Missing required field: Team Member Email'
            });
            return null;
          }

          // Get project owner ID
          const projectOwnerEmail = record['Project Owner Email'].trim().toLowerCase();
          const projectOwnerId = emailToIdMap.get(projectOwnerEmail);
          
          if (!projectOwnerId) {
            errors.push({
              row: rowNumber,
              message: `Project owner email not found: ${record['Project Owner Email']}`
            });
            return null;
          }

          const projectNumber = record['Project Number'].trim();

          // Find client by name
          let clientId = null;
          if (record['Client Name']?.trim()) {
            const { data: existingClient } = await supabase
              .from('clients')
              .select('company_name')
              .ilike('company_name', record['Client Name'].trim())
              .single();

            if (existingClient) {
              clientId = existingClient.company_name;
            }
          }

          // Find contact by name
          let contactId = null;
          if (record['Contact Name']?.trim() && clientId) {
            const { data: existingContact } = await supabase
              .from('clients')
              .select('contact_name')
              .eq('company_name', clientId)
              .ilike('contact_name', record['Contact Name'].trim())
              .single();

            if (existingContact) {
              contactId = existingContact.contact_name;
            }
          }

          // Parse locations
          const locations = [];
          if (record['City']?.trim() || record['Venue']?.trim()) {
            locations.push({
              city: cleanValue(record['City']) || '',
              venue: cleanValue(record['Venue']) || ''
            });
          }

          // Parse event dates
          const eventDates = [];
          if (record['Event Date (YYYY-MM-DD or M/D/YYYY)']?.trim()) {
            const eventType = cleanValue(record['Event Type (full_day/first_half/second_half)'])?.toLowerCase();
            const validEventType = ['full_day', 'first_half', 'second_half'].includes(eventType) ? eventType : 'full_day';
            
            const parsedDate = parseDate(record['Event Date (YYYY-MM-DD or M/D/YYYY)']);
            if (!parsedDate) {
              errors.push({
                row: rowNumber,
                message: `Invalid date format: "${record['Event Date (YYYY-MM-DD or M/D/YYYY)']}". Expected YYYY-MM-DD or M/D/YYYY`
              });
              return null;
            }
            
            eventDates.push({
              date: parsedDate,
              type: validEventType
            });
          }

          // Parse status
          const statusValue = cleanValue(record['Status (pitched/in_discussion/estimate_shared/po_received/execution/invoiced/closed/lost)'])?.toLowerCase();
          const validStatuses = ['pitched', 'in_discussion', 'estimate_shared', 'po_received', 'execution', 'invoiced', 'closed', 'lost'];
          const status = validStatuses.includes(statusValue) ? statusValue : 'pitched';

          // Parse numbers
          const projectValue = record['Project Value'] ? parseFloat(String(record['Project Value']).replace(/[^0-9.-]/g, '')) : null;
          const managementFees = record['Management Fees'] ? parseFloat(String(record['Management Fees']).replace(/[^0-9.-]/g, '')) : null;
          const expectedAfactor = record['Expected A-Factor'] ? parseFloat(String(record['Expected A-Factor']).replace(/[^0-9.-]/g, '')) : null;
          const finalAfactor = record['Final A-Factor'] ? parseFloat(String(record['Final A-Factor']).replace(/[^0-9.-]/g, '')) : null;

          const projectData: any = {
            project_number: projectNumber,
            project_name: record['Project Name'].trim(),
            project_owner: projectOwnerId,
            client_id: clientId,
            contact_id: contactId,
            status: status,
            project_source: cleanValue(record['Project Source (inbound/outbound)']),
            project_value: projectValue,
            management_fees: managementFees,
            expected_afactor: expectedAfactor,
            final_afactor: finalAfactor,
            closed_reason: status === 'closed' ? cleanValue(record['Closed Reason']) : null,
            lost_reason: status === 'lost' ? cleanValue(record['Lost Reason']) : null,
            brief: cleanValue(record['Brief']),
            created_by: userId,
            locations: locations,
            event_dates: eventDates,
          };

          // Insert project
          const { data: insertedProject, error: insertError } = await supabase
            .from('projects')
            .insert(projectData)
            .select('id')
            .single();

          if (insertError) {
            errors.push({
              row: rowNumber,
              message: insertError.message
            });
            return null;
          }

          // Add team member
          const teamMemberEmail = record['Team Member Email'].trim().toLowerCase();
          const teamMemberId = emailToIdMap.get(teamMemberEmail);
          const teamMemberRole = cleanValue(record['Team Member Role (owner/member/lead/coordinator)'])?.toLowerCase() || 'member';

          if (!teamMemberId) {
            errors.push({
              row: rowNumber,
              message: `Team member email not found: ${record['Team Member Email']}`
            });
          } else {
            const { error: teamMemberError } = await supabase
              .from('project_team_members')
              .insert({
                project_id: insertedProject.id,
                user_id: teamMemberId,
                assigned_by: userId,
                role_in_project: teamMemberRole,
              });
            
            if (teamMemberError) {
              console.error('Team member insertion failed:', teamMemberError);
              errors.push({
                row: rowNumber,
                message: `Failed to add team member: ${teamMemberError.message}`
              });
            }
          }

          // Store for revert capability
          await supabase
            .from('bulk_import_records')
            .insert({
              import_id: importId,
              record_id: insertedProject.id,
              table_name: tableName,
              row_number: rowNumber
            });

          return insertedProject.id;
        } catch (err: any) {
          errors.push({
            row: rowNumber,
            message: err.message || 'Failed to insert project'
          });
          return null;
        }
      });

      // Wait for all projects to be inserted
      const results = await Promise.all(projectInsertPromises);
      inserted = results.filter(Boolean).length;
      
    } else {
      // OPTIMIZATION: Batch email-to-UUID lookup BEFORE processing records
      // This reduces N database calls to just 1, preventing CPU timeout
      
      // Step 1: Collect all unique assigned_to emails from the batch
      const assignedToEmails = new Set<string>();
      if (tableName === 'demandcom' || tableName === 'master') {
        records.forEach((record: any) => {
          if (record.assigned_to?.trim()) {
            assignedToEmails.add(record.assigned_to.trim().toLowerCase());
          }
        });
      }

      // Step 2: ONE batch query to get all user IDs
      const emailToIdMap = new Map<string, string>();
      if (assignedToEmails.size > 0) {
        console.log(`Batch lookup for ${assignedToEmails.size} unique emails`);
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, email')
          .in('email', Array.from(assignedToEmails));

        if (profilesError) {
          console.error('Batch email lookup failed:', profilesError);
        } else {
          profilesData?.forEach((profile: any) => {
            emailToIdMap.set(profile.email.toLowerCase(), profile.id);
          });
          console.log(`Found ${emailToIdMap.size} users for ${assignedToEmails.size} emails`);
        }
      }

      // Step 3: Process records synchronously using the pre-fetched Map (no DB calls!)
      const preparedRecords = records.map((record: any, index: number) => {
        const baseRecordsProcessed = (batchNumber - 1) * records.length;
        const rowNumber = baseRecordsProcessed + index + 1;
        
        // Validate based on table
        if (tableName === 'demandcom' || tableName === 'master') {
          if (!record.name && !record.mobile_numb) {
            errors.push({
              row: rowNumber,
              message: 'Missing required fields: name or mobile_numb'
            });
            return null;
          }
        } else if (tableName === 'clients') {
          if (!record.company_name?.trim() || !record.contact_name?.trim()) {
            errors.push({
              row: rowNumber,
              message: 'Missing required fields: company_name and contact_name are required'
            });
            return null;
          }

          // Validate email format if provided
          const email = cleanValue(record.email_id);
          if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errors.push({
              row: rowNumber,
              message: 'Invalid email format'
            });
            return null;
          }

          // Validate LinkedIn URL format if provided
          const linkedinPage = cleanValue(record.company_linkedin_page);
          if (linkedinPage && !/^https?:\/\/.+/.test(linkedinPage)) {
            errors.push({
              row: rowNumber,
              message: 'LinkedIn page must be a valid URL'
            });
            return null;
          }

          // Validate date formats if provided
          const birthdayDate = cleanValue(record.birthday_date);
          if (birthdayDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthdayDate)) {
            errors.push({
              row: rowNumber,
              message: 'birthday_date must be in YYYY-MM-DD format or empty'
            });
            return null;
          }

          const anniversaryDate = cleanValue(record.anniversary_date);
          if (anniversaryDate && !/^\d{4}-\d{2}-\d{2}$/.test(anniversaryDate)) {
            errors.push({
              row: rowNumber,
              message: 'anniversary_date must be in YYYY-MM-DD format or empty'
            });
            return null;
          }

          // Clean all fields for clients
          return {
            company_name: record.company_name.trim(),
            contact_name: record.contact_name.trim(),
            official_address: cleanValue(record.official_address),
            residence_address: cleanValue(record.residence_address),
            contact_number: cleanValue(record.contact_number),
            email_id: email,
            birthday_date: birthdayDate,
            anniversary_date: anniversaryDate,
            company_linkedin_page: linkedinPage,
            linkedin_id: cleanValue(record.linkedin_id),
            created_by: userId,
          };
        }

        // Handle assigned_to email to UUID conversion using pre-fetched Map (O(1) lookup!)
        if ((tableName === 'demandcom' || tableName === 'master') && record.assigned_to) {
          const email = record.assigned_to.trim().toLowerCase();
          const userId = emailToIdMap.get(email);
          
          if (!userId) {
            errors.push({
              row: rowNumber,
              message: `User not found: ${record.assigned_to}`
            });
            record.assigned_to = null;
          } else {
            record.assigned_to = userId;
          }
        }

        return {
          ...record,
          created_by: userId,
        };
      });

      const validRecords = preparedRecords.filter(Boolean);

      // Insert records for non-project tables
      if (validRecords.length > 0) {
        const { data, error } = await supabase
          .from(tableName)
          .insert(validRecords)
          .select('id');

        if (error) {
          console.error('Batch insert error:', error);
          validRecords.forEach((_: any, index: number) => {
            const baseRecordsProcessed = (batchNumber - 1) * records.length;
            const rowNumber = baseRecordsProcessed + index + 1;
            errors.push({
              row: rowNumber,
              message: error.message || 'Database insert failed'
            });
          });
        } else {
          inserted = data?.length || 0;
          
          // Store record IDs for revert capability
          if (data && data.length > 0) {
            const baseRecordsProcessed = (batchNumber - 1) * records.length;
            const importRecords = data.map((record, index) => ({
              import_id: importId,
              record_id: record.id,
              table_name: tableName,
              row_number: baseRecordsProcessed + index + 1
            }));

            await supabase
              .from('bulk_import_records')
              .insert(importRecords);
          }
        }
      }
    }

    // Update import history progress with comprehensive error handling
    try {
      console.log(`Updating progress for import ${importId}, batch ${batchNumber}`);
      
      const { data: currentImport, error: fetchError } = await supabase
        .from('bulk_import_history')
        .select('processed_records, successful_records, failed_records, error_log')
        .eq('id', importId)
        .single();

      if (fetchError) {
        console.error('Failed to fetch current import stats:', fetchError);
        throw new Error(`Cannot update progress: ${fetchError.message}`);
      }

      if (!currentImport) {
        console.error('Import session not found:', importId);
        throw new Error('Import session not found');
      }

      const newProcessedRecords = (currentImport.processed_records || 0) + records.length;
      const newSuccessfulRecords = (currentImport.successful_records || 0) + inserted;
      const newFailedRecords = (currentImport.failed_records || 0) + errors.length;
      const currentErrorLog = Array.isArray(currentImport.error_log) ? currentImport.error_log : [];
      const updatedErrorLog = [...currentErrorLog, ...errors];

      console.log(`Batch ${batchNumber} results:`, {
        processed: records.length,
        inserted,
        failed: errors.length,
        newTotals: {
          processed: newProcessedRecords,
          successful: newSuccessfulRecords,
          failed: newFailedRecords,
          errorCount: updatedErrorLog.length
        }
      });

      const { error: updateError } = await supabase
        .from('bulk_import_history')
        .update({
          current_batch: batchNumber,
          processed_records: newProcessedRecords,
          successful_records: newSuccessfulRecords,
          failed_records: newFailedRecords,
          error_log: updatedErrorLog,
          updated_at: new Date().toISOString()
        })
        .eq('id', importId);

      if (updateError) {
        console.error('Failed to update import history:', updateError);
        throw new Error(`Progress update failed: ${updateError.message}`);
      }

      console.log(`Successfully updated import ${importId} progress`);
    } catch (progressError) {
      console.error('CRITICAL: Error updating progress for import', importId, ':', progressError);
      console.error(`Batch ${batchNumber} completed but progress tracking failed!`);
      console.error('Batch stats:', { inserted, failed: errors.length, total: records.length });
      // Don't fail the whole batch, but make sure error is visible
      throw progressError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        batchNumber,
        inserted,
        failed: errors.length,
        errors: errors.slice(0, 10), // Return first 10 errors
        cancelled: false
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in process-import-batch:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});