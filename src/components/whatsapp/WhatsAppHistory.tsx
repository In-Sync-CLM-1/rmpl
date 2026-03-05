 import { useMemo } from "react";
 import { format } from "date-fns";
 import { Card, CardContent } from "@/components/ui/card";
 import { Badge } from "@/components/ui/badge";
 import { ScrollArea } from "@/components/ui/scroll-area";
 import { Skeleton } from "@/components/ui/skeleton";
 import {
   Send,
   CheckCircle2,
   Clock,
   XCircle,
   MessageCircle,
   Image,
   FileText,
   Video,
   Music,
   CheckCheck,
 } from "lucide-react";
 import { useWhatsAppMessages, WhatsAppMessage } from "@/hooks/useWhatsAppMessages";
 import { cn } from "@/lib/utils";
 
 interface WhatsAppHistoryProps {
   demandcomId?: string;
   phoneNumber?: string;
   maxHeight?: string;
 }
 
 const statusConfig: Record<
   string,
   { icon: React.ElementType; color: string; label: string }
 > = {
   pending: { icon: Clock, color: "text-yellow-500", label: "Pending" },
   sent: { icon: Send, color: "text-blue-500", label: "Sent" },
   delivered: { icon: CheckCircle2, color: "text-green-500", label: "Delivered" },
   read: { icon: CheckCheck, color: "text-green-600", label: "Read" },
   failed: { icon: XCircle, color: "text-red-500", label: "Failed" },
   received: { icon: MessageCircle, color: "text-purple-500", label: "Received" },
 };
 
 const mediaIcons: Record<string, React.ElementType> = {
   image: Image,
   document: FileText,
   video: Video,
   audio: Music,
 };
 
 function MessageBubble({ message }: { message: WhatsAppMessage }) {
   const isOutbound = message.direction === "outbound";
   const statusInfo = statusConfig[message.status] || statusConfig.pending;
   const StatusIcon = statusInfo.icon;
   const MediaIcon = message.media_type ? mediaIcons[message.media_type] : null;
 
   return (
     <div className={cn("flex mb-3", isOutbound ? "justify-end" : "justify-start")}>
       <div
         className={cn(
           "max-w-[80%] rounded-lg px-4 py-2 shadow-sm",
           isOutbound
             ? "bg-primary text-primary-foreground rounded-br-none"
             : "bg-muted rounded-bl-none"
         )}
       >
         {MediaIcon && (
           <div className="flex items-center gap-2 mb-1">
             <MediaIcon className="h-4 w-4" />
             <span className="text-xs opacity-75">{message.media_type}</span>
           </div>
         )}
 
         {message.media_url && message.media_type === "image" && (
           <img
             src={message.media_url}
             alt="Attached image"
             className="rounded-md mb-2 max-w-full"
           />
         )}
 
         <p className="text-sm whitespace-pre-wrap break-words">
           {message.message_content || "[No content]"}
         </p>
 
         <div
           className={cn(
             "flex items-center gap-2 mt-1",
             isOutbound ? "justify-end" : "justify-start"
           )}
         >
           <span className={cn("text-xs", isOutbound ? "opacity-70" : "text-muted-foreground")}>
             {message.sent_at
               ? format(new Date(message.sent_at), "HH:mm")
               : format(new Date(message.created_at), "HH:mm")}
           </span>
           {isOutbound && (
             <StatusIcon className={cn("h-3 w-3", statusInfo.color)} />
           )}
         </div>
 
         {message.error_message && (
           <p className="text-xs text-red-400 mt-1">{message.error_message}</p>
         )}
       </div>
     </div>
   );
 }
 
 function DateSeparator({ date }: { date: string }) {
   return (
     <div className="flex items-center justify-center my-4">
       <Badge variant="secondary" className="text-xs font-normal">
         {format(new Date(date), "EEEE, MMMM d, yyyy")}
       </Badge>
     </div>
   );
 }
 
 export function WhatsAppHistory({
   demandcomId,
   phoneNumber,
   maxHeight = "400px",
 }: WhatsAppHistoryProps) {
   const { messages, isLoading } = useWhatsAppMessages(demandcomId, phoneNumber);
 
   // Group messages by date
   const groupedMessages = useMemo(() => {
     const groups: { date: string; messages: WhatsAppMessage[] }[] = [];
     let currentDate = "";
 
     // Messages come sorted DESC, reverse for display
     const sortedMessages = [...messages].reverse();
 
     sortedMessages.forEach((message) => {
       const messageDate = format(
         new Date(message.sent_at || message.created_at),
         "yyyy-MM-dd"
       );
 
       if (messageDate !== currentDate) {
         currentDate = messageDate;
         groups.push({ date: messageDate, messages: [message] });
       } else {
         groups[groups.length - 1].messages.push(message);
       }
     });
 
     return groups;
   }, [messages]);
 
   if (isLoading) {
     return (
       <div className="space-y-3 p-4">
         {[1, 2, 3].map((i) => (
           <div key={i} className="flex justify-end">
             <Skeleton className="h-16 w-3/4 rounded-lg" />
           </div>
         ))}
       </div>
     );
   }
 
   if (messages.length === 0) {
     return (
       <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
         <MessageCircle className="h-12 w-12 mb-3 opacity-50" />
         <p className="text-sm">No messages yet</p>
         <p className="text-xs">Send a WhatsApp message to start the conversation</p>
       </div>
     );
   }
 
   return (
     <ScrollArea style={{ height: maxHeight }} className="pr-4">
       <div className="p-4">
         {groupedMessages.map((group) => (
           <div key={group.date}>
             <DateSeparator date={group.date} />
             {group.messages.map((message) => (
               <MessageBubble key={message.id} message={message} />
             ))}
           </div>
         ))}
       </div>
     </ScrollArea>
   );
 }