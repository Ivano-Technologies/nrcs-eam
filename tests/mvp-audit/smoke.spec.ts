import { test, expect } from "@playwright/test";

test.describe("smoke", () => {
  test("GET /health", async ({ request }) => {
    const res = await request.get("http://127.0.0.1:3000/health");
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json).toEqual({ ok: true });
  });
});
