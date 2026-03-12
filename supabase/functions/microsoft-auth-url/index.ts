import { corsHeaders, handleCorsPreflightRequest } from '../_shared/cors-headers.ts';
import { successResponse, errorResponse, unauthorizedResponse } from '../_shared/response-helpers.ts';

function getUserIdFromJwt(authHeader: string | null): string | null {
  if (!authHeader) return null;
  try {
    const token = authHeader.replace('Bearer ', '');
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload.sub || null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsPreflightRequest();

  try {
    // Extract user_id directly from JWT payload (gateway already verified signature via verify_jwt=true)
    const authHeader = req.headers.get('Authorization');
    const userId = getUserIdFromJwt(authHeader);
    if (!userId) return unauthorizedResponse('Invalid or missing authentication token');

    const { redirect_path } = await req.json();

    const clientId = Deno.env.get('MICROSOFT_CLIENT_ID');
    if (!clientId) return errorResponse('Microsoft integration not configured', 500);

    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/microsoft-auth-callback`;
    const scopes = 'openid profile email Mail.Send Mail.ReadWrite User.Read offline_access';

    const state = btoa(JSON.stringify({
      user_id: userId,
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
