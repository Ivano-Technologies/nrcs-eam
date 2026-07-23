type PostHog = typeof import("posthog-js").default;

let posthogPromise: Promise<PostHog | null> | null = null;

function isProductionAnalytics(): boolean {
  return import.meta.env.VITE_ENV === "production";
}

/**
 * Lazy singleton for posthog-js. Events fired before the module loads may be dropped.
 */
function loadPostHog(): Promise<PostHog | null> {
  if (!isProductionAnalytics()) {
    return Promise.resolve(null);
  }
  if (!posthogPromise) {
    posthogPromise = import("posthog-js")
      .then(({ default: posthog }) => {
        posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
          api_host: import.meta.env.VITE_POSTHOG_HOST ?? "https://eu.i.posthog.com",
          person_profiles: "never",
          capture_pageview: true,
          capture_pageleave: true,
          session_recording: {
            maskAllInputs: true,
            maskTextSelector: "[data-sensitive]",
          },
          loaded: (ph) => {
            if (import.meta.env.DEV) ph.opt_out_capturing();
          },
        });
        return posthog;
      })
      .catch((err) => {
        console.error("[posthog] failed to load", err);
        posthogPromise = null;
        return null;
      });
  }
  return posthogPromise;
}

function scheduleIdle(callback: () => void): void {
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(() => callback(), { timeout: 3000 });
  } else {
    setTimeout(callback, 1);
  }
}

/** Kick off PostHog after first paint; does not block the entry graph. */
export function initPostHog(): void {
  if (!isProductionAnalytics()) return;
  scheduleIdle(() => {
    void loadPostHog();
  });
}

export function identifyUser(userId: string, role: string, facilityCode: string): void {
  if (!isProductionAnalytics()) return;
  void loadPostHog().then((ph) => {
    ph?.identify(userId, { role, facilityCode });
  });
}

export function resetPostHog(): void {
  // Only reset if already loading/loaded — do not pull posthog into the graph just to reset.
  if (!posthogPromise) return;
  void posthogPromise.then((ph) => {
    ph?.reset();
  });
}
