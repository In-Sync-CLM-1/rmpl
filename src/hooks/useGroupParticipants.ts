import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useGroupParticipants(conversationId: string | null) {
  const queryClient = useQueryClient();

  const addParticipants = useMutation({
    mutationFn: async (userIds: string[]) => {
      if (!conversationId) throw new Error("No conversation selected");
      
      const inserts = userIds.map(userId => ({
        conversation_id: conversationId,
        user_id: userId,
        is_admin: false,
      }));
      
      const { error } = await supabase
        .from("chat_participants")
        .insert(inserts);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
      toast.success("Members added successfully");
    },
    onError: (error) => {
      console.error("Error adding participants:", error);
      toast.error("Failed to add members");
    },
  });

  const removeParticipant = useMutation({
    mutationFn: async (userId: string) => {
      if (!conversationId) throw new Error("No conversation selected");
      
      const { error } = await supabase
        .from("chat_participants")
        .delete()
        .eq("conversation_id", conversationId)
        .eq("user_id", userId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
      toast.success("Member removed");
    },
    onError: (error) => {
      console.error("Error removing participant:", error);
      toast.error("Failed to remove member");
    },
  });

  const leaveGroup = useMutation({
    mutationFn: async () => {
      if (!conversationId) throw new Error("No conversation selected");
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      
      const { error } = await supabase
        .from("chat_participants")
        .delete()
        .eq("conversation_id", conversationId)
        .eq("user_id", user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
      toast.success("You left the group");
    },
    onError: (error) => {
      console.error("Error leaving group:", error);
      toast.error("Failed to leave group");
    },
  });

  return { addParticipants, removeParticipant, leaveGroup };
}
