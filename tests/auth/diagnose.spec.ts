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
  await expect(page.locator("text=Log in to NRCS EAM")).toBeVisible();
  console.log("Page URL:", page.url());
});

test("full login flow", async ({ page }) => {
  await page.goto("https://nrcseam.techivano.com/login");
  await page.fill('input[type="email"]', "ivanonigeria@gmail.com");
  await page.fill('input[type="password"]', "ChangeMe123!");

  page.on("response", (response) => {
    if (response.url().includes("trpc")) {
      console.log("tRPC response:", response.status(), response.url());
      response
        .text()
        .then((body) => console.log("tRPC body:", body.substring(0, 500)))
        .catch(() => undefined);
    }
  });

  await page.click('button:has-text("Sign in")');
  await page.waitForTimeout(3000);
  console.log("After click URL:", page.url());
  await expect(page).toHaveURL(/\/app/, { timeout: 10000 });
});
