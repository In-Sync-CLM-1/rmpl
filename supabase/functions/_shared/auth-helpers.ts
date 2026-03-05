import { createAuthenticatedClient } from './supabase-client.ts';

export async function verifyAuth(authHeader: string | null) {
  if (!authHeader) {
    return { authenticated: false, user: null, error: 'No authorization header' };
  }

  try {
    const supabase = createAuthenticatedClient(authHeader);
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return { authenticated: false, user: null, error: error?.message || 'Invalid token' };
    }

    return { authenticated: true, user, error: null };
  } catch (error) {
    return { 
      authenticated: false, 
      user: null, 
      error: error instanceof Error ? error.message : 'Authentication failed' 
    };
  }
}

export async function getUserIdFromAuth(authHeader: string | null): Promise<string | null> {
  const { authenticated, user } = await verifyAuth(authHeader);
  return authenticated ? user!.id : null;
}
