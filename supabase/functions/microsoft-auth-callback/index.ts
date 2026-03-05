import { corsHeaders, handleCorsPreflightRequest } from '../_shared/cors-headers.ts';
import { createServiceClient } from '../_shared/supabase-client.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsPreflightRequest();

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const stateParam = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');

    // Determine the app origin for redirects
    const appOrigin = Deno.env.get('APP_ORIGIN') || 'https://rmpl.lovable.app';

    if (error) {
      console.error('Microsoft OAuth error:', error, errorDescription);
      return Response.redirect(
        `${appOrigin}/auth/microsoft/callback?error=${encodeURIComponent(errorDescription || error)}`,
        302
      );
    }

    if (!code || !stateParam) {
      return Response.redirect(
        `${appOrigin}/auth/microsoft/callback?error=${encodeURIComponent('Missing code or state')}`,
        302
      );
    }

    // Decode state
    let state: { user_id: string; redirect_path: string };
    try {
      state = JSON.parse(atob(stateParam));
    } catch {
      return Response.redirect(
        `${appOrigin}/auth/microsoft/callback?error=${encodeURIComponent('Invalid state parameter')}`,
        302
      );
    }

    const clientId = Deno.env.get('MICROSOFT_CLIENT_ID')!;
    const clientSecret = Deno.env.get('MICROSOFT_CLIENT_SECRET')!;
    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/microsoft-auth-callback`;

    // Exchange code for tokens
    const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        scope: 'openid profile email Mail.Send Mail.ReadWrite User.Read offline_access',
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('Token exchange error:', tokenData);
      return Response.redirect(
        `${appOrigin}/auth/microsoft/callback?error=${encodeURIComponent(tokenData.error_description || tokenData.error)}`,
        302
      );
    }

    // Fetch user profile from Microsoft Graph
    const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profileData = await profileResponse.json();
    const microsoftEmail = profileData.mail || profileData.userPrincipalName || '';

    // Calculate expiry
    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();

    // Upsert tokens using service client
    const supabase = createServiceClient();
    const { error: upsertError } = await supabase
      .from('user_oauth_tokens')
      .upsert(
        {
          user_id: state.user_id,
          provider: 'microsoft',
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_type: tokenData.token_type || 'Bearer',
          scope: tokenData.scope || '',
          expires_at: expiresAt,
          microsoft_email: microsoftEmail,
        },
        { onConflict: 'user_id,provider' }
      );

    if (upsertError) {
      console.error('Upsert error:', upsertError);
      return Response.redirect(
        `${appOrigin}/auth/microsoft/callback?error=${encodeURIComponent('Failed to save tokens')}`,
        302
      );
    }

    // Redirect back to app with success
    return Response.redirect(
      `${appOrigin}/auth/microsoft/callback?success=true&redirect_path=${encodeURIComponent(state.redirect_path)}`,
      302
    );
  } catch (err) {
    console.error('microsoft-auth-callback error:', err);
    const appOrigin = Deno.env.get('APP_ORIGIN') || 'https://rmpl.lovable.app';
    return Response.redirect(
      `${appOrigin}/auth/microsoft/callback?error=${encodeURIComponent('Internal server error')}`,
      302
    );
  }
});
