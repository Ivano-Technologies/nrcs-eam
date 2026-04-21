import { useEffect, useState } from "react";
import { Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function InstallPWAButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    if (import.meta.env.DEV || window.location.hostname === "nrcseam.techivano.com") {
      console.log("[PWA Debug]", {
        standalone: window.matchMedia("(display-mode: standalone)").matches,
        serviceWorkerSupported: "serviceWorker" in navigator,
        serviceWorkerController: navigator.serviceWorker?.controller,
        isSecureContext: window.isSecureContext,
      });
    }

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    if (isIOS) {
      setIsInstallable(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };
    const installedHandler = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        alert(
          "To install NRCS EAM on iOS:\n\n" +
            "1. Tap the Share button (square with arrow up)\n" +
            "2. Scroll down and tap 'Add to Home Screen'\n" +
            "3. Tap 'Add' in the top right"
        );
      }
      return;
    }

    await deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;
    if (choiceResult.outcome === "accepted") {
      setIsInstalled(true);
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  if (isInstalled) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600">
        <Check className="h-4 w-4" />
        App installed
      </div>
    );
  }

  if (!isInstallable) {
    return (
      <div className="text-sm text-muted-foreground">
        This app cannot be installed on your current browser. Try Chrome, Edge, or Safari on mobile.
      </div>
    );
  }

  return (
    <Button onClick={handleInstall} variant="default" data-testid="install-pwa-btn">
      <Download className="mr-2 h-4 w-4" />
      Install NRCS EAM App
    </Button>
  );
}
