import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect } from "react";

export interface FeatureAnnouncement {
  id: string;
  title: string;
  description: string;
  announcement_type: 'new_feature' | 'update' | 'bug_fix' | 'removal' | 'improvement';
  priority: 'low' | 'medium' | 'high' | 'critical';
  target_roles: string[] | null;
  image_url: string | null;
  link_url: string | null;
  link_text: string | null;
  is_active: boolean;
  published_at: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserAnnouncementView {
  id: string;
  user_id: string;
  announcement_id: string;
  viewed_at: string;
  dismissed: boolean;
}

export function useAnnouncements() {
  const queryClient = useQueryClient();

  // Fetch all active announcements
  const { data: announcements, isLoading } = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feature_announcements")
        .select("*")
        .eq("is_active", true)
        .order("published_at", { ascending: false });

      if (error) throw error;
      return data as FeatureAnnouncement[];
    },
  });

  // Fetch user's viewed announcements
  const { data: viewedAnnouncements } = useQuery({
    queryKey: ["user-announcement-views"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("user_announcement_views")
        .select("*")
        .eq("user_id", user.id);

      if (error) throw error;
      return data as UserAnnouncementView[];
    },
  });

  // Calculate unread count
  const unreadCount = announcements?.filter(announcement => 
    !viewedAnnouncements?.some(view => 
      view.announcement_id === announcement.id && !view.dismissed
    )
  ).length || 0;

  // Get unread announcements
  const unreadAnnouncements = announcements?.filter(announcement => 
    !viewedAnnouncements?.some(view => 
      view.announcement_id === announcement.id
    )
  ) || [];

  // Mark announcement as viewed
  const markAsViewed = useMutation({
    mutationFn: async (announcementId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("user_announcement_views")
        .upsert({
          user_id: user.id,
          announcement_id: announcementId,
          viewed_at: new Date().toISOString(),
          dismissed: false,
        }, {
          onConflict: 'user_id,announcement_id'
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-announcement-views"] });
    },
  });

  // Dismiss announcement
  const dismissAnnouncement = useMutation({
    mutationFn: async (announcementId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("user_announcement_views")
        .upsert({
          user_id: user.id,
          announcement_id: announcementId,
          viewed_at: new Date().toISOString(),
          dismissed: true,
        }, {
          onConflict: 'user_id,announcement_id'
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-announcement-views"] });
      toast.success("Announcement dismissed");
    },
  });

  // Listen for new announcements
  useEffect(() => {
    const channel = supabase
      .channel('announcements-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'feature_announcements',
        },
        (payload) => {
          console.log('New announcement:', payload);
          queryClient.invalidateQueries({ queryKey: ["announcements"] });
          
          const announcement = payload.new as FeatureAnnouncement;
          if (announcement.priority === 'high' || announcement.priority === 'critical') {
            toast.info("New Feature Update!", {
              description: announcement.title,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return {
    announcements: announcements || [],
    unreadAnnouncements,
    unreadCount,
    isLoading,
    markAsViewed: markAsViewed.mutateAsync,
    dismissAnnouncement: dismissAnnouncement.mutateAsync,
    viewedAnnouncements: viewedAnnouncements || [],
  };
}
