/**
 * Optional Umami-compatible analytics: inject script only when Vite env vars are set at build time.
 */
export function initAnalytics(): void {
  const endpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT?.trim();
  const websiteId = import.meta.env.VITE_ANALYTICS_WEBSITE_ID?.trim();

  if (!endpoint || !websiteId) {
    console.log("[analytics] disabled (env not set)");
    return;
  }

  const base = endpoint.replace(/\/+$/, "");
  const script = document.createElement("script");
  script.defer = true;
  script.src = `${base}/umami`;
  script.setAttribute("data-website-id", websiteId);
  document.head.appendChild(script);
  console.log("[analytics] enabled");
}
