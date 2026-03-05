import { supabase } from "@/integrations/supabase/client";

interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Check if running on native platform - lazy evaluation
 */
function isNativePlatform(): boolean {
  try {
    const { Capacitor } = require("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * Initialize push notifications for native platforms
 */
export async function initializePushNotifications(): Promise<void> {
  if (!isNativePlatform()) {
    console.log("Push notifications: Web platform detected, using browser notifications");
    return;
  }

  try {
    // Dynamic import to avoid issues on web
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const { Capacitor } = await import("@capacitor/core");

    // Request permission
    const permissionStatus = await PushNotifications.requestPermissions();
    
    if (permissionStatus.receive !== "granted") {
      console.log("Push notification permission not granted");
      return;
    }

    // Register with APNs/FCM
    await PushNotifications.register();

    // Listen for registration token
    PushNotifications.addListener("registration", async (token) => {
      console.log("Push registration token:", token.value);
      await saveDeviceToken(token.value, Capacitor.getPlatform());
    });

    // Listen for registration errors
    PushNotifications.addListener("registrationError", (error) => {
      console.error("Push registration error:", error);
    });

    // Listen for push notifications received
    PushNotifications.addListener("pushNotificationReceived", (notification) => {
      console.log("Push notification received:", notification);
    });

    // Listen for push notification action (user tapped)
    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      console.log("Push notification action performed:", action);
      const data = action.notification.data;
      if (data?.conversation_id) {
        window.location.href = `/chat/${data.conversation_id}`;
      }
    });

  } catch (error) {
    console.error("Failed to initialize push notifications:", error);
  }
}

/**
 * Save device token to database for push notifications
 */
async function saveDeviceToken(token: string, platform: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await (supabase
      .from("push_subscriptions" as any)
      .upsert(
        {
          user_id: user.id,
          platform,
          token,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,platform",
        }
      ) as any);

    if (error) {
      console.error("Failed to save push token:", error);
    } else {
      console.log("Push token saved successfully");
    }
  } catch (error) {
    console.error("Error saving device token:", error);
  }
}

/**
 * Show a browser notification (for web)
 */
export function showBrowserNotification(payload: PushNotificationPayload): void {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return;
  }

  if (Notification.permission !== "granted") {
    return;
  }

  try {
    const notification = new Notification(payload.title, {
      body: payload.body,
      icon: "/favicon.png",
      badge: "/favicon.png",
      tag: payload.data?.conversation_id || "chat-notification",
      requireInteraction: false,
    });

    notification.onclick = () => {
      window.focus();
      if (payload.data?.conversation_id) {
        window.location.href = `/chat/${payload.data.conversation_id}`;
      }
      notification.close();
    };

    setTimeout(() => notification.close(), 5000);
  } catch (error) {
    console.error("Failed to show browser notification:", error);
  }
}

/**
 * Check if push notifications are available
 */
export function isPushAvailable(): boolean {
  if (isNativePlatform()) {
    return true;
  }
  return typeof window !== "undefined" && "Notification" in window;
}

/**
 * Get current notification permission status
 */
export function getNotificationPermission(): NotificationPermission | "unknown" {
  if (isNativePlatform()) {
    return "unknown";
  }
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }
  return Notification.permission;
}
