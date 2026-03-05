import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { Search, MessageSquare, Ban, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { PaginationControls } from "@/components/ui/pagination-controls";

interface InboundSMS {
  id: string;
  from_number: string;
  to_number: string;
  message_text: string;
  message_uuid: string | null;
  campaign_id: string | null;
  demandcom_id: string | null;
  is_opt_out: boolean;
  received_at: string;
  demandcom?: {
    first_name: string;
    last_name: string;
    email: string;
  };
  campaigns?: {
    name: string;
  };
}

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

export default function Inbox() {
  const [smsMessages, setSmsMessages] = useState<InboundSMS[]>([]);
  const [emailMessages, setEmailMessages] = useState<EmailMessage[]>([]);
  const [filteredSms, setFilteredSms] = useState<InboundSMS[]>([]);
  const [filteredEmail, setFilteredEmail] = useState<EmailMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [smsPage, setSmsPage] = useState(1);
  const [smsPerPage, setSmsPerPage] = useState(25);
  const [smsTotalCount, setSmsTotalCount] = useState(0);
  const [emailPage, setEmailPage] = useState(1);
  const [emailPerPage, setEmailPerPage] = useState(25);
  const [emailTotalCount, setEmailTotalCount] = useState(0);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchMessages();
    setupRealtimeSubscription();
  }, [smsPage, smsPerPage, emailPage, emailPerPage]);

  useEffect(() => {
    filterMessages();
  }, [searchQuery, smsMessages, emailMessages]);

  const fetchMessages = async () => {
    try {
      const smsFrom = (smsPage - 1) * smsPerPage;
      const smsTo = smsFrom + smsPerPage - 1;
      const emailFrom = (emailPage - 1) * emailPerPage;
      const emailTo = emailFrom + emailPerPage - 1;

      const [smsResult, smsCountResult, emailResult, emailCountResult] = await Promise.all([
        supabase
          .from("inbound_sms")
          .select(
            `
            *,
            demandcom (
              first_name,
              last_name,
              email
            ),
            campaigns (
              name
            )
          `
          )
          .order("received_at", { ascending: false })
          .range(smsFrom, smsTo),
        supabase
          .from("inbound_sms")
          .select("*", { count: "exact", head: true }),
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

      if (smsResult.error) throw smsResult.error;
      if (smsCountResult.error) throw smsCountResult.error;
      if (emailResult.error) throw emailResult.error;
      if (emailCountResult.error) throw emailCountResult.error;

      setSmsMessages((smsResult.data || []) as any);
      setSmsTotalCount(smsCountResult.count || 0);
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

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel("inbox_changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "inbound_sms",
        },
        (payload) => {
          console.log("New inbound SMS received:", payload);
          fetchMessages();
          toast({
            title: "New SMS",
            description: `Received SMS from ${payload.new.from_number}`,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const filterMessages = () => {
    if (!searchQuery.trim()) {
      setFilteredSms(smsMessages);
      setFilteredEmail(emailMessages);
      return;
    }

    const query = searchQuery.toLowerCase();
    
    const filteredSmsData = smsMessages.filter(
      (msg) =>
        msg.from_number.includes(query) ||
        msg.message_text.toLowerCase().includes(query) ||
        msg.demandcom?.first_name?.toLowerCase().includes(query) ||
        msg.demandcom?.last_name?.toLowerCase().includes(query) ||
        msg.campaigns?.name?.toLowerCase().includes(query)
    );

    const filteredEmailData = emailMessages.filter(
      (msg) =>
        msg.demandcom?.first_name?.toLowerCase().includes(query) ||
        msg.demandcom?.last_name?.toLowerCase().includes(query) ||
        msg.demandcom?.email?.toLowerCase().includes(query) ||
        msg.campaigns?.name?.toLowerCase().includes(query) ||
        msg.campaigns?.subject?.toLowerCase().includes(query)
    );

    setFilteredSms(filteredSmsData);
    setFilteredEmail(filteredEmailData);
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

      <Tabs defaultValue="sms" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="sms" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            SMS ({filteredSms.length})
          </TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email ({filteredEmail.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sms" className="mt-6">
          <div className="grid gap-4">
            {filteredSms.length === 0 ? (
              <Card className="p-12 text-center">
                <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No SMS messages found</h3>
                <p className="text-muted-foreground">
                  {searchQuery
                    ? "Try adjusting your search query"
                    : "Inbound SMS replies will appear here"}
                </p>
              </Card>
            ) : (
              filteredSms.map((message) => (
                <Card key={message.id} className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg">
                          {message.demandcom ? (
                            <Button
                              variant="link"
                              className="p-0 h-auto font-semibold text-lg"
                              onClick={() =>
                                handleParticipantClick(message.demandcom_id!)
                              }
                            >
                              {message.demandcom.first_name}{" "}
                              {message.demandcom.last_name}
                            </Button>
                          ) : (
                            message.from_number
                          )}
                        </h3>
                        {message.is_opt_out && (
                          <Badge variant="destructive" className="flex items-center gap-1">
                            <Ban className="h-3 w-3" />
                            Opt-Out
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                        <span>{message.from_number}</span>
                        <span>•</span>
                        <span>
                          {format(
                            new Date(message.received_at),
                            "MMM dd, yyyy 'at' h:mm a"
                          )}
                        </span>
                      </div>
                      {message.campaigns && (
                        <Badge variant="outline" className="mb-3">
                          {message.campaigns.name}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <ScrollArea className="max-h-32">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {message.message_text}
                    </p>
                  </ScrollArea>

                  {message.demandcom && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm text-muted-foreground">
                        DemandCom Email: {message.demandcom.email}
                      </p>
                    </div>
                  )}
                </Card>
              ))
            )}
          </div>

          {filteredSms.length > 0 && (
            <PaginationControls
              currentPage={smsPage}
              totalPages={Math.ceil(smsTotalCount / smsPerPage)}
              totalItems={smsTotalCount}
              itemsPerPage={smsPerPage}
              onPageChange={setSmsPage}
              onItemsPerPageChange={(newItemsPerPage) => {
                setSmsPerPage(newItemsPerPage);
                setSmsPage(1);
              }}
            />
          )}
        </TabsContent>

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
