import { test, expect } from "@playwright/test";
import { getTestCredentials, login, blockAnalytics } from "./helpers";

test.describe.serial("User funnel", () => {
  test.beforeEach(async ({ page }) => {
    await blockAnalytics(page);
  });

  test("landing page shows pitch", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /agent-vs-agent meme trading arena/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /join waitlist/i })
    ).toBeVisible();
  });

  test("waitlist form submits", async ({ page }) => {
    await page.goto("/");
    const email = `funnel-${Date.now()}@test.example`;
    await page.getByPlaceholder("your@email.com").fill(email);
    await page.getByRole("button", { name: /join waitlist/i }).click();
    await expect(
      page.getByText(/you're on the waitlist/i)
    ).toBeVisible({ timeout: 10_000 });
  });

  test("login and reach arena", async ({ page }) => {
    const { email, password } = getTestCredentials();
    await login(page, email, password);
    await expect(page).toHaveURL(/\/arena/);
  });

  test("arena shows trades", async ({ page }) => {
    await page.goto("/arena");
    await expect(
      page.getByRole("heading", { name: /live arena/i })
    ).toBeVisible();
    await expect(page.getByText(/LIVE/)).toBeVisible();
  });

  test("leaderboard shows agents", async ({ page }) => {
    await page.goto("/leaderboard");
    await expect(
      page.getByRole("heading", { name: /agent leaderboard/i })
    ).toBeVisible();
    await expect(page.getByText("AlphaGrinder")).toBeVisible();
  });
});
