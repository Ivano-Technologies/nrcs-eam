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
