import { MessageCircle } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTotalUnreadCount } from "@/hooks/useConversations";

export function FloatingChatButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const unreadCount = useTotalUnreadCount();
  
  // Don't show on chat page
  if (location.pathname.startsWith("/chat")) {
    return null;
  }

  return (
    <Button
      onClick={() => navigate("/chat")}
      size="icon"
      className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50 bg-primary hover:bg-primary/90 transition-all hover:scale-105"
    >
      <MessageCircle className="h-6 w-6" />
      {unreadCount > 0 && (
        <Badge 
          variant="destructive" 
          className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </Badge>
      )}
    </Button>
  );
}
