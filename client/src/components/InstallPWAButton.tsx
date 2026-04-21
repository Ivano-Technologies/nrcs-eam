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
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true
    ) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsReady(true);
    };
    const installedHandler = () => {
      setIsInstalled(true);
      setIsReady(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);
    setIsReady(true);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setIsInstalled(true);
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.error("Install prompt failed:", err);
      }
      return;
    }

    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    const isAndroid = /Android/.test(ua);

    let message = "";
    if (isIOS) {
      message =
        "To install NRCS EAM on iOS:\n\n" +
        "1. Tap the Share button (square with arrow up)\n" +
        "2. Scroll down and tap 'Add to Home Screen'\n" +
        "3. Tap 'Add' in the top right";
    } else if (isAndroid) {
      message =
        "To install NRCS EAM on Android:\n\n" +
        "1. Tap the three-dot menu in Chrome\n" +
        "2. Tap 'Install app' or 'Add to Home screen'\n" +
        "3. Confirm installation";
    } else {
      message =
        "To install NRCS EAM on your desktop:\n\n" +
        "Chrome / Edge:\n" +
        "- Look for the install icon in the address bar (right side)\n" +
        "- Or click the three-dot menu -> 'Install NRCS EAM'\n\n" +
        "Safari (Mac):\n" +
        "- Click File -> Add to Dock\n\n" +
        "If the option isn't showing, interact with the app for a few minutes first - browsers require engagement before offering install.";
    }
    alert(message);
  };

  if (isInstalled) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600" data-testid="install-pwa-installed">
        <Check className="h-4 w-4" />
        App installed - open from your home screen or desktop
      </div>
    );
  }

  return (
    <Button onClick={handleInstall} variant="default" data-testid="install-pwa-btn" disabled={!isReady}>
      <Download className="mr-2 h-4 w-4" />
      Install NRCS EAM App
    </Button>
  );
}
