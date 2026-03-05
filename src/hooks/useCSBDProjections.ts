import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CSBDProjection {
  id: string;
  user_id: string;
  month: string;
  projection_amount_inr_lacs: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Helper function to format date as YYYY-MM-DD without timezone conversion
const formatDateLocal = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const useCSBDProjections = (userId?: string, fiscalYear = 2025) => {
  const queryClient = useQueryClient();

  const yearStart = new Date(fiscalYear, 0, 1); // January 1st
  const yearEnd = new Date(fiscalYear, 11, 31); // December 31st

  const projectionsQuery = useQuery({
    queryKey: ['csbd-projections', userId, fiscalYear],
    queryFn: async () => {
      const query = supabase
        .from('csbd_projections')
        .select('*')
        .gte('month', formatDateLocal(yearStart))
        .lte('month', formatDateLocal(yearEnd))
        .order('month', { ascending: true });

      if (userId) {
        query.eq('user_id', userId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CSBDProjection[];
    },
  });

  const upsertProjection = useMutation({
    mutationFn: async ({
      user_id,
      month,
      projection_amount_inr_lacs,
      notes,
    }: {
      user_id: string;
      month: string;
      projection_amount_inr_lacs: number;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('csbd_projections')
        .upsert(
          {
            user_id,
            month,
            projection_amount_inr_lacs,
            notes: notes || null,
          },
          { onConflict: 'user_id,month' }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['csbd-projections'] });
      queryClient.invalidateQueries({ queryKey: ['csbd-metrics'] });
      toast.success('Projection saved successfully');
    },
    onError: (error: any) => {
      toast.error(`Failed to save projection: ${error.message}`);
    },
  });

  return {
    projections: projectionsQuery.data,
    isLoading: projectionsQuery.isLoading,
    error: projectionsQuery.error,
    upsertProjection,
  };
};

export const useCSBDTarget = (userId?: string, fiscalYear = 2025) => {
  return useQuery({
    queryKey: ['csbd-target', userId, fiscalYear],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const targetUserId = userId || user?.id;

      if (!targetUserId) throw new Error('No user ID');

      const { data, error } = await supabase
        .from('csbd_targets')
        .select('*')
        .eq('user_id', targetUserId)
        .eq('fiscal_year', fiscalYear)
        .single();

      if (error) throw error;
      return data;
    },
  });
};
