import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { showBrowserNotification } from "@/services/pushNotifications";

export function useChatNotifications() {
  const navigate = useNavigate();
  const location = useLocation();

  // Get current user
  const { data: currentUser } = useQuery({
    queryKey: ["current-user-for-chat-notifications"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase
      .channel("chat-toast-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
        },
        async (payload) => {
          const message = payload.new as {
            id: string;
            sender_id: string;
            conversation_id: string;
            content: string | null;
            message_type: string;
          };
          
          // Don't notify for own messages
          if (message.sender_id === currentUser.id) return;

          // Don't notify if already on that conversation
          if (location.pathname === `/chat/${message.conversation_id}`) return;

          // Fetch sender profile
          const { data: sender } = await supabase
            .from("profiles")
            .select("full_name, avatar_url")
            .eq("id", message.sender_id)
            .single();

          const senderName = sender?.full_name || "Someone";
          
          let preview = "New message";
          if (message.message_type === "file") {
            preview = "Sent a file";
          } else if (message.message_type === "task_share") {
            preview = "Shared a task";
          } else if (message.message_type === "gif") {
            preview = "Sent a GIF";
          } else if (message.content) {
            preview = message.content.length > 50 
              ? message.content.substring(0, 50) + "..." 
              : message.content;
          }

          // Show in-app toast notification
          toast.info(`New message from ${senderName}`, {
            description: preview,
            action: {
              label: "View",
              onClick: () => navigate(`/chat/${message.conversation_id}`),
            },
            duration: 5000,
          });

          // Show browser push notification if app is not focused
          if (document.hidden && "Notification" in window && Notification.permission === "granted") {
            showBrowserNotification({
              title: `New message from ${senderName}`,
              body: preview,
              data: { conversation_id: message.conversation_id },
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser, navigate, location.pathname]);
}
