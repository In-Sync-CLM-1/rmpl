import { useState } from "react";
import { useConversations, Conversation } from "@/hooks/useConversations";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { NewConversationDialog } from "./NewConversationDialog";

interface ConversationListProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  currentUserId: string;
}

export function ConversationList({ selectedId, onSelect, currentUserId }: ConversationListProps) {
  const { conversations, isLoading } = useConversations();
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewDialog, setShowNewDialog] = useState(false);

  const filteredConversations = conversations.filter((conv) => {
    const searchLower = searchQuery.toLowerCase();
    if (conv.name?.toLowerCase().includes(searchLower)) return true;
    
    const otherParticipants = conv.participants?.filter(p => p.user_id !== currentUserId) || [];
    return otherParticipants.some(p => 
      p.profile?.full_name?.toLowerCase().includes(searchLower)
    );
  });

  const getConversationName = (conv: Conversation) => {
    if (conv.name) return conv.name;
    
    const otherParticipants = conv.participants?.filter(p => p.user_id !== currentUserId) || [];
    if (otherParticipants.length === 0) return "No participants";
    
    return otherParticipants.map(p => p.profile?.full_name || "Unknown").join(", ");
  };

  const getConversationAvatar = (conv: Conversation) => {
    if (conv.conversation_type === "group") {
      return null; // Will show Users icon
    }
    
    const otherParticipant = conv.participants?.find(p => p.user_id !== currentUserId);
    return otherParticipant?.profile?.avatar_url;
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getLastMessagePreview = (conv: Conversation) => {
    if (!conv.last_message) return "No messages yet";
    
    switch (conv.last_message.message_type) {
      case "task_share":
        return "📋 Shared a task";
      case "file":
        return "📎 Sent a file";
      default:
        return conv.last_message.content || "";
    }
  };

  return (
    <div className="flex flex-col h-full border-r bg-card">
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Messages</h2>
          <Button size="sm" onClick={() => setShowNewDialog(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No conversations yet</p>
            <p className="text-sm">Start a new conversation to begin chatting</p>
          </div>
        ) : (
          <div className="p-2">
            {filteredConversations.map((conv) => {
              const name = getConversationName(conv);
              const avatarUrl = getConversationAvatar(conv);
              const preview = getLastMessagePreview(conv);
              const timeAgo = conv.last_message?.created_at 
                ? formatDistanceToNow(new Date(conv.last_message.created_at), { addSuffix: true })
                : formatDistanceToNow(new Date(conv.created_at), { addSuffix: true });

              return (
                <button
                  key={conv.id}
                  onClick={() => onSelect(conv.id)}
                  className={cn(
                    "w-full p-3 rounded-lg flex items-start gap-3 text-left transition-colors",
                    selectedId === conv.id
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted"
                  )}
                >
                  <Avatar className="h-10 w-10 shrink-0">
                    {avatarUrl ? (
                      <AvatarImage src={avatarUrl} />
                    ) : null}
                    <AvatarFallback>
                      {conv.conversation_type === "group" ? (
                        <Users className="h-5 w-5" />
                      ) : (
                        getInitials(name)
                      )}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">{name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {timeAgo}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <span className="text-sm text-muted-foreground line-clamp-2">
                        {preview}
                      </span>
                      {conv.unread_count ? (
                        <Badge variant="default" className="shrink-0 h-5 min-w-5 flex items-center justify-center">
                          {conv.unread_count}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>

      <NewConversationDialog 
        open={showNewDialog} 
        onOpenChange={setShowNewDialog}
        onConversationCreated={(id) => {
          setShowNewDialog(false);
          onSelect(id);
        }}
      />
    </div>
  );
}
