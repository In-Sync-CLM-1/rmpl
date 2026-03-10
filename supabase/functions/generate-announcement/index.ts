import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors-headers.ts';
import { verifyAuth } from '../_shared/auth-helpers.ts';
import { errorResponse, successResponse, unauthorizedResponse } from '../_shared/response-helpers.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const { authenticated, error: authError } = await verifyAuth(authHeader);

    if (!authenticated) {
      console.error('Authentication failed:', authError);
      return unauthorizedResponse(authError || 'Authentication required');
    }

    const { changeDescription, autoSave = false, targetRoles = null } = await req.json();

    if (!changeDescription || typeof changeDescription !== 'string') {
      return errorResponse('Change description is required', 400);
    }

    if (!ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY not configured');
      return errorResponse('AI service not configured', 500);
    }

    console.log('Generating announcement for:', changeDescription);

    const systemPrompt = `You are an expert at transforming technical change descriptions into user-friendly product announcements.

Your task is to convert technical descriptions of changes into engaging, clear announcements that users will appreciate.

Guidelines:
- Use a friendly, positive tone
- Focus on benefits to the user, not technical details
- Keep the title catchy but informative (max 50 characters)
- Keep the description clear and concise (max 200 characters)
- Choose the appropriate type and priority based on the change

Types:
- new_feature: Brand new functionality
- improvement: Enhancement to existing features
- bug_fix: Fixed issues or errors
- update: General updates or changes
- removal: Deprecated or removed features

Priority:
- high: Major features or critical fixes
- medium: Useful improvements and regular updates
- low: Minor tweaks or informational updates`;

    const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        tools: [{
          name: 'create_announcement',
          description: 'Create a structured feature announcement',
          input_schema: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Catchy, user-friendly title (max 50 chars)' },
              description: { type: 'string', description: 'Clear, benefit-focused description (max 200 chars)' },
              announcement_type: { type: 'string', enum: ['new_feature', 'improvement', 'bug_fix', 'update', 'removal'], description: 'Type of announcement' },
              priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Priority level' }
            },
            required: ['title', 'description', 'announcement_type', 'priority'],
          }
        }],
        tool_choice: { type: 'tool', name: 'create_announcement' },
        messages: [
          { role: 'user', content: `Convert this technical change into a user-friendly announcement:\n\n${changeDescription}` }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);

      if (aiResponse.status === 429) {
        return errorResponse('Rate limit exceeded. Please try again in a moment.', 429);
      }

      return errorResponse('Failed to generate announcement', 500, errorText);
    }

    const aiData = await aiResponse.json();
    console.log('AI response:', JSON.stringify(aiData, null, 2));

    const toolUse = aiData.content?.find((c: any) => c.type === 'tool_use');
    if (!toolUse) {
      console.error('No tool use in response');
      return errorResponse('AI did not return structured data', 500);
    }

    const announcement = toolUse.input;
    console.log('Generated announcement:', announcement);

    if (autoSave) {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.39.3');
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const { data: savedAnnouncement, error: saveError } = await supabase
        .from('feature_announcements')
        .insert({
          title: announcement.title,
          description: announcement.description,
          announcement_type: announcement.announcement_type,
          priority: announcement.priority,
          target_roles: targetRoles,
          is_active: true,
          published_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (saveError) {
        console.error("Error saving announcement:", saveError);
        return errorResponse("Failed to save announcement: " + saveError.message, 500);
      }

      return successResponse({ ...savedAnnouncement, saved: true });
    }

    return successResponse({
      title: announcement.title,
      description: announcement.description,
      announcement_type: announcement.announcement_type,
      priority: announcement.priority
    });

  } catch (error) {
    console.error('Error in generate-announcement:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Unknown error',
      500
    );
  }
});
