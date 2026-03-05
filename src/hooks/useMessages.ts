import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useCallback } from "react";

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  message_type: "text" | "task_share" | "file";
  task_id: string | null;
  project_task_id: string | null;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  is_edited: boolean;
  reply_to_id: string | null;
  created_at: string;
  updated_at: string;
  sender?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  reply_to?: {
    id: string;
    content: string | null;
    message_type: string;
    sender: {
      full_name: string | null;
    } | null;
  } | null;
  task?: {
    id: string;
    task_name: string;
    description: string | null;
    status: string;
    due_date: string;
    priority: string | null;
  };
  project_task?: {
    id: string;
    task_name: string;
    description: string | null;
    status: string;
    due_date: string;
    priority: string | null;
    project?: {
      project_name: string | null;
    };
  };
}

export function useMessages(conversationId: string | null) {
  const queryClient = useQueryClient();

  const { data: messages = [], isLoading, error } = useQuery({
    queryKey: ["chat-messages", conversationId],
    queryFn: async () => {
      if (!conversationId) return [];

      const { data, error } = await supabase
        .from("chat_messages")
        .select(`
          *,
          sender:profiles!chat_messages_sender_id_fkey(id, full_name, avatar_url),
          task:general_tasks(id, task_name, description, status, due_date, priority),
          project_task:project_tasks(id, task_name, description, status, due_date, priority, project:projects(project_name)),
          reply_to:chat_messages!reply_to_id(id, content, message_type, sender:profiles!chat_messages_sender_id_fkey(full_name))
        `)
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as ChatMessage[];
    },
    enabled: !!conversationId,
    staleTime: 5 * 1000,
    refetchOnWindowFocus: true,
  });

  // Subscribe to real-time messages
  useEffect(() => {
    if (!conversationId) return;

    console.log("[Chat] Setting up realtime subscription for conversation:", conversationId);

    const channel = supabase
      .channel(`chat-messages-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          console.log("[Chat] Received realtime INSERT event:", payload);
          
          // Fetch the full message with relations
          const { data: newMessage, error } = await supabase
            .from("chat_messages")
            .select(`
              *,
              sender:profiles!chat_messages_sender_id_fkey(id, full_name, avatar_url),
              task:general_tasks(id, task_name, description, status, due_date, priority),
              project_task:project_tasks(id, task_name, description, status, due_date, priority, project:projects(project_name)),
              reply_to:chat_messages!reply_to_id(id, content, message_type, sender:profiles!chat_messages_sender_id_fkey(full_name))
            `)
            .eq("id", (payload.new as any).id)
            .single();

          if (error) {
            console.error("[Chat] Error fetching new message:", error);
            // Fall back to invalidating the query
            queryClient.invalidateQueries({ queryKey: ["chat-messages", conversationId] });
            return;
          }

          if (newMessage) {
            console.log("[Chat] Adding new message to cache:", newMessage);
            queryClient.setQueryData<ChatMessage[]>(
              ["chat-messages", conversationId],
              (old) => {
                // Avoid duplicates
                const exists = old?.some(m => m.id === newMessage.id);
                if (exists) return old;
                return [...(old || []), newMessage as ChatMessage];
              }
            );
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          // Refetch on update (for edits)
          queryClient.invalidateQueries({ queryKey: ["chat-messages", conversationId] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "chat_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["chat-messages", conversationId] });
        }
      )
      .subscribe((status) => {
        console.log("[Chat] Realtime subscription status:", status);
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn("[Chat] Realtime channel error, invalidating query to refetch");
          queryClient.invalidateQueries({ queryKey: ["chat-messages", conversationId] });
        }
      });

    return () => {
      console.log("[Chat] Cleaning up realtime subscription for:", conversationId);
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  const sendMessage = useMutation({
    mutationFn: async ({
      content,
      messageType = "text",
      taskId,
      projectTaskId,
      fileUrl,
      fileName,
      fileSize,
      replyToId,
    }: {
      content?: string;
      messageType?: "text" | "task_share" | "file";
      taskId?: string;
      projectTaskId?: string;
      fileUrl?: string;
      fileName?: string;
      fileSize?: number;
      replyToId?: string;
    }) => {
      if (!conversationId) throw new Error("No conversation selected");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get user profile for optimistic update
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .eq("id", user.id)
        .single();

      const { data, error } = await supabase
        .from("chat_messages")
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content,
          message_type: messageType,
          task_id: taskId || null,
          project_task_id: projectTaskId || null,
          file_url: fileUrl || null,
          file_name: fileName || null,
          file_size: fileSize || null,
          reply_to_id: replyToId || null,
        })
        .select()
        .single();

      if (error) throw error;
      
      // Return message with sender info for cache update
      return {
        ...data,
        sender: profile,
      };
    },
    onMutate: async ({ content, messageType = "text", fileUrl, fileName, fileSize }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["chat-messages", conversationId] });

      // Snapshot the previous value
      const previousMessages = queryClient.getQueryData<ChatMessage[]>(["chat-messages", conversationId]);

      // Get current user for optimistic update
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { previousMessages };

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .eq("id", user.id)
        .single();

      // Create optimistic message
      const optimisticMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        conversation_id: conversationId!,
        sender_id: user.id,
        content: content || null,
        message_type: messageType,
        task_id: null,
        project_task_id: null,
        file_url: fileUrl || null,
        file_name: fileName || null,
        file_size: fileSize || null,
        is_edited: false,
        reply_to_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sender: profile || undefined,
      };

      // Optimistically add the new message
      queryClient.setQueryData<ChatMessage[]>(
        ["chat-messages", conversationId],
        (old) => [...(old || []), optimisticMessage]
      );

      return { previousMessages, optimisticId: optimisticMessage.id };
    },
    onSuccess: (data, _variables, context) => {
      // Replace optimistic message with real one
      queryClient.setQueryData<ChatMessage[]>(
        ["chat-messages", conversationId],
        (old) => {
          if (!old) return [data as ChatMessage];
          return old.map(msg => 
            msg.id === context?.optimisticId ? (data as ChatMessage) : msg
          );
        }
      );
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    },
    onError: (_error, _variables, context) => {
      // Rollback on error
      if (context?.previousMessages) {
        queryClient.setQueryData(["chat-messages", conversationId], context.previousMessages);
      }
    },
  });

  const markAsRead = useCallback(async () => {
    if (!conversationId) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("chat_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id);

    queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
  }, [conversationId, queryClient]);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    markAsRead,
  };
}
