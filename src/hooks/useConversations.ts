import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export interface Conversation {
  id: string;
  conversation_type: "direct" | "group";
  name: string | null;
  created_by: string | null;
  last_message_at: string;
  created_at: string;
  updated_at: string;
  participants: {
    user_id: string;
    is_admin: boolean;
    last_read_at: string;
    profile: {
      id: string;
      full_name: string | null;
      avatar_url: string | null;
    };
  }[];
  last_message?: {
    content: string | null;
    message_type: string;
    sender_id: string;
    created_at: string;
  };
  unread_count?: number;
}

export function useConversations() {
  const queryClient = useQueryClient();

  const { data: conversations = [], isLoading, error } = useQuery({
    queryKey: ["chat-conversations"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get all conversations the user participates in
      const { data: participantData, error: participantError } = await supabase
        .from("chat_participants")
        .select("conversation_id")
        .eq("user_id", user.id);

      if (participantError) throw participantError;

      const conversationIds = participantData?.map(p => p.conversation_id) || [];
      if (conversationIds.length === 0) return [];

      // Fetch conversations with participants
      const { data: conversationsData, error: convError } = await supabase
        .from("chat_conversations")
        .select(`
          *,
          participants:chat_participants(
            user_id,
            is_admin,
            last_read_at,
            profile:profiles(id, full_name, avatar_url)
          )
        `)
        .in("id", conversationIds)
        .order("last_message_at", { ascending: false });

      if (convError) throw convError;

      // Get last message and unread count for each conversation
      const conversationsWithMeta = await Promise.all(
        (conversationsData || []).map(async (conv) => {
          // Get last message
          const { data: lastMsgData } = await supabase
            .from("chat_messages")
            .select("content, message_type, sender_id, created_at")
            .eq("conversation_id", conv.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          // Get unread count
          const userParticipant = conv.participants?.find(
            (p: any) => p.user_id === user.id
          );
          const lastReadAt = userParticipant?.last_read_at || conv.created_at;

          const { count } = await supabase
            .from("chat_messages")
            .select("*", { count: "exact", head: true })
            .eq("conversation_id", conv.id)
            .gt("created_at", lastReadAt)
            .neq("sender_id", user.id);

          return {
            ...conv,
            last_message: lastMsgData || undefined,
            unread_count: count || 0,
          };
        })
      );

      return conversationsWithMeta as Conversation[];
    },
    staleTime: 30 * 1000,
  });

  // Subscribe to real-time updates
  useEffect(() => {
    const channel = supabase
      .channel("chat-conversations-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_messages",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_participants",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const createConversation = useMutation({
    mutationFn: async ({
      participantIds,
      name,
      type = "direct",
    }: {
      participantIds: string[];
      name?: string;
      type?: "direct" | "group";
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // For direct conversations, check if one already exists
      if (type === "direct" && participantIds.length === 1) {
        const otherUserId = participantIds[0];
        
        // Find existing direct conversation
        const { data: existingConvs } = await supabase
          .from("chat_participants")
          .select("conversation_id")
          .eq("user_id", user.id);

        for (const conv of existingConvs || []) {
          const { data: convData } = await supabase
            .from("chat_conversations")
            .select("id, conversation_type")
            .eq("id", conv.conversation_id)
            .eq("conversation_type", "direct")
            .single();

          if (convData) {
            const { data: otherParticipant } = await supabase
              .from("chat_participants")
              .select("user_id")
              .eq("conversation_id", convData.id)
              .eq("user_id", otherUserId)
              .single();

            if (otherParticipant) {
              return convData.id; // Return existing conversation
            }
          }
        }
      }

      // Create new conversation
      const { data: newConv, error: convError } = await supabase
        .from("chat_conversations")
        .insert({
          conversation_type: type,
          name: type === "group" ? name : null,
          created_by: user.id,
        })
        .select()
        .single();

      if (convError) throw convError;

      // Add all participants including creator
      const allParticipants = [...new Set([user.id, ...participantIds])];
      const participantInserts = allParticipants.map((userId) => ({
        conversation_id: newConv.id,
        user_id: userId,
        is_admin: userId === user.id,
      }));

      const { error: participantError } = await supabase
        .from("chat_participants")
        .insert(participantInserts);

      if (participantError) throw participantError;

      return newConv.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    },
  });

  return {
    conversations,
    isLoading,
    error,
    createConversation,
  };
}

export function useTotalUnreadCount() {
  const { conversations } = useConversations();
  return conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
}
