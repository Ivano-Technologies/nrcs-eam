import { useEffect, useState } from "react";
import { Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getDeferredInstallPrompt,
  isPwaInstallable,
  isPwaStandalone,
  promptPwaInstall,
  subscribeInstallPrompt,
} from "@/lib/pwaInstall";

export function InstallPWAButton() {
  const [installable, setInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const sync = () => {
      setIsInstalled(isPwaStandalone());
      setInstallable(isPwaInstallable());
    };
    sync();
    return subscribeInstallPrompt(sync);
  }, []);

  const handleInstall = async () => {
    if (getDeferredInstallPrompt()) {
      const outcome = await promptPwaInstall();
      if (outcome === "accepted") {
        setIsInstalled(true);
        setInstallable(false);
      }
      return;
    }

    const ua = navigator.userAgent;
    const isIOS =
      /iPad|iPhone|iPod/.test(ua) &&
      !(navigator as Navigator & { MSStream?: unknown }).MSStream;
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
        "Chrome has not offered install yet. Check that:\n\n" +
        "- You are on HTTPS (not localhost unless testing)\n" +
        "- The site is not already installed\n" +
        "- DevTools → Application → Manifest shows no install errors\n\n" +
        "When installable, use the install icon in the address bar or click Install here again.";
    }
    alert(message);
  };

  if (isInstalled) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600" data-testid="install-pwa-installed">
        <Check className="h-4 w-4" />
        App installed — open from your home screen or desktop
      </div>
    );
  }

  return (
    <Button
      onClick={handleInstall}
      variant="default"
      data-testid="install-pwa-btn"
      disabled={!installable}
    >
      <Download className="mr-2 h-4 w-4" />
      {installable ? "Install NRCS EAM App" : "Install (waiting for browser…)"}
    </Button>
  );
}
