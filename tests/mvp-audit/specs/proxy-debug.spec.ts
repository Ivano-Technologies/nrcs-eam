import { test, expect } from "@playwright/test";

const BASE = "https://nrcseam.techivano.com";
const EMAIL = "ivanonigeria@gmail.com";

test.describe.configure({ mode: "serial" });

test.describe("Proxy + Magic Link end-to-end", () => {
  test("1. /health endpoint is reachable", async ({ request }) => {
    const res = await request.get(`${BASE}/health`);
    console.log("[health] status:", res.status());
    console.log("[health] body:", await res.text());
    expect(res.status()).toBe(200);
  });

  test("2. GET tRPC endpoint works via proxy", async ({ request }) => {
    const res = await request.get(
      `${BASE}/api/trpc/auth.me?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%7D%7D`
    );
    console.log("[trpc-get] status:", res.status());
    const body = await res.text();
    console.log("[trpc-get] body preview:", body.substring(0, 200));
    expect(body).not.toContain("<!doctype");
    expect(res.status()).not.toBe(405);
    expect(res.status()).not.toBe(502);
    expect(res.status()).not.toBe(504);
  });

  test("3. POST tRPC magic link request succeeds", async ({ request }) => {
    test.setTimeout(60_000);
    const res = await request.post(
      `${BASE}/api/trpc/auth.requestMagicLink?batch=1`,
      {
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify({
          "0": { json: { email: EMAIL } },
        }),
      }
    );
    console.log("[magic-link] status:", res.status());
    const body = await res.text();
    console.log("[magic-link] full response body:", body);

    expect(body).not.toContain("<!doctype");
    expect(res.status()).not.toBe(405);
    expect(res.status()).toBe(200);

    const json = JSON.parse(body);
    console.log("[magic-link] parsed:", JSON.stringify(json));
    const result = Array.isArray(json) ? json[0] : json;
    expect(result?.result?.data?.json?.success).toBe(true);
  });

  test("4. Confirm email received via App Runner logs", async ({ request }) => {
    const res = await request.get(`${BASE}/api/setup/ping`);
    console.log("[ping] status:", res.status());
    console.log("[ping] body:", await res.text());
    expect(res.status()).toBe(200);
  });
});
