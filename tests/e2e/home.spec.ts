import { expect, test } from "@playwright/test";

test("home renders marketplace shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/Realms\.market/i)).toBeVisible();
  await expect(page.getByTestId("marketplace-home")).toBeVisible();
});
