export async function refreshAccessToken(
  refreshToken: string
): Promise<{ access_token: string; refresh_token?: string; expires_in: number } | null> {
  const clientId = Deno.env.get('MICROSOFT_CLIENT_ID')!;
  const clientSecret = Deno.env.get('MICROSOFT_CLIENT_SECRET')!;

  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: 'openid profile email Mail.Send Mail.ReadWrite User.Read offline_access',
    }),
  });

  const data = await response.json();
  if (data.error) {
    console.error('Token refresh failed:', data);
    return null;
  }
  return data;
}

export async function getValidAccessToken(
  supabase: any,
  userId: string
): Promise<{ accessToken: string; tokenRowId: string } | null> {
  const { data: tokenRow, error } = await supabase
    .from('user_oauth_tokens')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'microsoft')
    .maybeSingle();

  if (error || !tokenRow) return null;

  let accessToken = tokenRow.access_token;

  // Refresh if expired or expiring within 2 minutes
  const expiresAt = new Date(tokenRow.expires_at);
  const buffer = 2 * 60 * 1000;
  if (expiresAt.getTime() - buffer <= Date.now()) {
    const refreshed = await refreshAccessToken(tokenRow.refresh_token);
    if (!refreshed) {
      // Token revoked — clean up
      await supabase.from('user_oauth_tokens').delete().eq('id', tokenRow.id);
      return null;
    }

    accessToken = refreshed.access_token;
    const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

    await supabase
      .from('user_oauth_tokens')
      .update({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token || tokenRow.refresh_token,
        expires_at: newExpiry,
      })
      .eq('id', tokenRow.id);
  }

  return { accessToken, tokenRowId: tokenRow.id };
}
