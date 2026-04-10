// Node.js serverless proxy to App Runner — lives at /api/* so Vercel matches this
// function before the SPA rewrite (no /api → /api/proxy rewrite needed).
const APP_RUNNER_URL = "https://vy3xagmuzx.eu-west-1.awsapprunner.com";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  "http2-settings",
]);

function buildForwardHeaders(req) {
  /** @type {Record<string, string>} */
  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    const lower = key.toLowerCase();
    if (HOP_BY_HOP.has(lower) || lower === "content-length") continue;
    headers[key] = Array.isArray(value) ? value.join(", ") : String(value);
  }
  headers.host = "vy3xagmuzx.eu-west-1.awsapprunner.com";
  headers["x-forwarded-host"] = "nrcseam.techivano.com";
  headers["x-forwarded-proto"] = "https";
  return headers;
}

export default async function handler(req, res) {
  const rawUrl = req.url || "/";
  const u = new URL(rawUrl, "http://localhost");
  let suffix = u.pathname.startsWith("/api")
    ? u.pathname.slice("/api".length)
    : u.pathname;
  if (suffix === "" || suffix === "/") suffix = "/";
  else if (!suffix.startsWith("/")) suffix = "/" + suffix;
  const pathAndQuery = suffix + u.search;

  console.log("[proxy-debug] req.url:", req.url);
  console.log("[proxy-debug] method:", req.method);
  console.log(
    "[proxy-debug] targetUrl will be:",
    "https://vy3xagmuzx.eu-west-1.awsapprunner.com" + "/api" + pathAndQuery
  );

  const targetUrl = APP_RUNNER_URL + "/api" + pathAndQuery;

  try {
    const headers = buildForwardHeaders(req);

    const body =
      req.method !== "GET" && req.method !== "HEAD"
        ? await new Promise((resolve, reject) => {
            const chunks = [];
            req.on("data", (chunk) => chunks.push(chunk));
            req.on("end", () => resolve(Buffer.concat(chunks)));
            req.on("error", reject);
          })
        : undefined;

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body:
        req.method !== "GET" && req.method !== "HEAD" ? body : undefined,
    });

    const responseBody = await response.arrayBuffer();

    response.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (!["transfer-encoding", "connection"].includes(lower)) {
        res.setHeader(key, value);
      }
    });

    res.status(response.status).send(Buffer.from(responseBody));
  } catch (error) {
    console.error("[proxy] Error:", error);
    res
      .status(502)
      .json({ error: "Proxy error", detail: String(error?.message ?? error) });
  }
}

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
    externalResolver: true,
  },
};
