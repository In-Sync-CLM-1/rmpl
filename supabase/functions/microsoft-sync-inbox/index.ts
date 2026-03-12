import { corsHeaders, handleCorsPreflightRequest } from '../_shared/cors-headers.ts';
import { createServiceClient } from '../_shared/supabase-client.ts';
import { successResponse, errorResponse } from '../_shared/response-helpers.ts';
import { getValidAccessToken } from '../_shared/microsoft-token.ts';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const MAX_PAGES = 4;
const PAGE_SIZE = 50;

interface GraphMessage {
  id: string;
  conversationId?: string;
  from?: { emailAddress: { address: string; name?: string } };
  toRecipients?: Array<{ emailAddress: { address: string } }>;
  ccRecipients?: Array<{ emailAddress: { address: string } }>;
  subject?: string;
  bodyPreview?: string;
  hasAttachments?: boolean;
  isRead?: boolean;
  receivedDateTime?: string;
}

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

async function fetchInboxMessages(
  accessToken: string,
  sinceDateTime?: string
): Promise<GraphMessage[]> {
  const select = 'id,conversationId,from,toRecipients,ccRecipients,subject,bodyPreview,hasAttachments,isRead,receivedDateTime';

  let filter = '';
  if (sinceDateTime) {
    filter = `&$filter=receivedDateTime ge ${sinceDateTime}`;
  } else {
    // First sync: last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    filter = `&$filter=receivedDateTime ge ${thirtyDaysAgo}`;
  }

  let url: string | null = `${GRAPH_BASE}/me/mailFolders/inbox/messages?$top=${PAGE_SIZE}&$orderby=receivedDateTime desc&$select=${select}${filter}`;
  const allMessages: GraphMessage[] = [];
  let pages = 0;

  while (url && pages < MAX_PAGES) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Graph API error ${response.status}:`, errText.substring(0, 500));
      if (response.status === 401) throw new Error('TOKEN_EXPIRED');
      throw new Error(`Graph API ${response.status}`);
    }

    const data = await response.json();
    const messages = data.value || [];
    allMessages.push(...messages);

    url = data['@odata.nextLink'] || null;
    pages++;
  }

  return allMessages;
}

async function matchContactsByEmail(supabase: any, emails: string[]): Promise<Map<string, string>> {
  if (emails.length === 0) return new Map();

  const lowerEmails = emails.map(e => e.toLowerCase());
  const { data: contacts } = await supabase
    .from('demandcom')
    .select('id, official, personal_email_id, generic_email_id')
    .or(
      lowerEmails.map(e => `official.ilike.${e},personal_email_id.ilike.${e},generic_email_id.ilike.${e}`).join(',')
    );

  const map = new Map<string, string>();
  if (!contacts) return map;

  for (const contact of contacts) {
    for (const field of ['official', 'personal_email_id', 'generic_email_id']) {
      const email = (contact[field] || '').toLowerCase();
      if (email && lowerEmails.includes(email)) {
        map.set(email, contact.id);
      }
    }
  }
  return map;
}

async function syncUserInbox(supabase: any, userId: string): Promise<{ synced: number; error?: string }> {
  // Get valid access token
  const tokenResult = await getValidAccessToken(supabase, userId);
  if (!tokenResult) {
    await supabase.from('outlook_sync_state').upsert({
      user_id: userId,
      sync_status: 'error',
      error_message: 'Token expired or revoked. Please reconnect Outlook.',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    return { synced: 0, error: 'Token expired' };
  }

  // Get sync state
  const { data: syncState } = await supabase
    .from('outlook_sync_state')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  // Mark as syncing
  await supabase.from('outlook_sync_state').upsert({
    user_id: userId,
    sync_status: 'syncing',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });

  try {
    const messages = await fetchInboxMessages(
      tokenResult.accessToken,
      syncState?.last_received_datetime || undefined
    );

    if (messages.length === 0) {
      await supabase.from('outlook_sync_state').upsert({
        user_id: userId,
        sync_status: 'idle',
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      return { synced: 0 };
    }

    // Collect unique sender emails for contact matching
    const senderEmails = [...new Set(
      messages
        .map(m => m.from?.emailAddress?.address?.toLowerCase())
        .filter(Boolean) as string[]
    )];
    const contactMap = await matchContactsByEmail(supabase, senderEmails);

    // Prepare rows for upsert
    const rows = messages.map(msg => ({
      user_id: userId,
      microsoft_message_id: msg.id,
      conversation_id: msg.conversationId || null,
      from_email: msg.from?.emailAddress?.address || 'unknown',
      from_name: msg.from?.emailAddress?.name || null,
      to_emails: (msg.toRecipients || []).map(r => r.emailAddress.address),
      cc_emails: (msg.ccRecipients || []).map(r => r.emailAddress.address),
      subject: msg.subject || null,
      body_preview: msg.bodyPreview || null,
      has_attachments: msg.hasAttachments || false,
      is_read: msg.isRead || false,
      received_at: msg.receivedDateTime || new Date().toISOString(),
      demandcom_id: contactMap.get(msg.from?.emailAddress?.address?.toLowerCase() || '') || null,
      folder: 'inbox',
      synced_at: new Date().toISOString(),
    }));

    // Upsert in batches of 50
    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50);
      const { error: upsertError } = await supabase
        .from('outlook_emails')
        .upsert(batch, { onConflict: 'user_id,microsoft_message_id' });
      if (upsertError) {
        console.error('Upsert error:', upsertError);
      }
    }

    // Update sync state with newest received datetime
    const newestDate = messages
      .map(m => m.receivedDateTime)
      .filter(Boolean)
      .sort()
      .pop();

    await supabase.from('outlook_sync_state').upsert({
      user_id: userId,
      sync_status: 'idle',
      last_sync_at: new Date().toISOString(),
      last_received_datetime: newestDate || syncState?.last_received_datetime || null,
      error_message: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    return { synced: rows.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await supabase.from('outlook_sync_state').upsert({
      user_id: userId,
      sync_status: 'error',
      error_message: message,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    return { synced: 0, error: message };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsPreflightRequest();

  try {
    const supabase = createServiceClient();

    // Check if this is a user-triggered sync or a scheduled sync
    const authHeader = req.headers.get('Authorization');
    const userId = getUserIdFromJwt(authHeader);

    if (userId) {
      // User-triggered: sync just this user
      const result = await syncUserInbox(supabase, userId);
      if (result.error) {
        return errorResponse(result.error, 400);
      }
      return successResponse({ synced: result.synced });
    }

    // Scheduled sync: iterate users with connected Outlook
    // Process up to 10 users, prioritizing least recently synced
    const { data: tokenUsers } = await supabase
      .from('user_oauth_tokens')
      .select('user_id')
      .eq('provider', 'microsoft');

    if (!tokenUsers?.length) {
      return successResponse({ message: 'No connected users', synced: 0 });
    }

    const userIds = tokenUsers.map((t: any) => t.user_id);

    // Get sync states to prioritize
    const { data: syncStates } = await supabase
      .from('outlook_sync_state')
      .select('user_id, last_sync_at')
      .in('user_id', userIds)
      .order('last_sync_at', { ascending: true, nullsFirst: true });

    // Sort: users without sync state first, then oldest sync first
    const syncedMap = new Map((syncStates || []).map((s: any) => [s.user_id, s.last_sync_at]));
    const sortedUserIds = userIds.sort((a: string, b: string) => {
      const aTime = syncedMap.get(a) || '1970-01-01';
      const bTime = syncedMap.get(b) || '1970-01-01';
      return aTime < bTime ? -1 : 1;
    });

    let totalSynced = 0;
    const limit = Math.min(sortedUserIds.length, 10);
    for (let i = 0; i < limit; i++) {
      const result = await syncUserInbox(supabase, sortedUserIds[i]);
      totalSynced += result.synced;
    }

    return successResponse({ users_processed: limit, total_synced: totalSynced });
  } catch (err) {
    console.error('microsoft-sync-inbox error:', err);
    return errorResponse(err instanceof Error ? err.message : 'Internal error', 500);
  }
});
