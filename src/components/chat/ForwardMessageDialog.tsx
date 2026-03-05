import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useConversations, Conversation } from "@/hooks/useConversations";
import { useMessages, ChatMessage } from "@/hooks/useMessages";
import { supabase } from "@/integrations/supabase/client";
import { Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ForwardMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: ChatMessage | null;
  currentUserId: string;
}

export function ForwardMessageDialog({
  open,
  onOpenChange,
  message,
  currentUserId,
}: ForwardMessageDialogProps) {
  const [search, setSearch] = useState("");
  const [forwarding, setForwarding] = useState(false);
  const { conversations } = useConversations();

  const filtered = conversations.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    if (c.name?.toLowerCase().includes(q)) return true;
    return c.participants?.some((p) =>
      p.profile?.full_name?.toLowerCase().includes(q)
    );
  });

  const getConversationName = (conv: Conversation) => {
    if (conv.name) return conv.name;
    const others = conv.participants?.filter((p) => p.user_id !== currentUserId) || [];
    return others.map((p) => p.profile?.full_name || "Unknown").join(", ") || "Chat";
  };

  const getAvatar = (conv: Conversation) => {
    if (conv.conversation_type === "group") return null;
    const other = conv.participants?.find((p) => p.user_id !== currentUserId);
    return other?.profile?.avatar_url;
  };

  const handleForward = async (targetConversationId: string) => {
    if (!message || forwarding) return;
    setForwarding(true);

    try {
      const senderName = message.sender?.full_name || "Someone";
      const forwardedPrefix = `[Forwarded from ${senderName}]\n`;
      const content = message.content
        ? `${forwardedPrefix}${message.content}`
        : `${forwardedPrefix}(${message.message_type === "file" ? "File" : "Message"})`;

      const insertData: Record<string, unknown> = {
        conversation_id: targetConversationId,
        sender_id: currentUserId,
        content,
        message_type: message.message_type === "file" ? "file" : "text",
      };

      if (message.message_type === "file") {
        insertData.file_url = message.file_url;
        insertData.file_name = message.file_name;
        insertData.file_size = message.file_size;
      }

      const { error } = await supabase.from("chat_messages").insert(insertData as any);
      if (error) throw error;

      // Update last_message_at
      await supabase
        .from("chat_conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", targetConversationId);

      toast.success("Message forwarded");
      onOpenChange(false);
    } catch (err) {
      console.error("Forward failed:", err);
      toast.error("Failed to forward message");
    } finally {
      setForwarding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Forward message</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="max-h-[300px]">
          <div className="space-y-1">
            {filtered.map((conv) => (
              <button
                key={conv.id}
                disabled={forwarding}
                onClick={() => handleForward(conv.id)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted transition-colors text-left disabled:opacity-50"
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={getAvatar(conv) || undefined} />
                  <AvatarFallback className="text-xs">
                    {getConversationName(conv).slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm truncate">{getConversationName(conv)}</span>
                {forwarding && <Loader2 className="h-4 w-4 animate-spin ml-auto" />}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No conversations found</p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
