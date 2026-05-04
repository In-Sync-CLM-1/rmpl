import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useCallback, useMemo } from "react";
import { useBusinessHours } from "./useBusinessHours";

interface Participant {
  user_id: string;
  last_read_at: string | null;
  profile: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

interface ReadReceiptUser {
  id: string;
  name: string | null;
  avatarUrl: string | null;
}

export function useReadReceipts(conversationId: string | null, currentUserId: string) {
  const queryClient = useQueryClient();
  const { liveUpdatesActive } = useBusinessHours();

  const { data: participants = [], isLoading } = useQuery({
    queryKey: ["chat-participants", conversationId],
    queryFn: async () => {
      if (!conversationId) return [];

      const { data, error } = await supabase
        .from("chat_participants")
        .select(`
          user_id,
          last_read_at,
          profile:profiles(id, full_name, avatar_url)
        `)
        .eq("conversation_id", conversationId);

      if (error) throw error;
      return data as Participant[];
    },
    enabled: !!conversationId,
    staleTime: 10 * 1000,
  });

  // Subscribe to real-time updates for participant read status
  useEffect(() => {
    if (!conversationId) return;
    if (!liveUpdatesActive) return;

    const channel = supabase
      .channel(`read-receipts-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_participants",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["chat-participants", conversationId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient, liveUpdatesActive]);

  // Get users who have read up to a specific message
  const getReadByUsers = useCallback(
    (messageCreatedAt: string, messageSenderId: string): ReadReceiptUser[] => {
      const messageTime = new Date(messageCreatedAt).getTime();
      
      return participants
        .filter((p) => {
          // Don't show the sender
          if (p.user_id === messageSenderId) return false;
          // Don't show current user (they obviously read their own view)
          if (p.user_id === currentUserId) return false;
          // Check if they've read past this message
          if (!p.last_read_at) return false;
          return new Date(p.last_read_at).getTime() >= messageTime;
        })
        .map((p) => ({
          id: p.user_id,
          name: p.profile?.full_name || null,
          avatarUrl: p.profile?.avatar_url || null,
        }));
    },
    [participants, currentUserId]
  );

  // Find the last message that each user has read
  const getLatestReadMessage = useCallback(
    (messages: { id: string; created_at: string; sender_id: string }[]): Map<string, string> => {
      const latestReadByUser = new Map<string, string>();

      // For each participant (except current user), find the latest message they've read
      participants.forEach((p) => {
        if (p.user_id === currentUserId || !p.last_read_at) return;

        const lastReadTime = new Date(p.last_read_at).getTime();
        
        // Find the latest message that was created before or at their last_read_at
        for (let i = messages.length - 1; i >= 0; i--) {
          const msg = messages[i];
          if (new Date(msg.created_at).getTime() <= lastReadTime) {
            // Only show read receipt on messages sent by current user
            if (msg.sender_id === currentUserId) {
              latestReadByUser.set(p.user_id, msg.id);
            }
            break;
          }
        }
      });

      return latestReadByUser;
    },
    [participants, currentUserId]
  );

  // Get consolidated read receipts for display (show on the latest read message only)
  const getMessageReadReceipts = useCallback(
    (
      messageId: string,
      messageCreatedAt: string,
      messageSenderId: string,
      messages: { id: string; created_at: string; sender_id: string }[]
    ): ReadReceiptUser[] => {
      // Only show read receipts on own messages
      if (messageSenderId !== currentUserId) return [];

      const latestReadMap = getLatestReadMessage(messages);
      
      // Get users whose latest read message is this one
      const usersAtThisMessage: ReadReceiptUser[] = [];
      
      latestReadMap.forEach((latestMsgId, userId) => {
        if (latestMsgId === messageId) {
          const participant = participants.find((p) => p.user_id === userId);
          if (participant) {
            usersAtThisMessage.push({
              id: userId,
              name: participant.profile?.full_name || null,
              avatarUrl: participant.profile?.avatar_url || null,
            });
          }
        }
      });

      return usersAtThisMessage;
    },
    [participants, currentUserId, getLatestReadMessage]
  );

  // Check if everyone has read a message
  const isReadByAll = useCallback(
    (messageCreatedAt: string, messageSenderId: string): boolean => {
      const otherParticipants = participants.filter(
        (p) => p.user_id !== messageSenderId && p.user_id !== currentUserId
      );
      
      if (otherParticipants.length === 0) return false;

      const messageTime = new Date(messageCreatedAt).getTime();
      
      return otherParticipants.every((p) => {
        if (!p.last_read_at) return false;
        return new Date(p.last_read_at).getTime() >= messageTime;
      });
    },
    [participants, currentUserId]
  );

  return {
    participants,
    isLoading,
    getReadByUsers,
    getMessageReadReceipts,
    isReadByAll,
  };
}
