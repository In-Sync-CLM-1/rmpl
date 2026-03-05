 import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
 import { supabase } from "@/integrations/supabase/client";
 import { toast } from "sonner";
 
 export interface WhatsAppSettings {
   id: string;
   exotel_sid: string | null;
   exotel_api_key: string | null;
   exotel_api_token: string | null;
   exotel_subdomain: string | null;
   whatsapp_source_number: string;
   waba_id: string | null;
   is_active: boolean;
   created_at: string;
   updated_at: string;
 }
 
 export function useWhatsAppSettings() {
   const queryClient = useQueryClient();
 
   const { data: settings, isLoading, error } = useQuery({
     queryKey: ["whatsapp-settings"],
     queryFn: async () => {
       const { data, error } = await supabase
         .from("whatsapp_settings")
         .select("*")
         .single();
 
       if (error && error.code !== "PGRST116") {
         throw error;
       }
       return data as WhatsAppSettings | null;
     },
   });
 
   const upsertMutation = useMutation({
     mutationFn: async (newSettings: Partial<WhatsAppSettings>) => {
       if (settings?.id) {
         const { data, error } = await supabase
           .from("whatsapp_settings")
          .update(newSettings as any)
           .eq("id", settings.id)
           .select()
           .single();
 
         if (error) throw error;
         return data;
       } else {
         const { data, error } = await supabase
           .from("whatsapp_settings")
          .insert(newSettings as any)
           .select()
           .single();
 
         if (error) throw error;
         return data;
       }
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["whatsapp-settings"] });
       toast.success("WhatsApp settings saved successfully");
     },
     onError: (error: Error) => {
       toast.error(`Failed to save settings: ${error.message}`);
     },
   });
 
   const syncTemplates = useMutation({
     mutationFn: async () => {
       const { data, error } = await supabase.functions.invoke("sync-whatsapp-templates");
       if (error) throw error;
       return data;
     },
     onSuccess: (data) => {
       queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
       toast.success(`Synced ${data.synced} templates from Exotel`);
     },
     onError: (error: Error) => {
       toast.error(`Failed to sync templates: ${error.message}`);
     },
   });
 
   return {
     settings,
     isLoading,
     error,
     saveSettings: upsertMutation.mutate,
     isSaving: upsertMutation.isPending,
     syncTemplates: syncTemplates.mutate,
     isSyncing: syncTemplates.isPending,
   };
 }