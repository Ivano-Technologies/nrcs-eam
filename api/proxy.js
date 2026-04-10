/**
 * Proxies /api/* to App Runner with correct Host / forwarded headers.
 * Invoked from root middleware.ts so the original pathname (e.g. /api/trpc/...) is preserved.
 */
export const config = {
  runtime: "edge",
};

export default async function proxy(request) {
  const url = new URL(request.url);

  const appRunnerUrl = "https://vy3xagmuzx.eu-west-1.awsapprunner.com";
  const targetUrl = appRunnerUrl + url.pathname + url.search;

  const response = await fetch(targetUrl, {
    method: request.method,
    headers: {
      ...Object.fromEntries(request.headers),
      host: "vy3xagmuzx.eu-west-1.awsapprunner.com",
      "x-forwarded-host": "nrcseam.techivano.com",
      "x-forwarded-proto": "https",
    },
    body:
      request.method !== "GET" && request.method !== "HEAD"
        ? await request.arrayBuffer()
        : undefined,
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
