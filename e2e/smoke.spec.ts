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

  test("variant cultivation loads", async ({ page }) => {
    await page.goto("/v/cultivation");
    await expect(page).toHaveTitle(/.+/);
    await checkNoHorizontalOverflow(page);
  });

  test("variant earn loads", async ({ page }) => {
    await page.goto("/v/earn");
    await expect(page).toHaveTitle(/.+/);
    await checkNoHorizontalOverflow(page);
  });
});
