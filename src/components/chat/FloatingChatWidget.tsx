 import { useState } from "react";
 import { useLocation } from "react-router-dom";
 import { MessageCircle } from "lucide-react";
 import { motion, AnimatePresence } from "framer-motion";
 import { Button } from "@/components/ui/button";
 import { Badge } from "@/components/ui/badge";
 import { useTotalUnreadCount } from "@/hooks/useConversations";
 import { CompactConversationList } from "./CompactConversationList";
 import { CompactChatView } from "./CompactChatView";
 import { CompactChatHeader } from "./CompactChatHeader";
 
 export function FloatingChatWidget() {
   const location = useLocation();
   const unreadCount = useTotalUnreadCount();
   const [isOpen, setIsOpen] = useState(false);
   const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
 
   // Don't show on chat page
   if (location.pathname.startsWith("/chat")) {
     return null;
   }
 
   const handleClose = () => {
     setIsOpen(false);
     setActiveConversationId(null);
   };
 
   const handleMinimize = () => {
     setIsOpen(false);
   };
 
   const handleSelectConversation = (id: string) => {
     setActiveConversationId(id);
   };
 
   const handleBack = () => {
     setActiveConversationId(null);
   };
 
   return (
     <>
       {/* Floating Button */}
       {!isOpen && (
         <Button
           onClick={() => setIsOpen(true)}
           size="icon"
           className="fixed bottom-24 right-6 h-14 w-14 rounded-full shadow-lg z-50 bg-primary hover:bg-primary/90 transition-all hover:scale-105"
         >
           <MessageCircle className="h-6 w-6" />
           {unreadCount > 0 && (
             <Badge 
               variant="destructive" 
               className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
             >
               {unreadCount > 9 ? '9+' : unreadCount}
             </Badge>
           )}
         </Button>
       )}
 
       {/* Chat Widget Panel */}
       <AnimatePresence>
         {isOpen && (
           <motion.div
             initial={{ opacity: 0, y: 20, scale: 0.95 }}
             animate={{ opacity: 1, y: 0, scale: 1 }}
             exit={{ opacity: 0, y: 20, scale: 0.95 }}
             transition={{ duration: 0.2, ease: "easeOut" }}
             className="fixed bottom-6 right-6 z-50 w-[380px] h-[500px] max-h-[calc(100vh-120px)] bg-background border rounded-xl shadow-xl overflow-hidden flex flex-col sm:w-[380px] max-sm:w-[calc(100vw-32px)] max-sm:h-[calc(100vh-100px)] max-sm:bottom-4 max-sm:right-4"
           >
             {activeConversationId ? (
               <CompactChatView
                 conversationId={activeConversationId}
                 onBack={handleBack}
                 onMinimize={handleMinimize}
                 onClose={handleClose}
               />
             ) : (
               <>
                 <CompactChatHeader
                   conversationName="Messages"
                   conversationType="direct"
                   onMinimize={handleMinimize}
                   onClose={handleClose}
                 />
                 <CompactConversationList
                   onSelectConversation={handleSelectConversation}
                 />
               </>
             )}
           </motion.div>
         )}
       </AnimatePresence>
     </>
   );
 }