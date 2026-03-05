 import { useEffect, useState } from "react";
 import { useConversations, Conversation } from "@/hooks/useConversations";
 import { MessageThread } from "./MessageThread";
 import { MessageInput } from "./MessageInput";
 import { CompactChatHeader } from "./CompactChatHeader";
 import { ForwardMessageDialog } from "./ForwardMessageDialog";
 import { supabase } from "@/integrations/supabase/client";
 import { ChatMessage } from "@/hooks/useMessages";
 
 interface CompactChatViewProps {
   conversationId: string;
   onBack: () => void;
   onMinimize: () => void;
   onClose: () => void;
 }
 
 export function CompactChatView({
   conversationId,
   onBack,
   onMinimize,
   onClose,
 }: CompactChatViewProps) {
   const { conversations } = useConversations();
   const [currentUserId, setCurrentUserId] = useState<string | null>(null);
   const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
   const [forwardMessage, setForwardMessage] = useState<ChatMessage | null>(null);

   useEffect(() => {
     setReplyTo(null);
   }, [conversationId]);
 
   useEffect(() => {
     const fetchUser = async () => {
       const { data: { user } } = await supabase.auth.getUser();
       setCurrentUserId(user?.id || null);
     };
     fetchUser();
   }, []);
 
   const conversation = conversations.find(c => c.id === conversationId);
 
   const getConversationName = (conv: Conversation | undefined) => {
     if (!conv) return "Chat";
     if (conv.name) return conv.name;
     
     const otherParticipants = conv.participants?.filter(p => p.user_id !== currentUserId) || [];
     if (otherParticipants.length === 0) return "Chat";
     
     return otherParticipants.map(p => p.profile?.full_name || "Unknown").join(", ");
   };
 
   const getConversationAvatar = (conv: Conversation | undefined) => {
     if (!conv || conv.conversation_type === "group") return null;
     const otherParticipant = conv.participants?.find(p => p.user_id !== currentUserId);
     return otherParticipant?.profile?.avatar_url;
   };
 
   return (
     <div className="flex flex-col h-full">
       <CompactChatHeader
         conversationName={getConversationName(conversation)}
         conversationType={conversation?.conversation_type || "direct"}
         avatarUrl={getConversationAvatar(conversation)}
         conversationId={conversationId}
         onBack={onBack}
         onMinimize={onMinimize}
         onClose={onClose}
         showBack={true}
       />
 
       <div className="flex-1 overflow-hidden flex flex-col min-h-0">
         {currentUserId && (
           <MessageThread
             conversationId={conversationId}
             currentUserId={currentUserId}
             onReply={setReplyTo}
             onForward={setForwardMessage}
           />
         )}
       </div>
 
       <MessageInput
         conversationId={conversationId}
         replyTo={replyTo}
         onCancelReply={() => setReplyTo(null)}
       />

       {currentUserId && (
         <ForwardMessageDialog
           open={!!forwardMessage}
           onOpenChange={(open) => !open && setForwardMessage(null)}
           message={forwardMessage}
           currentUserId={currentUserId}
         />
       )}
     </div>
   );
 }