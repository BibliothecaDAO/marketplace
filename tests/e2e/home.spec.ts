import { expect, test } from "./owned-marketplace-test";

test("home renders marketplace shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("marketplace-home")).toBeVisible();
  await expect(
    page.getByTestId("hero-banner").getByRole("heading", { name: "Realms" }),
  ).toBeVisible();
});
