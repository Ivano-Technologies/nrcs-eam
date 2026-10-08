import { useAuth } from "@/_core/hooks/useAuth";
import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download } from "lucide-react";
import {
  isPwaInstallable,
  isPwaStandalone,
  promptPwaInstall,
  subscribeInstallPrompt,
} from "@/lib/pwaInstall";

/** localStorage: number of signed in app sessions seen on this device. */
export const PWA_SESSION_COUNT_KEY = "pwa-install-session-count";
/** sessionStorage: set once the current browser session has been counted. */
export const PWA_SESSION_COUNTED_KEY = "pwa-install-session-counted";
/** localStorage: ISO time of the last "Not now". */
export const PWA_DISMISSED_KEY = "pwa-install-dismissed";
/** "Not now" is remembered for 30 days. */
export const PWA_DISMISS_DAYS = 30;
/** The prompt is offered from the second session onwards. */
export const PWA_MIN_SESSIONS = 2;

/**
 * Count this browser session once (sessionStorage guard) and return the running total.
 * Storage failures (private mode, quota) count as a first session so the prompt stays quiet.
 */
export function recordPwaSession(local: Storage, session: Storage): number {
  try {
    const current = Number.parseInt(local.getItem(PWA_SESSION_COUNT_KEY) ?? "0", 10) || 0;
    if (session.getItem(PWA_SESSION_COUNTED_KEY)) return current;
    const next = current + 1;
    local.setItem(PWA_SESSION_COUNT_KEY, String(next));
    session.setItem(PWA_SESSION_COUNTED_KEY, "1");
    return next;
  } catch {
    return 1;
  }
}

/** True when the install prompt may be shown: second session or later, and no "Not now" in the last 30 days. */
export function shouldOfferPwaInstall({
  sessionCount,
  dismissedAt,
  now = Date.now(),
}: {
  sessionCount: number;
  dismissedAt: string | null;
  now?: number;
}): boolean {
  if (sessionCount < PWA_MIN_SESSIONS) return false;
  if (dismissedAt) {
    const dismissedTime = new Date(dismissedAt).getTime();
    if (!Number.isNaN(dismissedTime)) {
      const days = (now - dismissedTime) / (1000 * 60 * 60 * 24);
      if (days < PWA_DISMISS_DAYS) return false;
    }
  }
  return true;
}

/** Presentational card (also used by tests). */
export function PWAInstallCard({
  onInstall,
  onDismiss,
}: {
  onInstall: () => void;
  onDismiss: () => void;
}) {
  return (
    <Card className="border-primary shadow-lg" role="dialog" aria-labelledby="pwa-install-title">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10 shrink-0">
            <Download className="h-5 w-5 text-primary dark:text-[#F87171]" aria-hidden />
          </div>
          <div className="flex-1 min-w-0">
            <h3 id="pwa-install-title" className="font-semibold text-sm mb-1">
              Install NRCS EAM
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              Open it from your home screen and use it offline.
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={onInstall} className="flex-1">
                Install
              </Button>
              <Button size="sm" variant="ghost" onClick={onDismiss}>
                Not now
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * The single PWA install prompt: only when signed in and on `/app/*` (mounted from ProtectedAppSection),
 * from the second session onwards, and not within 30 days of "Not now".
 * Settings keeps `InstallPWAButton` as the permanent entry point.
 */
export function PWAInstallPrompt() {
  const { user } = useAuth();
  const [location] = useLocation();
  const allowInstallUi = !!user && location.startsWith("/app");

  const [showPrompt, setShowPrompt] = useState(false);
  const [installable, setInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const sessionCountRef = useRef(0);

  useEffect(() => {
    if (!allowInstallUi) {
      return;
    }
    sessionCountRef.current = recordPwaSession(window.localStorage, window.sessionStorage);

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

    let dismissedAt: string | null = null;
    try {
      dismissedAt = localStorage.getItem(PWA_DISMISSED_KEY);
    } catch {
      dismissedAt = null;
    }
    if (!shouldOfferPwaInstall({ sessionCount: sessionCountRef.current, dismissedAt })) {
      return;
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
    try {
      localStorage.setItem(PWA_DISMISSED_KEY, new Date().toISOString());
    } catch {
      // Storage unavailable: the prompt simply returns next session.
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-in slide-in-from-bottom-5">
      <PWAInstallCard onInstall={handleInstallClick} onDismiss={handleDismiss} />
    </div>
  );
}
