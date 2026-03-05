 import { ArrowLeft, Minus, X, Users, ExternalLink } from "lucide-react";
 import { Button } from "@/components/ui/button";
 import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
 import { useNavigate } from "react-router-dom";
 
 interface CompactChatHeaderProps {
   conversationName: string;
   conversationType: "direct" | "group";
   avatarUrl?: string | null;
   conversationId?: string | null;
   onBack?: () => void;
   onMinimize: () => void;
   onClose: () => void;
   showBack?: boolean;
 }
 
 export function CompactChatHeader({
   conversationName,
   conversationType,
   avatarUrl,
   conversationId,
   onBack,
   onMinimize,
   onClose,
   showBack = false,
 }: CompactChatHeaderProps) {
   const navigate = useNavigate();
 
   const getInitials = (name: string) => {
     return name
       .split(" ")
       .map((n) => n[0])
       .join("")
       .toUpperCase()
       .slice(0, 2);
   };
 
   const handleOpenFullView = () => {
     if (conversationId) {
       navigate(`/chat/${conversationId}`);
     } else {
       navigate("/chat");
     }
     onClose();
   };
 
   return (
     <div className="flex items-center justify-between p-3 border-b bg-card">
       <div className="flex items-center gap-2 min-w-0 flex-1">
         {showBack && onBack && (
           <Button
             variant="ghost"
             size="icon"
             className="h-8 w-8 shrink-0"
             onClick={onBack}
           >
             <ArrowLeft className="h-4 w-4" />
           </Button>
         )}
 
         {!showBack && (
           <Avatar className="h-8 w-8 shrink-0">
             {avatarUrl ? <AvatarImage src={avatarUrl} /> : null}
             <AvatarFallback className="text-xs">
               {conversationType === "group" ? (
                 <Users className="h-4 w-4" />
               ) : (
                 getInitials(conversationName)
               )}
             </AvatarFallback>
           </Avatar>
         )}
 
         <span className="font-medium truncate text-sm">
           {showBack ? conversationName : "Messages"}
         </span>
       </div>
 
       <div className="flex items-center gap-1 shrink-0">
         <Button
           variant="ghost"
           size="icon"
           className="h-7 w-7"
           onClick={handleOpenFullView}
           title="Open full view"
         >
           <ExternalLink className="h-3.5 w-3.5" />
         </Button>
         <Button
           variant="ghost"
           size="icon"
           className="h-7 w-7"
           onClick={onMinimize}
           title="Minimize"
         >
           <Minus className="h-3.5 w-3.5" />
         </Button>
         <Button
           variant="ghost"
           size="icon"
           className="h-7 w-7"
           onClick={onClose}
           title="Close"
         >
           <X className="h-3.5 w-3.5" />
         </Button>
       </div>
     </div>
   );
 }