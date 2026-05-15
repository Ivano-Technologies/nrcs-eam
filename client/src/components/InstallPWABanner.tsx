import { useEffect, useMemo, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  isPwaInstallable,
  isPwaStandalone,
  promptPwaInstall,
  subscribeInstallPrompt,
} from "@/lib/pwaInstall";

const DISMISS_KEY = "pwa_install_banner_dismissed";

export function InstallPWABanner() {
  const [installable, setInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");

    const sync = () => {
      setIsInstalled(isPwaStandalone());
      setInstallable(isPwaInstallable());
    };
    sync();
    return subscribeInstallPrompt(sync);
  }, []);

  const visible = useMemo(
    () => installable && !isInstalled && !dismissed,
    [installable, isInstalled, dismissed]
  );

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
              const outcome = await promptPwaInstall();
              if (outcome === "accepted") {
                setIsInstalled(true);
              }
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
