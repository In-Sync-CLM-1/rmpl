import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Mail, Link, Unlink, Loader2 } from "lucide-react";

interface OutlookConnection {
  id: string;
  microsoft_email: string;
  expires_at: string;
}

export function OutlookConnectionManager() {
  const [connection, setConnection] = useState<OutlookConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    fetchConnection();
  }, []);

  const fetchConnection = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_oauth_tokens')
        .select('id, microsoft_email, expires_at')
        .eq('user_id', user.id)
        .eq('provider', 'microsoft')
        .maybeSingle();

      if (error) throw error;
      setConnection(data);
    } catch (err) {
      console.error('Error fetching Outlook connection:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      // Force a session refresh to get a fresh access token
      const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !session?.access_token) {
        toast.error('Session expired — please log in again');
        setConnecting(false);
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/microsoft-auth-url`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ redirect_path: '/my-profile' }),
        }
      );

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || `Function returned ${response.status}`);
      }

      const data = await response.json();
      if (data?.auth_url) {
        window.location.href = data.auth_url;
      }
    } catch (err: any) {
      console.error('Error getting auth URL:', err);
      toast.error(err.message || 'Failed to start Outlook connection');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!connection) return;
    setDisconnecting(true);
    try {
      const { error } = await supabase
        .from('user_oauth_tokens')
        .delete()
        .eq('id', connection.id);

      if (error) throw error;
      setConnection(null);
      toast.success('Outlook disconnected');
    } catch (err: any) {
      toast.error('Failed to disconnect Outlook');
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking Outlook connection...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Mail className="h-4 w-4" />
        <span className="font-medium text-sm">Microsoft Outlook</span>
        {connection ? (
          <Badge variant="default" className="text-xs">Connected</Badge>
        ) : (
          <Badge variant="secondary" className="text-xs">Not Connected</Badge>
        )}
      </div>

      {connection ? (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{connection.microsoft_email}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDisconnect}
            disabled={disconnecting}
          >
            {disconnecting ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Unlink className="h-3 w-3 mr-1" />
            )}
            Disconnect
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Connect your Microsoft account to send emails directly from your Outlook mailbox.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleConnect}
            disabled={connecting}
          >
            {connecting ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Link className="h-3 w-3 mr-1" />
            )}
            Connect Outlook
          </Button>
        </div>
      )}
    </div>
  );
}
