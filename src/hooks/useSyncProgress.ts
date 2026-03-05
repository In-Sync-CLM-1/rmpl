import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SyncProgress {
  id: string;
  status: string;
  items_fetched: number;
  items_inserted: number;
  items_updated: number;
  items_failed: number;
  total_batches: number;
  current_batch: number;
  duration_seconds: number | null;
  error_details: any;
}

export function useSyncProgress(syncId: string | null) {
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);

  const fetchProgress = useCallback(async () => {
    if (!syncId) return;

    const { data, error } = await supabase
      .from('sync_logs')
      .select('*')
      .eq('id', syncId)
      .single();

    if (!error && data) {
      setProgress(data as SyncProgress);
      if (['completed', 'partial', 'failed'].includes(data.status)) {
        setIsCompleted(true);
      }
    }
  }, [syncId]);

  useEffect(() => {
    if (!syncId) return;

    // Initial fetch
    fetchProgress();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`sync-progress-${syncId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sync_logs',
          filter: `id=eq.${syncId}`,
        },
        (payload) => {
          const newData = payload.new as SyncProgress;
          setProgress(newData);
          if (['completed', 'partial', 'failed'].includes(newData.status)) {
            setIsCompleted(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [syncId, fetchProgress]);

  const reset = useCallback(() => {
    setProgress(null);
    setIsCompleted(false);
  }, []);

  return { progress, isCompleted, reset, refetch: fetchProgress };
}