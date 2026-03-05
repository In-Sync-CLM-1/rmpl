 import { useQuery } from "@tanstack/react-query";
 import { supabase } from "@/integrations/supabase/client";
 
 export interface WhatsAppTemplate {
   id: string;
   template_id: string;
   template_name: string;
   category: string | null;
   language: string;
   content: string;
   header_type: string | null;
   header_content: string | null;
   footer_text: string | null;
   buttons: Array<{ type: string; text: string }>;
   variables: Array<{ index: number; placeholder: string }>;
   sample_values: Record<string, string>;
   status: "approved" | "pending" | "rejected";
   rejection_reason: string | null;
   last_synced_at: string | null;
   created_at: string;
   updated_at: string;
 }
 
 export function useWhatsAppTemplates(onlyApproved = false) {
   const { data: templates = [], isLoading, error } = useQuery({
     queryKey: ["whatsapp-templates", onlyApproved],
     queryFn: async () => {
       let query = supabase
         .from("whatsapp_templates")
         .select("*")
         .order("template_name", { ascending: true });
 
       if (onlyApproved) {
         query = query.eq("status", "approved");
       }
 
       const { data, error } = await query;
 
       if (error) throw error;
       return data as WhatsAppTemplate[];
     },
   });
 
   return {
     templates,
     isLoading,
     error,
   };
 }