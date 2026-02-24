import { test, expect } from "@playwright/test";
import { blockAnalytics } from "./helpers";

test.describe.serial("Funnel smoke test", () => {
  test.beforeEach(async ({ page }) => {
    await blockAnalytics(page);
  });

  test("landing page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/.+/);
  });

  test("signup page loads", async ({ page }) => {
    await page.goto("/signup");
    await expect(page).toHaveTitle(/.+/);
  });

  test("login page loads", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle(/.+/);
  });

  test("arena page loads", async ({ page }) => {
    await page.goto("/arena");
    await expect(page).toHaveTitle(/.+/);
  });

  test("leaderboard page loads", async ({ page }) => {
    await page.goto("/leaderboard");
    await expect(page).toHaveTitle(/.+/);
  });

  test("agent profile page loads", async ({ page }) => {
    await page.goto("/agent/agent-001");
    await expect(page).toHaveTitle(/.+/);
  });

  // Page-load smoke tests only — see funnel.spec.ts for full user journey tests
});
