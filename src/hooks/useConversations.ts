import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { useBusinessHours } from "./useBusinessHours";

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
  const { liveUpdatesActive } = useBusinessHours();

  const { data: conversations = [], isLoading, error } = useQuery({
    queryKey: ["chat-conversations"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Single RPC call gets last_message + unread_count for all conversations
      const { data: meta, error: metaError } = await supabase
        .rpc("get_conversation_meta", { p_user_id: user.id });

      if (metaError) throw metaError;
      if (!meta || meta.length === 0) return [];

      const conversationIds = meta.map((m: any) => m.conversation_id);

      // Fetch conversations with participants (single query)
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

      // Merge metadata from RPC
      const metaMap = new Map(
        meta.map((m: any) => [m.conversation_id, m])
      );

      return (conversationsData || []).map((conv) => {
        const m = metaMap.get(conv.id) as any;
        return {
          ...conv,
          last_message: m?.last_msg_created_at
            ? {
                content: m.last_msg_content,
                message_type: m.last_msg_type || "text",
                sender_id: m.last_msg_sender_id || "",
                created_at: m.last_msg_created_at,
              }
            : undefined,
          unread_count: Number(m?.unread_count) || 0,
        };
      }) as Conversation[];
    },
    staleTime: 30 * 1000,
  });

  // Subscribe to real-time updates
  useEffect(() => {
    if (!liveUpdatesActive) return;
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
  }, [queryClient, liveUpdatesActive]);

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
