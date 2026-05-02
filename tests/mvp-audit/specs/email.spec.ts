import { test, expect } from "@playwright/test";
import { loginViaPassword } from "../helpers/e2eAuth";
import { shot } from "../helpers/shot";
import { testUser } from "../fixtures/testUser";

/** Use 127.0.0.1 so Node/Playwright does not resolve `localhost` to ::1 (IPv6) when Mailpit listens on IPv4 only. */
const MAILPIT = "http://127.0.0.1:8025/api/v1";

test.describe.configure({ mode: "serial" });

test.describe("Email — Mailpit (2f)", () => {
  test.beforeEach(async ({ request }) => {
    await request.delete(`${MAILPIT}/messages`);
  });

  test("password reset request sends email (Supabase)", async ({ page, request }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/login");
    await page.getByTestId("login-email-input").fill(testUser.email);
    await page.getByTestId("login-forgot-password").click();
    await expect(page.getByText(/password reset link has been sent/i)).toBeVisible({
      timeout: 25_000,
    });

    await page.waitForTimeout(2000);
    const res = await request.get(`${MAILPIT}/messages`);
    const { messages } = await res.json();
    expect(messages.length).toBeGreaterThan(0);
    const msg = messages[0];
    expect(msg.To[0].Address.toLowerCase()).toContain(testUser.email.split("@")[0].toLowerCase());
    expect(msg.Subject).toMatch(/reset|password|nrcs|supabase/i);
    expect(msg.Snippet || msg.Text || "").not.toBe("");

    await page.goto("http://127.0.0.1:8025");
    await page.waitForLoadState("networkidle");
    await shot(page, "email-password-reset");
  });

  test("admin bulk email notification", async ({ page, request }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await loginViaPassword(page);
    await page.goto("/app/email-notifications");
    await expect(page.getByRole("heading", { name: "Email Notifications" })).toBeVisible();

    await page.getByTestId("email-compose-trigger").click();
    await page.getByTestId("email-subject-input").fill("E2E notification subject");
    await page.getByTestId("email-body-input").fill("<p>E2E body paragraph</p>");
    await page.getByTestId("email-send-submit").click();
    await expect(page.getByTestId("toast-success")).toBeVisible({ timeout: 30_000 });

    await page.waitForTimeout(2000);
    const res = await request.get(`${MAILPIT}/messages`);
    const { messages } = await res.json();
    expect(messages.length).toBeGreaterThan(0);
    const msg = messages[0];
    expect(msg.Subject).toContain("E2E notification");
    expect(msg.Snippet || msg.Text || "").not.toBe("");

    await page.goto("http://127.0.0.1:8025");
    await page.waitForLoadState("networkidle");
    await shot(page, "email-bulk-notification");
  });
});
