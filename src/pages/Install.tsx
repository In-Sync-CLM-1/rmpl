import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Smartphone, Check, Share, MoreVertical } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Detect Android
    const android = /Android/.test(navigator.userAgent);
    setIsAndroid(android);

    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Listen for app installed event
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  if (isInstalled) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/10 to-background">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl">App Installed!</CardTitle>
            <CardDescription>
              RMPL CRM is now installed on your device. You can access it from your home screen.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/10 to-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <img src="/rmpl-logo.png" alt="RMPL Logo" className="h-20 w-20 object-contain" />
          </div>
          <CardTitle className="text-2xl">Install RMPL CRM</CardTitle>
          <CardDescription>
            Install the app on your device for quick access and a better experience
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Features list */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Smartphone className="h-4 w-4 text-primary" />
              </div>
              <span>Works offline with cached data</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Download className="h-4 w-4 text-primary" />
              </div>
              <span>Quick access from home screen</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Check className="h-4 w-4 text-primary" />
              </div>
              <span>Full-screen app experience</span>
            </div>
          </div>

          {/* Install button for supported browsers */}
          {deferredPrompt && (
            <Button onClick={handleInstallClick} className="w-full" size="lg">
              <Download className="mr-2 h-5 w-5" />
              Install App
            </Button>
          )}

          {/* iOS instructions */}
          {isIOS && !deferredPrompt && (
            <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
              <p className="font-medium text-sm">To install on iPhone/iPad:</p>
              <ol className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <span className="font-medium">1.</span>
                  <span>
                    Tap the Share button <Share className="inline h-4 w-4" /> in Safari
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-medium">2.</span>
                  <span>Scroll down and tap "Add to Home Screen"</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-medium">3.</span>
                  <span>Tap "Add" to confirm</span>
                </li>
              </ol>
            </div>
          )}

          {/* Android Chrome instructions */}
          {isAndroid && !deferredPrompt && (
            <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
              <p className="font-medium text-sm">To install on Android:</p>
              <ol className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <span className="font-medium">1.</span>
                  <span>
                    Tap the menu button <MoreVertical className="inline h-4 w-4" /> in Chrome
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-medium">2.</span>
                  <span>Tap "Install app" or "Add to Home screen"</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-medium">3.</span>
                  <span>Tap "Install" to confirm</span>
                </li>
              </ol>
            </div>
          )}

          {/* Desktop instructions */}
          {!isIOS && !isAndroid && !deferredPrompt && (
            <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
              <p className="font-medium text-sm">To install on desktop:</p>
              <ol className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <span className="font-medium">1.</span>
                  <span>Look for the install icon in your browser's address bar</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-medium">2.</span>
                  <span>Click "Install" when prompted</span>
                </li>
              </ol>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Install;
