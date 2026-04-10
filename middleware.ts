/**
 * Proxies /api/* to App Runner before static/SPA routing.
 * External rewrites in vercel.json can hang on POST; middleware runs first.
 */
export const config = {
  matcher: "/api/:path*",
};

const APP_RUNNER_ORIGIN = "https://vy3xagmuzx.eu-west-1.awsapprunner.com";

export default async function middleware(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const targetUrl = `${APP_RUNNER_ORIGIN}${url.pathname}${url.search}`;

  const headers = new Headers(request.headers);
  headers.set("host", "vy3xagmuzx.eu-west-1.awsapprunner.com");
  headers.set("x-forwarded-host", url.hostname);
  headers.set("x-forwarded-proto", url.protocol.replace(":", "") || "https");

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  return fetch(targetUrl, init);
}
