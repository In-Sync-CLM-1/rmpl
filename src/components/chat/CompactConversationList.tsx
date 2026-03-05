 import { useState, useEffect } from "react";
 import { useConversations, Conversation } from "@/hooks/useConversations";
 import { Input } from "@/components/ui/input";
 import { Button } from "@/components/ui/button";
 import { ScrollArea } from "@/components/ui/scroll-area";
 import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
 import { Badge } from "@/components/ui/badge";
 import { Search, Plus, Users, Loader2 } from "lucide-react";
 import { formatDistanceToNow } from "date-fns";
 import { cn } from "@/lib/utils";
 import { NewConversationDialog } from "./NewConversationDialog";
 import { supabase } from "@/integrations/supabase/client";
 
 interface CompactConversationListProps {
   onSelectConversation: (id: string) => void;
 }
 
 export function CompactConversationList({ onSelectConversation }: CompactConversationListProps) {
   const { conversations, isLoading } = useConversations();
   const [searchQuery, setSearchQuery] = useState("");
   const [showNewDialog, setShowNewDialog] = useState(false);
   const [currentUserId, setCurrentUserId] = useState<string | null>(null);
 
   useEffect(() => {
     const fetchUser = async () => {
       const { data: { user } } = await supabase.auth.getUser();
       setCurrentUserId(user?.id || null);
     };
     fetchUser();
   }, []);
 
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
     if (conv.conversation_type === "group") return null;
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
     <div className="flex flex-col h-full">
       {/* Search */}
       <div className="p-3 border-b space-y-2">
         <div className="relative">
           <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
           <Input
             placeholder="Search..."
             value={searchQuery}
             onChange={(e) => setSearchQuery(e.target.value)}
             className="pl-8 h-9 text-sm"
           />
         </div>
       </div>
 
       {/* Conversation List */}
       <ScrollArea className="flex-1">
         {isLoading ? (
           <div className="flex items-center justify-center py-8">
             <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
           </div>
         ) : filteredConversations.length === 0 ? (
           <div className="p-6 text-center text-muted-foreground">
             <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
             <p className="text-sm font-medium">No conversations</p>
             <p className="text-xs">Start a new chat below</p>
           </div>
         ) : (
           <div className="p-1.5">
             {filteredConversations.map((conv) => {
               const name = getConversationName(conv);
               const avatarUrl = getConversationAvatar(conv);
               const preview = getLastMessagePreview(conv);
               const timeAgo = conv.last_message?.created_at 
                 ? formatDistanceToNow(new Date(conv.last_message.created_at), { addSuffix: false })
                 : "";
 
               return (
                 <button
                   key={conv.id}
                   onClick={() => onSelectConversation(conv.id)}
                   className={cn(
                     "w-full p-2.5 rounded-lg flex items-start gap-2.5 text-left transition-colors hover:bg-muted"
                   )}
                 >
                   <Avatar className="h-9 w-9 shrink-0">
                     {avatarUrl ? <AvatarImage src={avatarUrl} /> : null}
                     <AvatarFallback className="text-xs">
                       {conv.conversation_type === "group" ? (
                         <Users className="h-4 w-4" />
                       ) : (
                         getInitials(name)
                       )}
                     </AvatarFallback>
                   </Avatar>
                   
                   <div className="flex-1 min-w-0">
                     <div className="flex items-center justify-between gap-2">
                       <span className="font-medium text-sm truncate">{name}</span>
                       {timeAgo && (
                         <span className="text-[10px] text-muted-foreground shrink-0">
                           {timeAgo}
                         </span>
                       )}
                     </div>
                     <div className="flex items-center justify-between gap-2 mt-0.5">
                       <span className="text-xs text-muted-foreground line-clamp-1">
                         {preview}
                       </span>
                       {conv.unread_count ? (
                         <Badge variant="default" className="shrink-0 h-4 min-w-4 flex items-center justify-center p-0 text-[10px]">
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
 
       {/* New Message Button */}
       <div className="p-3 border-t">
         <Button
           size="sm"
           className="w-full"
           onClick={() => setShowNewDialog(true)}
         >
           <Plus className="h-4 w-4 mr-1.5" />
           New Message
         </Button>
       </div>
 
       <NewConversationDialog 
         open={showNewDialog} 
         onOpenChange={setShowNewDialog}
         onConversationCreated={(id) => {
           setShowNewDialog(false);
           onSelectConversation(id);
         }}
       />
     </div>
   );
 }