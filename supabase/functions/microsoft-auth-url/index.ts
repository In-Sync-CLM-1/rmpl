import { corsHeaders, handleCorsPreflightRequest } from '../_shared/cors-headers.ts';
import { verifyAuth } from '../_shared/auth-helpers.ts';
import { successResponse, errorResponse, unauthorizedResponse } from '../_shared/response-helpers.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsPreflightRequest();

  try {
    const authHeader = req.headers.get('Authorization');
    const { authenticated, user, error: authError } = await verifyAuth(authHeader);
    if (!authenticated || !user) return unauthorizedResponse(authError || 'Unauthorized');

    const { redirect_path } = await req.json();

    const clientId = Deno.env.get('MICROSOFT_CLIENT_ID');
    if (!clientId) return errorResponse('Microsoft integration not configured', 500);

    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/microsoft-auth-callback`;
    const scopes = 'openid profile email Mail.Send Mail.ReadWrite User.Read offline_access';

    const state = btoa(JSON.stringify({
      user_id: user.id,
      redirect_path: redirect_path || '/my-profile',
    }));

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: scopes,
      state: state,
      prompt: 'consent',
      response_mode: 'query',
    });

    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;

    return successResponse({ auth_url: authUrl });
  } catch (err) {
    console.error('microsoft-auth-url error:', err);
    return errorResponse(err instanceof Error ? err.message : 'Internal error', 500);
  }
});
