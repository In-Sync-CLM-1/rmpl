 import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
 import { supabase } from "@/integrations/supabase/client";
 import { toast } from "sonner";
 import { useEffect } from "react";
 
 export interface WhatsAppMessage {
   id: string;
   demandcom_id: string | null;
   phone_number: string;
   message_content: string | null;
   direction: "inbound" | "outbound";
   template_id: string | null;
   template_name: string | null;
   template_variables: Record<string, string> | null;
   status: "pending" | "sent" | "delivered" | "read" | "failed" | "received";
   exotel_message_id: string | null;
   error_message: string | null;
   sent_at: string | null;
   delivered_at: string | null;
   read_at: string | null;
   media_url: string | null;
   media_type: string | null;
   sent_by: string | null;
   created_at: string;
   sender?: {
     full_name: string | null;
   };
 }
 
 interface SendMessageParams {
   phoneNumber: string;
   demandcomId?: string;
   message?: string;
   templateId?: string;
   templateName?: string;
   templateVariables?: Record<string, string>;
   templateComponents?: Array<{
     type: string;
     parameters: Array<{ type: string; text: string }>;
   }>;
   mediaType?: "image" | "document" | "video" | "audio";
   mediaUrl?: string;
   mediaCaption?: string;
 }
 
 export function useWhatsAppMessages(demandcomId?: string, phoneNumber?: string) {
   const queryClient = useQueryClient();
 
   const queryKey = demandcomId 
     ? ["whatsapp-messages", "demandcom", demandcomId]
     : phoneNumber 
     ? ["whatsapp-messages", "phone", phoneNumber]
     : ["whatsapp-messages", "all"];
 
   const { data: messages = [], isLoading, error } = useQuery({
     queryKey,
     queryFn: async () => {
       let query = supabase
         .from("whatsapp_messages")
         .select(`
           *,
           sender:profiles!sent_by(full_name)
         `)
         .order("sent_at", { ascending: false });
 
       if (demandcomId) {
         query = query.eq("demandcom_id", demandcomId);
       } else if (phoneNumber) {
         query = query.eq("phone_number", phoneNumber);
       }
 
       const { data, error } = await query.limit(100);
 
       if (error) throw error;
       return data as WhatsAppMessage[];
     },
     enabled: !!demandcomId || !!phoneNumber || (!demandcomId && !phoneNumber),
   });
 
   // Set up realtime subscription
   useEffect(() => {
     let channel: ReturnType<typeof supabase.channel>;
 
     if (demandcomId || phoneNumber) {
       const filter = demandcomId 
         ? `demandcom_id=eq.${demandcomId}`
         : `phone_number=eq.${phoneNumber}`;
 
       channel = supabase
         .channel(`whatsapp_messages_${demandcomId || phoneNumber}`)
         .on(
           "postgres_changes",
           {
             event: "*",
             schema: "public",
             table: "whatsapp_messages",
             filter,
           },
           () => {
             queryClient.invalidateQueries({ queryKey });
           }
         )
         .subscribe();
     }
 
     return () => {
       if (channel) {
         supabase.removeChannel(channel);
       }
     };
   }, [demandcomId, phoneNumber, queryClient, queryKey]);
 
   const sendMessage = useMutation({
     mutationFn: async (params: SendMessageParams) => {
       const { data, error } = await supabase.functions.invoke("send-whatsapp-message", {
         body: params,
       });
 
       if (error) throw error;
       if (!data.success) throw new Error(data.error || "Failed to send message");
       return data;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey });
       toast.success("WhatsApp message sent successfully");
     },
     onError: (error: Error) => {
       toast.error(`Failed to send message: ${error.message}`);
     },
   });
 
   return {
     messages,
     isLoading,
     error,
     sendMessage: sendMessage.mutate,
     isSending: sendMessage.isPending,
   };
 }