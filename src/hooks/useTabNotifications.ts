import { useEffect } from "react";
import { useTotalUnreadCount } from "./useConversations";

const BASE_TITLE = "RMPL OPM";

export function useTabNotifications() {
  const unreadCount = useTotalUnreadCount();

  useEffect(() => {
    // Update document title with unread count
    if (unreadCount > 0) {
      document.title = `(${unreadCount}) ${BASE_TITLE}`;
    } else {
      document.title = BASE_TITLE;
    }

    // Cleanup: reset title when component unmounts
    return () => {
      document.title = BASE_TITLE;
    };
  }, [unreadCount]);

  return unreadCount;
}
