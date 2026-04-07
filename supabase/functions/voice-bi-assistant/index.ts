import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import {
  groqTextResponse,
  GroqApiError,
} from "../_shared/groq.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SCHEMA_CONTEXT = `You are a Business Intelligence assistant with access to a PostgreSQL database.
Generate SQL queries to answer user questions about business data.

Available tables and their key columns:

1. projects - Project management
   - id (uuid), project_name (text), project_number (text), client_id (uuid), status (text), created_at, created_by

2. project_quotations - Invoices/quotations for projects
   - id (uuid), project_id (uuid), quotation_number (text), amount (numeric - invoice amount), paid_amount (numeric), status (text), client_name (text), invoice_date (date), due_date (date), created_at

3. quotation_payments - Payment records
   - id (uuid), quotation_id (uuid), amount (numeric), payment_date (date), payment_mode (text), reference_number (text), bank_name (text)

4. clients - Client companies
   - id (uuid), company_name (text), contact_name (text), contact_number (text), email_id (text)

5. demandcom - Lead/prospect data
   - id (uuid), name (text), mobile_numb (text), company_name (text), designation (text), city (text), state (text), activity_name (text),
   - latest_disposition (text), latest_subdisposition (text), assigned_to (uuid), last_call_date (timestamptz), updated_at (timestamptz)

6. call_logs - Call records
   - id (uuid), call_sid (text), from_number (text), to_number (text), status (text), conversation_duration (int), disposition (text), subdisposition (text),
   - demandcom_id (uuid), initiated_by (uuid), created_at (timestamptz)

7. profiles - User profiles
   - id (uuid), full_name (text), email (text), role (text), reports_to (uuid)

8. attendance_records - Employee attendance
   - id (uuid), user_id (uuid), date (date), sign_in_time (timestamptz), sign_out_time (timestamptz), total_hours (numeric), status (text)

9. general_tasks - Task management
   - id (uuid), task_name (text), description (text), assigned_to (uuid), assigned_by (uuid), due_date (date), status (text), priority (text)

10. project_demandcom_allocations - Project lead allocations
    - id (uuid), project_id (uuid), user_id (uuid), registration_target (int), data_allocation (int)

Key relationships:
- projects.client_id::text = clients.id::text (cast both to text when joining)
- project_quotations.project_id = projects.id
- quotation_payments.quotation_id = project_quotations.id
- call_logs.initiated_by = profiles.id
- call_logs.demandcom_id = demandcom.id
- demandcom.assigned_to = profiles.id

Common business metrics:
- Collection rate: (COALESCE(paid_amount, 0) / NULLIF(amount, 0)) * 100
- Pending amount: amount - COALESCE(paid_amount, 0)
- Registration: latest_subdisposition = 'Registered'
- Interested: latest_subdisposition = 'Interested'
- Connect: conversation_duration > 0 AND status = 'completed'

QUERY RULES:
1. ONLY generate SELECT queries - absolutely no INSERT, UPDATE, DELETE, DROP, etc.
2. Always use COALESCE for nullable numeric fields to avoid null issues
3. Use ILIKE for text searches (case-insensitive)
4. Limit results to 50 rows max unless doing aggregation
5. Use proper JOINs based on relationships above
6. For today's date use CURRENT_DATE, for current timestamp use NOW()
7. When comparing uuid to text, cast: id::text = text_column OR text_column::uuid = id
8. Format amounts as numeric, the response generator will format them
9. Always include meaningful column aliases

