import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { Search, Mail, Loader2, RefreshCw, User, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { PaginationControls } from "@/components/ui/pagination-controls";

interface EmailMessage {
  id: string;
  campaign_id: string;
  demandcom_id: string;
  status: string;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  error_message: string | null;
  demandcom: {
    first_name: string;
    last_name: string;
    email: string;
  };
  campaigns: {
    name: string;
    subject: string | null;
  };
}

interface OutlookEmail {
  id: string;
  microsoft_message_id: string;
  conversation_id: string | null;
  from_email: string;
  from_name: string | null;
  to_emails: string[];
  cc_emails: string[] | null;
  subject: string | null;
  body_preview: string | null;
  has_attachments: boolean;
  is_read: boolean;
  received_at: string;
  demandcom_id: string | null;
  folder: string;
  demandcom?: {
    first_name: string;
    last_name: string;
    official: string;
  } | null;
}

export default function Inbox() {
  const [emailMessages, setEmailMessages] = useState<EmailMessage[]>([]);
  const [outlookEmails, setOutlookEmails] = useState<OutlookEmail[]>([]);
  const [filteredEmail, setFilteredEmail] = useState<EmailMessage[]>([]);
  const [filteredOutlook, setFilteredOutlook] = useState<OutlookEmail[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [outlookConnected, setOutlookConnected] = useState(false);
  const [emailPage, setEmailPage] = useState(1);
  const [emailPerPage, setEmailPerPage] = useState(25);
  const [emailTotalCount, setEmailTotalCount] = useState(0);
  const [outlookPage, setOutlookPage] = useState(1);
  const [outlookPerPage, setOutlookPerPage] = useState(25);
  const [outlookTotalCount, setOutlookTotalCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    initUser();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      fetchMessages();
      fetchOutlookEmails();
    }
  }, [currentUserId, emailPage, emailPerPage, outlookPage, outlookPerPage]);

  useEffect(() => {
    filterMessages();
  }, [searchQuery, emailMessages, outlookEmails]);

  const initUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
      setCurrentUserId(session.user.id);
      // Check if user has Outlook connected
      const { data } = await supabase
        .from('user_oauth_tokens')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('provider', 'microsoft')
        .maybeSingle();
      setOutlookConnected(!!data);

      // Get last sync time
      const { data: syncState } = await (supabase
        .from('outlook_sync_state' as any)
        .select('last_sync_at')
        .eq('user_id', session.user.id)
        .maybeSingle());
      if (syncState?.last_sync_at) setLastSyncAt(syncState.last_sync_at);
    }
  };

  const fetchMessages = async () => {
    try {
      const emailFrom = (emailPage - 1) * emailPerPage;
      const emailTo = emailFrom + emailPerPage - 1;

      const [emailResult, emailCountResult] = await Promise.all([
        supabase
          .from("campaign_recipients")
          .select(
            `
            *,
            demandcom (
              first_name,
              last_name,
              email
            ),
            campaigns!inner (
              name,
              subject,
              type
            )
          `
          )
          .eq("campaigns.type", "email")
          .not("opened_at", "is", null)
          .order("opened_at", { ascending: false })
          .range(emailFrom, emailTo),
        supabase
          .from("campaign_recipients")
          .select("*", { count: "exact", head: true })
          .eq("campaigns.type", "email")
          .not("opened_at", "is", null)
      ]);

      if (emailResult.error) throw emailResult.error;
      if (emailCountResult.error) throw emailCountResult.error;

      setEmailMessages((emailResult.data || []) as any);
      setEmailTotalCount(emailCountResult.count || 0);
    } catch (error) {
      console.error("Error fetching messages:", error);
      toast({
        title: "Error",
        description: "Failed to load messages",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOutlookEmails = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const from = (outlookPage - 1) * outlookPerPage;
      const to = from + outlookPerPage - 1;

      const [dataResult, countResult] = await Promise.all([
        supabase
          .from('outlook_emails' as any)
          .select('*, demandcom:demandcom_id(first_name, last_name, official)')
          .eq('user_id', currentUserId)
          .order('received_at', { ascending: false })
          .range(from, to),
        supabase
          .from('outlook_emails' as any)
          .select('*', { count: 'exact', head: true })
          .eq('user_id', currentUserId),
      ]);

      if (dataResult.data) setOutlookEmails(dataResult.data as any);
      setOutlookTotalCount(countResult.count || 0);
    } catch (error) {
      console.error('Error fetching outlook emails:', error);
    }
  }, [currentUserId, outlookPage, outlookPerPage]);

  const triggerSync = async () => {
    setIsSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.refreshSession();
      if (!session?.access_token) {
        toast({ title: "Error", description: "Session expired, please log in again", variant: "destructive" });
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/microsoft-sync-inbox`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({}),
        }
      );

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || `Sync failed (${response.status})`);
      }

      const result = await response.json();
      setLastSyncAt(new Date().toISOString());
      await fetchOutlookEmails();

      if (result.synced > 0) {
        toast({ title: "Sync complete", description: `${result.synced} new emails synced` });
      } else {
        toast({ title: "Sync complete", description: "No new emails" });
      }
    } catch (err: any) {
      console.error('Sync error:', err);
      toast({ title: "Sync failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
  };

  const filterMessages = () => {
    if (!searchQuery.trim()) {
      setFilteredEmail(emailMessages);
      setFilteredOutlook(outlookEmails);
      return;
    }

    const query = searchQuery.toLowerCase();

    setFilteredEmail(emailMessages.filter(
      (msg) =>
        msg.demandcom?.first_name?.toLowerCase().includes(query) ||
        msg.demandcom?.last_name?.toLowerCase().includes(query) ||
        msg.demandcom?.email?.toLowerCase().includes(query) ||
        msg.campaigns?.name?.toLowerCase().includes(query) ||
        msg.campaigns?.subject?.toLowerCase().includes(query)
    ));

    setFilteredOutlook(outlookEmails.filter(
      (msg) =>
        msg.from_email?.toLowerCase().includes(query) ||
        msg.from_name?.toLowerCase().includes(query) ||
        msg.subject?.toLowerCase().includes(query) ||
        msg.body_preview?.toLowerCase().includes(query) ||
        msg.demandcom?.first_name?.toLowerCase().includes(query) ||
        msg.demandcom?.last_name?.toLowerCase().includes(query)
    ));
  };

  const handleParticipantClick = (demandComId: string) => {
    navigate(`/demandcom/${demandComId}`);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Inbox</h1>
        <p className="text-muted-foreground">
          View and manage incoming messages from participants
        </p>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            type="text"
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Tabs defaultValue="outlook" className="w-full">
        <TabsList className="grid w-full max-w-lg grid-cols-2">
          <TabsTrigger value="outlook" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Outlook ({outlookTotalCount})
          </TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Campaigns ({filteredEmail.length})
          </TabsTrigger>
        </TabsList>

        {/* Outlook Tab */}
        <TabsContent value="outlook" className="mt-6">
          {/* Sync controls */}
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-muted-foreground">
              {lastSyncAt ? (
                <>Last synced: {format(new Date(lastSyncAt), "MMM d, h:mm a")}</>
              ) : (
                "Not synced yet"
              )}
            </div>
            {outlookConnected ? (
              <Button variant="outline" size="sm" onClick={triggerSync} disabled={isSyncing}>
                {isSyncing ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Syncing...</>
                ) : (
                  <><RefreshCw className="h-4 w-4 mr-2" />Sync Now</>
                )}
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => navigate('/my-profile')}>
                Connect Outlook
              </Button>
            )}
          </div>

          <div className="grid gap-3">
            {!outlookConnected && outlookTotalCount === 0 ? (
              <Card className="p-12 text-center">
                <Mail className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Connect your Outlook</h3>
                <p className="text-muted-foreground mb-4">
                  Connect your Microsoft Outlook account to sync incoming emails
                </p>
                <Button onClick={() => navigate('/my-profile')}>
                  Go to Profile to Connect
                </Button>
              </Card>
            ) : filteredOutlook.length === 0 ? (
              <Card className="p-12 text-center">
                <Mail className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  {searchQuery ? "No matching emails" : "No emails yet"}
                </h3>
                <p className="text-muted-foreground">
                  {searchQuery
                    ? "Try adjusting your search query"
                    : "Click 'Sync Now' to pull emails from your Outlook inbox"}
                </p>
              </Card>
            ) : (
              filteredOutlook.map((email) => (
                <Card
                  key={email.id}
                  className={`p-4 transition-colors ${!email.is_read ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        email.demandcom_id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}>
                        {(email.from_name || email.from_email).charAt(0).toUpperCase()}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`font-medium text-sm truncate ${!email.is_read ? 'font-bold' : ''}`}>
                          {email.from_name || email.from_email}
                        </span>
                        {!email.is_read && (
                          <div className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
                        )}
                        {email.has_attachments && (
                          <Paperclip className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        )}
                        {email.demandcom_id && email.demandcom && (
                          <Badge
                            variant="outline"
                            className="text-xs cursor-pointer hover:bg-accent"
                            onClick={() => handleParticipantClick(email.demandcom_id!)}
                          >
                            <User className="h-3 w-3 mr-1" />
                            {email.demandcom.first_name} {email.demandcom.last_name}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">
                          {format(new Date(email.received_at), "MMM d, h:mm a")}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mb-1">{email.from_email}</div>
                      <div className={`text-sm truncate ${!email.is_read ? 'font-semibold' : ''}`}>
                        {email.subject || "(No subject)"}
                      </div>
                      {email.body_preview && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {email.body_preview}
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>

          {filteredOutlook.length > 0 && (
            <PaginationControls
              currentPage={outlookPage}
              totalPages={Math.ceil(outlookTotalCount / outlookPerPage)}
              totalItems={outlookTotalCount}
              itemsPerPage={outlookPerPage}
              onPageChange={setOutlookPage}
              onItemsPerPageChange={(v) => { setOutlookPerPage(v); setOutlookPage(1); }}
            />
          )}
        </TabsContent>

        {/* Campaign Email Tab */}
        <TabsContent value="email" className="mt-6">
          <div className="grid gap-4">
            {filteredEmail.length === 0 ? (
              <Card className="p-12 text-center">
                <Mail className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No email interactions found</h3>
                <p className="text-muted-foreground">
                  {searchQuery
                    ? "Try adjusting your search query"
                    : "Email opens and clicks will appear here"}
                </p>
              </Card>
            ) : (
              filteredEmail.map((message) => (
                <Card key={message.id} className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg">
                          <Button
                            variant="link"
                            className="p-0 h-auto font-semibold text-lg"
                            onClick={() => handleParticipantClick(message.demandcom_id)}
                          >
                            {message.demandcom.first_name}{" "}
                            {message.demandcom.last_name}
                          </Button>
                        </h3>
                        <Badge variant="default">{message.status}</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                        <span>{message.demandcom.email}</span>
                        <span>•</span>
                        <span>
                          {message.opened_at &&
                            format(
                              new Date(message.opened_at),
                              "MMM dd, yyyy 'at' h:mm a"
                            )}
                        </span>
                      </div>
                      <Badge variant="outline" className="mb-3">
                        {message.campaigns.name}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <span className="text-sm font-medium">Subject: </span>
                      <span className="text-sm text-muted-foreground">
                        {message.campaigns.subject || "No subject"}
                      </span>
                    </div>
                    <div className="flex gap-6 text-sm">
                      {message.sent_at && (
                        <div>
                          <span className="font-medium">Sent: </span>
                          <span className="text-muted-foreground">
                            {format(new Date(message.sent_at), "MMM dd, h:mm a")}
                          </span>
                        </div>
                      )}
                      {message.delivered_at && (
                        <div>
                          <span className="font-medium">Delivered: </span>
                          <span className="text-muted-foreground">
                            {format(new Date(message.delivered_at), "MMM dd, h:mm a")}
                          </span>
                        </div>
                      )}
                      {message.clicked_at && (
                        <div>
                          <span className="font-medium">Clicked: </span>
                          <span className="text-muted-foreground">
                            {format(new Date(message.clicked_at), "MMM dd, h:mm a")}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {message.error_message && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm text-destructive">
                        Error: {message.error_message}
                      </p>
                    </div>
                  )}
                </Card>
              ))
            )}
          </div>

          {filteredEmail.length > 0 && (
            <PaginationControls
              currentPage={emailPage}
              totalPages={Math.ceil(emailTotalCount / emailPerPage)}
              totalItems={emailTotalCount}
              itemsPerPage={emailPerPage}
              onPageChange={setEmailPage}
              onItemsPerPageChange={(newItemsPerPage) => {
                setEmailPerPage(newItemsPerPage);
                setEmailPage(1);
              }}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
