import { expect, test } from "@playwright/test";

test("API health check", async ({ request }) => {
  const response = await request.get("https://nrcseam.techivano.com/health");
  const body = await response.text();
  console.log("Health status:", response.status());
  console.log("Health body:", body.slice(0, 500));
  expect(response.status()).toBe(200);
});

test("tRPC endpoint returns JSON", async ({ request }) => {
  const response = await request.post(
    "https://nrcseam.techivano.com/api/trpc/auth.loginWithPassword",
    {
      headers: { "Content-Type": "application/json" },
      data: { json: { email: "ivanonigeria@gmail.com", password: "ChangeMe123!" } },
    }
  );
  const body = await response.text();
  console.log("Status:", response.status());
  console.log("Body:", body.slice(0, 500));
  expect(response.headers()["content-type"] ?? "").toContain("application/json");
});

test("login page loads", async ({ page }) => {
  await page.goto("https://nrcseam.techivano.com/login");
  await expect(page.getByTestId("login-email-input")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("login-password-input")).toBeVisible();
  console.log("Page URL:", page.url());
});

test("full login flow", async ({ page }) => {
  await page.goto("https://nrcseam.techivano.com/login");
  await page.getByTestId("login-email-input").fill("ivanonigeria@gmail.com");
  await page.getByTestId("login-password-input").fill("ChangeMe123!");

  page.on("response", (response) => {
    if (response.url().includes("trpc")) {
      console.log("tRPC response:", response.status(), response.url());
      response
        .text()
        .then((body) => console.log("tRPC body:", body.substring(0, 500)))
        .catch(() => undefined);
    }
  });

  await page.getByTestId("login-password-submit").click();
  console.log("After click URL:", page.url());
  await expect(page).toHaveURL(/\/app/, { timeout: 60_000 });
});
