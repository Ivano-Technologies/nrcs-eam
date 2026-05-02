import type { Page } from "@playwright/test";

export type GuardState = {
  consoleErrors: string[];
  http4xx5xx: string[];
};

export function createGuardState(): GuardState {
  return { consoleErrors: [], http4xx5xx: [] };
}

/** Attach listeners; call once per page before navigation. */
export function attachGuards(page: Page, state: GuardState) {
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      state.consoleErrors.push(msg.text());
    }
  });
  page.on("response", (response) => {
    const s = response.status();
    if (s >= 400) {
      state.http4xx5xx.push(`${s} ${response.url()}`);
    }
  });
}

/** Allowed noisy messages (optional OAuth / tooling). */
export function filterBenignConsoleErrors(errors: string[]): string[] {
  return errors.filter((t) => {
    if (/Download the React DevTools/i.test(t)) return false;
    if (/\[vite\]/i.test(t)) return false;
    if (/ResizeObserver loop limit exceeded/i.test(t)) return false;
    return true;
  });
}

/**
 * Drops dev-only noise from `attachGuards` HTTP lists (still fails on TRPC/API 5xx etc.).
 */
export function filterBenignHttpResponses(entries: string[]): string[] {
  return entries.filter((line) => {
    if (/ 404 /.test(line) && /(?:favicon|apple-touch-icon|site\.webmanifest)(?:[\s?]|$)/i.test(line)) {
      return false;
    }
    if (/ 404 /.test(line) && /\.(?:woff2?|ico|png|jpg|jpeg|gif|svg|webp)(\?|$|")/i.test(line)) return false;
    if (/ 404 /.test(line) && /\/_next\/(?:static|webpack|image)/i.test(line)) return false;
    return true;
  });
}