Return the SQL query wrapped in <sql></sql> tags.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();

    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Voice BI Query:', query);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Step 1: Ask AI to generate SQL query
    console.log('Step 1: Generating SQL query from natural language...');
    let aiSqlResponse = '';
    try {
      aiSqlResponse = await groqTextResponse({
        instructions: SCHEMA_CONTEXT,
        input: `Generate a SQL query to answer this business question: "${query}"

Think about what tables and joins are needed. Return ONLY the SQL query wrapped in <sql></sql> tags.
If the question is a greeting or doesn't need data, return <sql>SELECT 'no_query_needed' as status</sql>`,
        maxOutputTokens: 1024,
      });
    } catch (error) {
      const status = error instanceof GroqApiError ? error.status : 500;
      const errorText = error instanceof GroqApiError ? error.body : String(error);
      console.error('AI SQL generation error:', status, errorText);
      if (error instanceof GroqApiError && error.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error('Failed to generate SQL query');
    }
    console.log('AI SQL Response:', aiSqlResponse);

    const sqlMatch = aiSqlResponse.match(/<sql>([\s\S]*?)<\/sql>/i);
    let queryResult = null;
    let sqlQuery = null;

    if (!sqlMatch) {
      console.log('No SQL tags found, treating as conversational response');
    } else {
      sqlQuery = sqlMatch[1].trim();
      console.log('Generated SQL:', sqlQuery);

      if (sqlQuery.toLowerCase().includes('no_query_needed')) {
        console.log('No database query needed for this question');
      } else {
        // Step 2: Execute the query
        console.log('Step 2: Executing query via execute_read_query...');
        const { data, error: queryError } = await supabase.rpc('execute_read_query', {
          query_text: sqlQuery
        });

        if (queryError) {
          console.error('Query execution error:', queryError);

          try {
            const fallbackResponse = await groqTextResponse({
              instructions: 'You are a helpful business assistant. A database query failed. Provide a polite, helpful response explaining you had trouble retrieving that specific data.',
              input: `User asked: "${query}"\nQuery failed with: ${queryError.message}\n\nProvide a brief, friendly response acknowledging the issue.`,
              maxOutputTokens: 512,
            });

            return new Response(
              JSON.stringify({
                response: fallbackResponse,
                sql_query: sqlQuery,
                error: queryError.message
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          } catch {
            // Fall through to generic error below.
          }

          throw new Error(`Query failed: ${queryError.message}`);
        }

        queryResult = data;
        console.log('Query result rows:', queryResult?.length || 0);
      }
    }

    // Step 3: Generate natural language response
    console.log('Step 3: Generating natural language response...');
    const responsePrompt = queryResult
      ? `User asked: "${query}"

Database query returned this data:
${JSON.stringify(queryResult, null, 2)}

Based on this data, provide a clear, conversational answer to the user's question.
Guidelines:
- Be concise but informative (this will be spoken aloud)
- Include specific numbers from the data
- Format large amounts in Indian format (lakhs/crores where appropriate, e.g., "15.5 lakhs" for 1550000)
- Use ₹ symbol for currency
- If data is empty, acknowledge it helpfully
- Speak naturally, like you're talking to a colleague
- Highlight key insights or trends if visible
- Don't mention SQL or database - just answer naturally`
      : `User asked: "${query}"

This appears to be a conversational question that doesn't require database data.
Respond naturally and helpfully. If they're asking about business data, let them know what kinds of questions you can help with (payments, collections, registrations, call performance, etc.).`;

    let naturalResponse = '';
    try {
      naturalResponse = await groqTextResponse({
        instructions: 'You are a friendly, professional business intelligence assistant for RMPL, a B2B events and marketing company. Provide clear, conversational answers. Your responses will be converted to speech, so keep them natural and concise.',
        input: responsePrompt,
        maxOutputTokens: 1024,
      });
    } catch (error) {
      const status = error instanceof GroqApiError ? error.status : 500;
      console.error('AI response generation error:', status);
      const basicResponse = queryResult?.length
        ? `I found ${queryResult.length} records for your query.`
        : 'I processed your question but had trouble generating a detailed response.';

      return new Response(
        JSON.stringify({
          response: basicResponse,
          sql_query: sqlQuery,
          data: queryResult
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    naturalResponse = naturalResponse ||
      'I found some information but had trouble summarizing it. Please try asking again.';

    console.log('Final response generated successfully');

    return new Response(
      JSON.stringify({
        response: naturalResponse,
        sql_query: sqlQuery,
        data: queryResult
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Voice BI Assistant error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
