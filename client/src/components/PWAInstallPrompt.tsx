import { useAuth } from "@/_core/hooks/useAuth";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * PWA install UI — only when logged in and on `/app/*` (mounted from ProtectedAppSection).
 */
export function PWAInstallPrompt() {
  const { user } = useAuth();
  const [location] = useLocation();
  const allowInstallUi = !!user && location.startsWith("/app");

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (!allowInstallUi) {
      return;
    }

    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    ) {
      setIsInstalled(true);
      return;
    }

    const dismissed = localStorage.getItem("pwa-install-dismissed");
    if (dismissed) {
      const dismissedDate = new Date(dismissed);
      const now = new Date();
      const daysSinceDismissed =
        (now.getTime() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceDismissed < 7) {
        return;
      }
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    };
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [allowInstallUi]);

  if (!allowInstallUi || isInstalled || !showPrompt || !deferredPrompt) {
    return null;
  }

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      return;
    }

    await deferredPrompt.prompt();

    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      console.log("User accepted the install prompt");
    } else {
      console.log("User dismissed the install prompt");
    }

    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem("pwa-install-dismissed", new Date().toISOString());
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-in slide-in-from-bottom-5">
      <Card className="border-primary shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10 shrink-0">
              <Download className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm mb-1">Install NRCS EAM App</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Install this app on your device for quick access and offline use
              </p>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleInstallClick} className="flex-1">
                  Install
                </Button>
                <Button size="sm" variant="ghost" onClick={handleDismiss}>
                  Later
                </Button>
              </div>
            </div>
            <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={handleDismiss}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
