import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useCallback } from "react";
import { useBusinessHours } from "./useBusinessHours";

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
  user?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

export interface GroupedReaction {
  emoji: string;
  count: number;
  users: { id: string; name: string | null }[];
  hasReacted: boolean;
}

export function useMessageReactions(conversationId: string | null) {
  const queryClient = useQueryClient();
  const { liveUpdatesActive } = useBusinessHours();

  const { data: reactions = [], isLoading } = useQuery({
    queryKey: ["message-reactions", conversationId],
    queryFn: async () => {
      if (!conversationId) return [];

      // Get all message IDs for this conversation first
      const { data: messages, error: messagesError } = await supabase
        .from("chat_messages")
        .select("id")
        .eq("conversation_id", conversationId);

      if (messagesError) throw messagesError;
      if (!messages || messages.length === 0) return [];

      const messageIds = messages.map((m) => m.id);

      const { data, error } = await supabase
        .from("chat_message_reactions")
        .select(`
          *,
          user:profiles(id, full_name, avatar_url)
        `)
        .in("message_id", messageIds);

      if (error) throw error;
      return data as MessageReaction[];
    },
    enabled: !!conversationId,
    staleTime: 10 * 1000,
  });

  // Subscribe to real-time reaction changes
  useEffect(() => {
    if (!conversationId) return;
    if (!liveUpdatesActive) return;

    const channel = supabase
      .channel(`chat-reactions-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_message_reactions",
        },
        () => {
          // Refetch reactions on any change
          queryClient.invalidateQueries({ queryKey: ["message-reactions", conversationId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient, liveUpdatesActive]);

  const addReaction = useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("chat_message_reactions")
        .insert({
          message_id: messageId,
          user_id: user.id,
          emoji,
        });

      if (error && error.code !== "23505") throw error; // Ignore unique constraint violations
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["message-reactions", conversationId] });
    },
  });

  const removeReaction = useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("chat_message_reactions")
        .delete()
        .eq("message_id", messageId)
        .eq("user_id", user.id)
        .eq("emoji", emoji);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["message-reactions", conversationId] });
    },
  });

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string, currentUserId: string) => {
      const existingReaction = reactions.find(
        (r) => r.message_id === messageId && r.emoji === emoji && r.user_id === currentUserId
      );

      if (existingReaction) {
        await removeReaction.mutateAsync({ messageId, emoji });
      } else {
        await addReaction.mutateAsync({ messageId, emoji });
      }
    },
    [reactions, addReaction, removeReaction]
  );

  const getGroupedReactions = useCallback(
    (messageId: string, currentUserId: string): GroupedReaction[] => {
      const messageReactions = reactions.filter((r) => r.message_id === messageId);
      const grouped = new Map<string, GroupedReaction>();

      messageReactions.forEach((reaction) => {
        const existing = grouped.get(reaction.emoji);
        if (existing) {
          existing.count++;
          existing.users.push({ id: reaction.user_id, name: reaction.user?.full_name || null });
          if (reaction.user_id === currentUserId) {
            existing.hasReacted = true;
          }
        } else {
          grouped.set(reaction.emoji, {
            emoji: reaction.emoji,
            count: 1,
            users: [{ id: reaction.user_id, name: reaction.user?.full_name || null }],
            hasReacted: reaction.user_id === currentUserId,
          });
        }
      });

      return Array.from(grouped.values());
    },
    [reactions]
  );

  return {
    reactions,
    isLoading,
    addReaction,
    removeReaction,
    toggleReaction,
    getGroupedReactions,
  };
}
