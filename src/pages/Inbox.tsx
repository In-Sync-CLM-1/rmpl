import { useState, useMemo, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Inbox as InboxIcon,
  Mail,
  MessageSquare,
  Search,
  Send,
  Loader2,
  ExternalLink,
  CheckCheck,
  AlertCircle,
  Clock,
  RefreshCw,
} from "lucide-react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { cn } from "@/lib/utils";
import { RefreshDataButton } from "@/components/RefreshDataButton";
import {
  useEmailInbox,
  useEmailInboxUnreadCount,
  useMarkEmailRead,
  useReplyToEmail,
  type EmailInboxRow,
} from "@/hooks/useEmailInbox";
import {
  useWhatsAppThreads,
  useWhatsAppThreadMessages,
  useWhatsAppUnreadCount,
  useMarkWhatsAppRead,
  useSendWhatsAppReply,
  useWhatsAppTemplates,
  type WhatsAppThread,
} from "@/hooks/useWhatsAppInbox";

export default function Inbox() {
  const [tab, setTab] = useState<"email" | "whatsapp">("email");

  return (
    <div className="container mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <InboxIcon className="h-7 w-7" />
            Inbox
          </h1>
          <p className="text-muted-foreground">Email and WhatsApp replies in one place</p>
        </div>
        <RefreshDataButton
          queryKeys={[
            ["email-inbox"],
            ["email-inbox-unread-count"],
            ["whatsapp-threads"],
            ["whatsapp-thread"],
            ["whatsapp-unread-count"],
          ]}
        />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "email" | "whatsapp")}>
        <TabsList>
          <EmailTabTrigger />
          <WhatsAppTabTrigger />
        </TabsList>

        <TabsContent value="email" className="mt-4">
          <EmailInboxView />
        </TabsContent>
        <TabsContent value="whatsapp" className="mt-4">
          <WhatsAppInboxView />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmailTabTrigger() {
  const { data: count = 0 } = useEmailInboxUnreadCount();
  return (
    <TabsTrigger value="email" className="flex gap-2">
      <Mail className="h-4 w-4" />
      Email
      {count > 0 && (
        <Badge variant="destructive" className="h-5 min-w-5 px-1 text-xs">
          {count}
        </Badge>
      )}
    </TabsTrigger>
  );
}

function WhatsAppTabTrigger() {
  const { data: count = 0 } = useWhatsAppUnreadCount();
  return (
    <TabsTrigger value="whatsapp" className="flex gap-2">
      <MessageSquare className="h-4 w-4" />
      WhatsApp
      {count > 0 && (
        <Badge variant="destructive" className="h-5 min-w-5 px-1 text-xs">
          {count}
        </Badge>
      )}
    </TabsTrigger>
  );
}

// ───────────────────────── EMAIL ─────────────────────────

