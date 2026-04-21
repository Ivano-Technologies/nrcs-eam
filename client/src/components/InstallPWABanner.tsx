import { useEffect, useMemo, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const DISMISS_KEY = "pwa_install_banner_dismissed";

export function InstallPWABanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const visible = useMemo(() => isInstallable && !isInstalled && !dismissed, [isInstallable, isInstalled, dismissed]);
  if (!visible) return null;

  return (
    <div className="border-b bg-muted/40 px-4 py-2">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Install NRCS EAM for faster access and a standalone app experience.
        </p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={async () => {
              if (!deferredPrompt) return;
              await deferredPrompt.prompt();
              const result = await deferredPrompt.userChoice;
              if (result.outcome === "accepted") {
                setIsInstalled(true);
              }
              setDeferredPrompt(null);
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            Install App
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Dismiss install banner"
            onClick={() => {
              setDismissed(true);
              localStorage.setItem(DISMISS_KEY, "1");
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
