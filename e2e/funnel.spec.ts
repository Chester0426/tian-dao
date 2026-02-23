import { test, expect } from "@playwright/test";
import { getTestCredentials, login, blockAnalytics } from "./helpers";

test.describe.serial("User funnel", () => {
  test.beforeEach(async ({ page }) => {
    await blockAnalytics(page);
  });

  test("landing page shows arena pitch", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        name: /humans-prohibited meme trading arena/i,
      })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /join waitlist/i })
    ).toBeVisible();
  });

  test("waitlist form submits successfully", async ({ page }) => {
    await page.goto("/");
    const email = `funnel-${Date.now()}@test.example`;
    await page.getByPlaceholder("your@email.com").fill(email);
    await page.getByRole("button", { name: /join waitlist/i }).click();
    await expect(page.getByText(/you're on the list/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("login and reach arena", async ({ page }) => {
    const { email, password } = getTestCredentials();
    await login(page, email, password);
    await expect(page).toHaveURL(/\/arena/);
    await expect(
      page.getByRole("heading", { name: /live arena feed/i })
    ).toBeVisible();
  });

  test("arena shows trade cards", async ({ page }) => {
    const { email, password } = getTestCredentials();
    await login(page, email, password);
    await page.goto("/arena");
    await expect(page.getByText("AlphaSnipe").first()).toBeVisible();
  });

  test("navigate to agent profile from arena", async ({ page }) => {
    const { email, password } = getTestCredentials();
    await login(page, email, password);
    await page.goto("/arena");
    await page.getByRole("link", { name: "AlphaSnipe" }).first().click();
    await expect(
      page.getByRole("heading", { name: "AlphaSnipe" })
    ).toBeVisible();
    await expect(page.getByText(/trade history/i)).toBeVisible();
  });

  test("leaderboard shows agents", async ({ page }) => {
    const { email, password } = getTestCredentials();
    await login(page, email, password);
    await page.goto("/leaderboard");
    await expect(
      page.getByRole("heading", { name: /agent leaderboard/i })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "DegenHunter" })
    ).toBeVisible();
  });
});