function EmailInboxView() {
  const [search, setSearch] = useState("");
  const [filterUnread, setFilterUnread] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useEmailInbox(search, filterUnread);
  const markRead = useMarkEmailRead();

  const selected = rows.find((r) => r.id === selectedId) || null;

  useEffect(() => {
    if (selected && !selected.is_read) {
      markRead.mutate({ ids: [selected.id], isRead: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-4 h-[calc(100vh-220px)]">
      {/* List */}
      <Card className="flex flex-col overflow-hidden">
        <div className="p-3 border-b space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by subject, body, sender…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center justify-between">
            <Button
              variant={filterUnread ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterUnread(!filterUnread)}
            >
              {filterUnread ? "Showing unread" : "All"}
            </Button>
            <span className="text-xs text-muted-foreground">{rows.length} message{rows.length === 1 ? "" : "s"}</span>
          </div>
        </div>
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              No messages.
            </div>
          ) : (
            <div className="divide-y">
              {rows.map((row) => (
                <EmailRowItem
                  key={row.id}
                  row={row}
                  isSelected={selectedId === row.id}
                  onClick={() => setSelectedId(row.id)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </Card>

      {/* Detail */}
      <Card className="flex flex-col overflow-hidden">
        {selected ? (
          <EmailDetailView row={selected} onMarkUnread={() => markRead.mutate({ ids: [selected.id], isRead: false })} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Select a message to read.
          </div>
        )}
      </Card>
    </div>
  );
}

function EmailRowItem({
  row,
  isSelected,
  onClick,
}: {
  row: EmailInboxRow;
  isSelected: boolean;
  onClick: () => void;
}) {
  const fromDisplay = row.from_name || row.from_address;
  const contactName = row.contact?.name;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left p-3 hover:bg-accent transition-colors",
        isSelected && "bg-accent",
        !row.is_read && "bg-primary/5"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="font-medium text-sm truncate flex-1 flex items-center gap-2">
          {!row.is_read && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
          {fromDisplay}
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {formatDistanceToNowStrict(new Date(row.received_at), { addSuffix: false })}
        </span>
      </div>
      <div className="text-sm font-medium truncate mb-0.5">{row.subject || "(no subject)"}</div>
      <div className="text-xs text-muted-foreground truncate">
        {(row.body_text || row.body_html || "").replace(/<[^>]+>/g, "").slice(0, 100)}
      </div>
      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
        {contactName && (
          <Badge variant="outline" className="text-[10px] h-4 px-1.5">{contactName}</Badge>
        )}
        {!row.email_activity_log_id && (
          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">Untagged</Badge>
        )}
      </div>
    </button>
  );
}

function EmailDetailView({ row, onMarkUnread }: { row: EmailInboxRow; onMarkUnread: () => void }) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [replySubject, setReplySubject] = useState("");
  const reply = useReplyToEmail();

  useEffect(() => {
    setReplyOpen(false);
    setReplyBody("");
    setReplySubject(`Re: ${(row.subject || "").replace(/^Re:\s*/i, "")}`);
  }, [row.id]);

  const handleSendReply = async () => {
    await reply.mutateAsync({
      inboxRow: row,
      bodyHtml: replyBody.replace(/\n/g, "<br/>"),
      subject: replySubject.trim() || `Re: ${row.subject || ""}`,
    });
    setReplyOpen(false);
    setReplyBody("");
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="border-b p-4 space-y-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold truncate">{row.subject || "(no subject)"}</h3>
            <div className="text-sm text-muted-foreground mt-0.5">
              From <span className="font-medium text-foreground">{row.from_name || row.from_address}</span>
              {row.from_name && <span className="text-xs"> &lt;{row.from_address}&gt;</span>}
            </div>
            <div className="text-xs text-muted-foreground">
              {format(new Date(row.received_at), "PPpp")}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={onMarkUnread}>
              Mark unread
            </Button>
            <Button size="sm" onClick={() => setReplyOpen(true)}>
              <Send className="h-3.5 w-3.5 mr-1.5" />
              Reply
            </Button>
          </div>
        </div>
        {row.outbound && (
          <div className="bg-muted/50 rounded-md p-2.5 text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
              <ExternalLink className="h-3 w-3" />
              Reply to:
            </div>
            <div className="text-foreground">
              <span className="font-medium">{row.outbound.subject}</span> — sent to{" "}
              {row.outbound.to_email}
              {row.outbound.sent_at && (
                <span className="text-muted-foreground">
                  {" "}· {format(new Date(row.outbound.sent_at), "PP")}
                </span>
              )}
            </div>
          </div>
        )}
        {!row.email_activity_log_id && (
          <div className="text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/20 rounded-md p-2 flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" />
            Untagged — no matching outbound email. Likely a forwarded or stray message.
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          {row.body_html ? (
            <div
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: row.body_html }}
            />
          ) : (
            <pre className="whitespace-pre-wrap font-sans text-sm">{row.body_text}</pre>
          )}
        </div>
      </ScrollArea>

      {replyOpen && (
        <div className="border-t p-3 space-y-2 bg-muted/20">
          <Input
            value={replySubject}
            onChange={(e) => setReplySubject(e.target.value)}
            placeholder="Subject"
            className="text-sm"
          />
          <Textarea
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            rows={4}
            placeholder={`Reply to ${row.from_name || row.from_address}…`}
            className="text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setReplyOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSendReply} disabled={!replyBody.trim() || reply.isPending}>
              {reply.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Send reply
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ───────────────────────── WHATSAPP ─────────────────────────

function WhatsAppInboxView() {
  const [search, setSearch] = useState("");
  const [selectedThreadKey, setSelectedThreadKey] = useState<string | null>(null);

  const { data: threads = [], isLoading } = useWhatsAppThreads(search);
  const selected = threads.find((t) => t.threadKey === selectedThreadKey) || null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4 h-[calc(100vh-220px)]">
      <Card className="flex flex-col overflow-hidden">
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, message…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : threads.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">No conversations.</div>
          ) : (
            <div className="divide-y">
              {threads.map((t) => (
                <ThreadRow
                  key={t.threadKey}
                  thread={t}
                  isSelected={selectedThreadKey === t.threadKey}
                  onClick={() => setSelectedThreadKey(t.threadKey)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </Card>

      <Card className="flex flex-col overflow-hidden">
        {selected ? (
          <WhatsAppThreadView thread={selected} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Select a conversation.
          </div>
        )}
      </Card>
    </div>
  );
}

function ThreadRow({
  thread,
  isSelected,
  onClick,
}: {
  thread: WhatsAppThread;
  isSelected: boolean;
  onClick: () => void;
}) {
  const display = thread.contactName || thread.phoneNumber;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left p-3 hover:bg-accent transition-colors",
        isSelected && "bg-accent",
        thread.unreadCount > 0 && "bg-primary/5"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="font-medium text-sm truncate flex-1">{display}</div>
        <span className="text-xs text-muted-foreground shrink-0">
          {formatDistanceToNowStrict(
            new Date(thread.lastMessage.sent_at || thread.lastMessage.created_at),
            { addSuffix: false }
          )}
        </span>
      </div>
      {thread.companyName && (
        <div className="text-xs text-muted-foreground truncate">{thread.companyName}</div>
      )}
      <div className="text-xs text-muted-foreground truncate mt-0.5">
        {thread.lastMessage.direction === "outbound" && "You: "}
        {thread.lastMessage.message_content || "(no content)"}
      </div>
      <div className="flex items-center gap-1.5 mt-1.5">
        {thread.unreadCount > 0 && (
          <Badge variant="destructive" className="text-[10px] h-4 px-1.5">
            {thread.unreadCount}
          </Badge>
        )}
        {!thread.withinReplyWindow && (
          <Badge variant="outline" className="text-[10px] h-4 px-1.5 gap-1">
            <Clock className="h-2.5 w-2.5" />
            Template only
          </Badge>
        )}
      </div>
    </button>
  );
}

function WhatsAppThreadView({ thread }: { thread: WhatsAppThread }) {
  const isDc = !!thread.demandcomId;
  const { data: messages = [], isLoading } = useWhatsAppThreadMessages(thread.threadKey, isDc);
  const markRead = useMarkWhatsAppRead();
  const sendReply = useSendWhatsAppReply();
  const { data: templates = [] } = useWhatsAppTemplates();

  const [replyText, setReplyText] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");

  // Mark unread inbound as read when thread opens
  useEffect(() => {
    const unreadIds = messages.filter((m) => m.direction === "inbound" && !m.is_read).map((m) => m.id);
    if (unreadIds.length > 0) markRead.mutate(unreadIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.threadKey, messages.length]);

  const handleSendFreeForm = async () => {
    if (!replyText.trim()) return;
    await sendReply.mutateAsync({ thread, message: replyText.trim() });
    setReplyText("");
  };

  const handleSendTemplate = async () => {
    if (!selectedTemplate) return;
    const tmpl = templates.find((t: any) => t.id === selectedTemplate);
    if (!tmpl) return;
    await sendReply.mutateAsync({
      thread,
      templateId: tmpl.id,
      templateName: tmpl.template_name,
    });
    setSelectedTemplate("");
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="border-b p-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold truncate">{thread.contactName || thread.phoneNumber}</h3>
          <div className="text-xs text-muted-foreground">
            {thread.phoneNumber}
            {thread.companyName && <> · {thread.companyName}</>}
          </div>
        </div>
        {thread.withinReplyWindow ? (
          <Badge variant="outline" className="text-[10px] gap-1 shrink-0">
            <CheckCheck className="h-2.5 w-2.5" />
            Free-form open
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-[10px] gap-1 shrink-0">
            <Clock className="h-2.5 w-2.5" />
            Template only (24h elapsed)
          </Badge>
        )}
      </div>

      <ScrollArea className="flex-1 bg-muted/20">
        <div className="p-4 space-y-2">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "max-w-[75%] rounded-lg p-2.5 text-sm",
                  m.direction === "outbound"
                    ? "ml-auto bg-emerald-500 text-white"
                    : "bg-background border"
                )}
              >
                {m.template_name && (
                  <div className={cn(
                    "text-[10px] uppercase tracking-wide mb-1",
                    m.direction === "outbound" ? "text-white/80" : "text-muted-foreground"
                  )}>
                    Template: {m.template_name}
                  </div>
                )}
                <div className="whitespace-pre-wrap">{m.message_content}</div>
                {m.media_url && (
                  <a href={m.media_url} target="_blank" rel="noopener noreferrer" className="text-xs underline">
                    View {m.media_type || "media"}
                  </a>
                )}
                <div className={cn(
                  "text-[10px] mt-1",
                  m.direction === "outbound" ? "text-white/80" : "text-muted-foreground"
                )}>
                  {format(new Date(m.sent_at || m.created_at), "p")}
                  {m.direction === "outbound" && m.status && <> · {m.status}</>}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      <div className="border-t p-3 space-y-2">
        {thread.withinReplyWindow ? (
          <>
            <Textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={2}
              placeholder="Type a message…"
              className="text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendFreeForm();
                }
              }}
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handleSendFreeForm}
                disabled={!replyText.trim() || sendReply.isPending}
              >
                {sendReply.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                <Send className="h-3.5 w-3.5 mr-1.5" />
                Send
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" />
              Last reply was over 24 hours ago. Send an approved template to reopen the chat.
            </div>
            <div className="flex gap-2">
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Choose a template…" />
                </SelectTrigger>
                <SelectContent>
                  {templates.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">No approved templates available</div>
                  ) : (
                    (templates as any[]).map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.template_name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={handleSendTemplate} disabled={!selectedTemplate || sendReply.isPending}>
                {sendReply.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                Send
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
