import { test, expect } from "@playwright/test";
import { blockAnalytics, checkNoHorizontalOverflow } from "./helpers";

test.describe.serial("Funnel smoke test", () => {
  test.beforeEach(async ({ page }) => {
    await blockAnalytics(page);
  });

  test("landing page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/.+/);
    await checkNoHorizontalOverflow(page);
  });

  test("signup page loads", async ({ page }) => {
    await page.goto("/signup");
    await expect(page).toHaveTitle(/.+/);
    await checkNoHorizontalOverflow(page);
  });

  test("login page loads", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle(/.+/);
    await checkNoHorizontalOverflow(page);
  });

  test("arena page loads", async ({ page }) => {
    await page.goto("/arena");
    await expect(page).toHaveTitle(/.+/);
    await checkNoHorizontalOverflow(page);
  });

  test("leaderboard page loads", async ({ page }) => {
    await page.goto("/leaderboard");
    await expect(page).toHaveTitle(/.+/);
    await checkNoHorizontalOverflow(page);
  });

  test("agent profile page loads", async ({ page }) => {
    await page.goto("/agent/agent-alpha");
    await expect(page).toHaveTitle(/.+/);
    await checkNoHorizontalOverflow(page);
  });
});
