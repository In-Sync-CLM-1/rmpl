import { corsHeaders, handleCorsPreflightRequest } from '../_shared/cors-headers.ts';
import { verifyAuth } from '../_shared/auth-helpers.ts';
import { createServiceClient } from '../_shared/supabase-client.ts';
import { successResponse, errorResponse, unauthorizedResponse } from '../_shared/response-helpers.ts';

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; refresh_token?: string; expires_in: number } | null> {
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

function replaceMergeTags(text: string, mergeData: Record<string, string>): string {
  if (!text || !mergeData) return text;
  let result = text;
  for (const [key, value] of Object.entries(mergeData)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '');
  }
  return result;
}

function buildRecipients(emails: string[]): Array<{ emailAddress: { address: string } }> {
  return emails
    .filter(e => e && e.trim())
    .map(e => ({ emailAddress: { address: e.trim() } }));
}

async function sendViaGraph(
  accessToken: string,
  params: {
    to_email: string;
    to_name?: string;
    subject: string;
    html_body: string;
    cc_emails?: string[];
    bcc_emails?: string[];
    attachments?: Array<{ name: string; content_base64: string; content_type: string }>;
  }
): Promise<Response> {
  const message: any = {
    subject: params.subject,
    body: { contentType: 'HTML', content: params.html_body },
    toRecipients: [{ emailAddress: { address: params.to_email, name: params.to_name || params.to_email } }],
  };

  if (params.cc_emails?.length) {
    message.ccRecipients = buildRecipients(params.cc_emails);
  }
  if (params.bcc_emails?.length) {
    message.bccRecipients = buildRecipients(params.bcc_emails);
  }
  if (params.attachments?.length) {
    message.attachments = params.attachments.map(a => ({
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: a.name,
      contentType: a.content_type,
      contentBytes: a.content_base64,
    }));
  }

  return await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, saveToSentItems: true }),
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsPreflightRequest();

  try {
    const authHeader = req.headers.get('Authorization');
    const { authenticated, user, error: authError } = await verifyAuth(authHeader);
    if (!authenticated || !user) return unauthorizedResponse(authError || 'Unauthorized');

    const {
      to_email, to_name, subject, html_body,
      cc_emails, bcc_emails, attachments,
      demandcom_id, template_id, merge_data,
    } = await req.json();

    if (!to_email || !subject || !html_body) {
      return errorResponse('to_email, subject, and html_body are required');
    }

    const supabase = createServiceClient();

    // Fetch user's tokens
    const { data: tokenRow, error: tokenError } = await supabase
      .from('user_oauth_tokens')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'microsoft')
      .maybeSingle();

    if (tokenError || !tokenRow) {
      return errorResponse('Outlook not connected. Please connect your Microsoft account first.', 403);
    }

    let accessToken = tokenRow.access_token;
    let refreshToken = tokenRow.refresh_token;

    // Check if token expired, refresh if needed
    if (new Date(tokenRow.expires_at) <= new Date()) {
      const refreshed = await refreshAccessToken(refreshToken);
      if (!refreshed) {
        // Mark token invalid
        await supabase
          .from('user_oauth_tokens')
          .delete()
          .eq('id', tokenRow.id);

        return errorResponse('Microsoft token expired. Please reconnect your Outlook account.', 401);
      }

      accessToken = refreshed.access_token;
      const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

      await supabase
        .from('user_oauth_tokens')
        .update({
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token || refreshToken,
          expires_at: newExpiry,
        })
        .eq('id', tokenRow.id);
    }

    // Process merge tags
    const processedSubject = replaceMergeTags(subject, merge_data || {});
    const processedBody = replaceMergeTags(html_body, merge_data || {});

    // Inject tracking pixel if we have a tracking endpoint
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    let finalBody = processedBody;
    // We'll skip tracking pixel for now as it requires email_activity_log ID

    // Send email
    let graphResponse = await sendViaGraph(accessToken, {
      to_email, to_name, subject: processedSubject,
      html_body: finalBody, cc_emails, bcc_emails, attachments,
    });

    // If 401, try one token refresh
    if (graphResponse.status === 401) {
      const refreshed = await refreshAccessToken(refreshToken);
      if (refreshed) {
        accessToken = refreshed.access_token;
        const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
        await supabase
          .from('user_oauth_tokens')
          .update({
            access_token: refreshed.access_token,
            refresh_token: refreshed.refresh_token || refreshToken,
            expires_at: newExpiry,
          })
          .eq('id', tokenRow.id);

        graphResponse = await sendViaGraph(accessToken, {
          to_email, to_name, subject: processedSubject,
          html_body: finalBody, cc_emails, bcc_emails, attachments,
        });
      }
    }

    const status = graphResponse.status === 202 ? 'sent' : 'failed';
    let errorMessage: string | null = null;
    if (status === 'failed') {
      const errBody = await graphResponse.text();
      console.error('Graph API error:', graphResponse.status, errBody);
      errorMessage = `Graph API ${graphResponse.status}: ${errBody.substring(0, 500)}`;
    }

    // Log to email_activity_log
    await supabase.from('email_activity_log').insert({
      sent_by: user.id,
      provider: 'microsoft',
      from_email: tokenRow.microsoft_email,
      to_email,
      cc_emails: cc_emails || null,
      bcc_emails: bcc_emails || null,
      subject: processedSubject,
      demandcom_id: demandcom_id || null,
      template_id: template_id || null,
      has_attachments: (attachments?.length || 0) > 0,
      status,
      error_message: errorMessage,
    });

    if (status === 'failed') {
      if (graphResponse.status === 401) {
        await supabase.from('user_oauth_tokens').delete().eq('id', tokenRow.id);
        return errorResponse('Microsoft token revoked. Please reconnect your Outlook account.', 401);
      }
      return errorResponse(errorMessage || 'Failed to send email', 500);
    }

    return successResponse({ success: true, from_email: tokenRow.microsoft_email });
  } catch (err) {
    console.error('microsoft-send-email error:', err);
    return errorResponse(err instanceof Error ? err.message : 'Internal error', 500);
  }
});
