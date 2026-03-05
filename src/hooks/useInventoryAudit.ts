import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AuditLogEntry {
  id: string;
  inventory_item_id: string;
  allocation_id: string | null;
  action: string;
  old_status: string | null;
  new_status: string | null;
  old_condition: string | null;
  new_condition: string | null;
  user_id: string | null;
  notes: string | null;
  changed_by: string | null;
  timestamp: string;
  user?: {
    full_name: string | null;
  };
  changed_by_profile?: {
    full_name: string | null;
  };
}

export function useInventoryAudit(inventoryItemId?: string) {
  return useQuery({
    queryKey: ["inventory-audit", inventoryItemId],
    queryFn: async () => {
      let query = supabase
        .from("inventory_audit_log")
        .select(`
          *,
          user:profiles!inventory_audit_log_user_id_fkey(full_name),
          changed_by_profile:profiles!inventory_audit_log_changed_by_fkey(full_name)
        `)
        .order("timestamp", { ascending: false });

      if (inventoryItemId) {
        query = query.eq("inventory_item_id", inventoryItemId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as AuditLogEntry[];
    },
    enabled: !!inventoryItemId,
  });
}
