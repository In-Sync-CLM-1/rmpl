import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useConversations } from "@/hooks/useConversations";
import { ConversationList } from "@/components/chat/ConversationList";
import { MessageThread } from "@/components/chat/MessageThread";
import { MessageInput } from "@/components/chat/MessageInput";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ForwardMessageDialog } from "@/components/chat/ForwardMessageDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { ChatMessage } from "@/hooks/useMessages";

export default function Chat() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [showConversations, setShowConversations] = useState(!conversationId);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [forwardMessage, setForwardMessage] = useState<ChatMessage | null>(null);
  
  const { conversations } = useConversations();

  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const selectedConversation = conversations.find(
    (c) => c.id === conversationId
  );

  // Clear reply when switching conversations
  useEffect(() => {
    setReplyTo(null);
  }, [conversationId]);

  useEffect(() => {
    if (isMobile) {
      setShowConversations(!conversationId);
    }
  }, [conversationId, isMobile]);

  const handleSelectConversation = (id: string) => {
    navigate(`/chat/${id}`);
    if (isMobile) {
      setShowConversations(false);
    }
  };

  const handleBack = () => {
    navigate("/chat");
    setShowConversations(true);
  };

  if (!currentUser) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex overflow-hidden bg-background">
      {/* Conversation List */}
      <div
        className={cn(
          "w-full md:w-80 lg:w-96 shrink-0 transition-transform",
          isMobile && !showConversations && "hidden"
        )}
      >
        <ConversationList
          selectedId={conversationId || null}
          onSelect={handleSelectConversation}
          currentUserId={currentUser.id}
        />
      </div>

      {/* Message Area */}
      <div
        className={cn(
          "flex-1 flex flex-col min-w-0",
          isMobile && showConversations && "hidden"
        )}
      >
        <ChatHeader
          conversation={selectedConversation || null}
          currentUserId={currentUser.id}
          onBack={handleBack}
          showBackButton={isMobile}
        />
        
        <MessageThread
          conversationId={conversationId || null}
          currentUserId={currentUser.id}
          onReply={setReplyTo}
          onForward={setForwardMessage}
        />
        
        <MessageInput
          conversationId={conversationId || null}
          disabled={!conversationId}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
        />
      </div>

      <ForwardMessageDialog
        open={!!forwardMessage}
        onOpenChange={(open) => !open && setForwardMessage(null)}
        message={forwardMessage}
        currentUserId={currentUser.id}
      />
    </div>
  );
}
