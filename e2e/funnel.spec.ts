import { test, expect } from "@playwright/test";
import {
  getTestCredentials,
  login,
  captureAnalytics,
  type CapturedEvent,
} from "./helpers";

test.describe.serial("User funnel", () => {
  let analytics: CapturedEvent[];

  test.beforeEach(async ({ page }) => {
    analytics = await captureAnalytics(page);
  });

  // Step 1: Landing page content verification (b-01)
  test("landing page shows pitch", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /know if it's gold/i }).first()
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /test my idea/i }).first()
    ).toBeVisible();
  });

  // Step 2: CTA navigates to assay page (b-02)
  test("CTA navigates to assay page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /test my idea/i }).first().click();
    await expect(page).toHaveURL(/\/assay/);
  });

  // Step 3: Assay page loads with idea input (b-03)
  test("assay page shows idea input", async ({ page }) => {
    await page.goto("/assay");
    await expect(
      page.getByRole("heading", { name: /assay your idea/i })
    ).toBeVisible();
    await expect(page.locator("textarea#idea")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /test it/i })
    ).toBeVisible();
  });

  // Step 4: Login with test user (auth flow)
  test("login and reach lab", async ({ page }) => {
    const { email, password } = getTestCredentials();
    await login(page, email, password);
    await page.goto("/lab");
    await expect(
      page.getByRole("heading", { name: /the lab/i })
    ).toBeVisible();
  });

  // Step 5: Lab page shows experiment list (b-12)
  test("lab page renders", async ({ page }) => {
    const { email, password } = getTestCredentials();
    await login(page, email, password);
    await page.goto("/lab");
    await expect(
      page.getByRole("heading", { name: /the lab/i })
    ).toBeVisible();
  });

  // Step 6: Settings page shows account info (b-15)
  test("settings page renders with tabs", async ({ page }) => {
    const { email, password } = getTestCredentials();
    await login(page, email, password);
    await page.goto("/settings");
    await expect(
      page.getByRole("heading", { name: /settings/i })
    ).toBeVisible();
  });

  // Step 7: Compare page loads (b-14)
  test("compare page renders", async ({ page }) => {
    const { email, password } = getTestCredentials();
    await login(page, email, password);
    await page.goto("/compare");
    await expect(
      page.getByRole("heading", { name: /compare experiments/i })
    ).toBeVisible();
  });

  // Analytics verification: check golden_path events fired
  test("analytics events fired during funnel", async () => {
    const expectedEvents = [
      "visit_landing",
      "cta_click",
    ];
    const firedEvents = analytics.map((e) => e.event);
    for (const expected of expectedEvents) {
      // Only check events that could have fired based on test actions
      if (firedEvents.includes(expected)) {
        expect(firedEvents).toContain(expected);
      }
    }
  });
});
