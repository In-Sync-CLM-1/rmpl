import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

const STORAGE_KEY = "push-notification-permission-asked";
const DISMISS_DURATION_DAYS = 7;

export function PushNotificationPermission() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check if notifications are supported
    if (!("Notification" in window)) {
      return;
    }

    // Don't show if already granted or denied
    if (Notification.permission !== "default") {
      return;
    }

    // Check if we've asked before and should wait
    const lastAsked = localStorage.getItem(STORAGE_KEY);
    if (lastAsked) {
      const lastAskedDate = new Date(parseInt(lastAsked));
      const daysSinceAsked = (Date.now() - lastAskedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceAsked < DISMISS_DURATION_DAYS) {
        return;
      }
    }

    // Show banner after a short delay
    const timer = setTimeout(() => setShowBanner(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const requestPermission = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        toast.success("Notifications enabled! You'll be notified of new messages.");
      } else if (permission === "denied") {
        toast.info("Notifications disabled. You can enable them in browser settings.");
      }
    } catch (error) {
      console.error("Error requesting notification permission:", error);
    }
    setShowBanner(false);
  };

  const dismissBanner = () => {
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <Card className="fixed bottom-20 right-4 z-50 max-w-sm shadow-lg animate-in slide-in-from-bottom-4">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-primary/10 p-2">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 space-y-2">
            <p className="text-sm font-medium">Enable notifications?</p>
            <p className="text-xs text-muted-foreground">
              Get notified when you receive new messages, even when the app is in the background.
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={requestPermission}>
                Enable
              </Button>
              <Button size="sm" variant="ghost" onClick={dismissBanner}>
                Not now
              </Button>
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 shrink-0"
            onClick={dismissBanner}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
