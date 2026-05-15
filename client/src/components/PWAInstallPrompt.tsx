import { useAuth } from "@/_core/hooks/useAuth";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, X } from "lucide-react";
import {
  isPwaInstallable,
  isPwaStandalone,
  promptPwaInstall,
  subscribeInstallPrompt,
} from "@/lib/pwaInstall";

/**
 * PWA install UI — only when logged in and on `/app/*` (mounted from ProtectedAppSection).
 */
export function PWAInstallPrompt() {
  const { user } = useAuth();
  const [location] = useLocation();
  const allowInstallUi = !!user && location.startsWith("/app");

  const [showPrompt, setShowPrompt] = useState(false);
  const [installable, setInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (!allowInstallUi) {
      return;
    }

    const sync = () => {
      setIsInstalled(isPwaStandalone());
      setInstallable(isPwaInstallable());
    };
    sync();
    return subscribeInstallPrompt(sync);
  }, [allowInstallUi]);

  useEffect(() => {
    if (!allowInstallUi || isInstalled || !installable) {
      return;
    }

    const dismissed = localStorage.getItem("pwa-install-dismissed");
    if (dismissed) {
      const dismissedDate = new Date(dismissed);
      const daysSinceDismissed =
        (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) {
        return;
      }
    }

    const timer = window.setTimeout(() => setShowPrompt(true), 3000);
    return () => window.clearTimeout(timer);
  }, [allowInstallUi, isInstalled, installable]);

  if (!allowInstallUi || isInstalled || !showPrompt || !installable) {
    return null;
  }

  const handleInstallClick = async () => {
    const outcome = await promptPwaInstall();
    if (outcome === "accepted" || outcome === "dismissed") {
      setShowPrompt(false);
    }
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
