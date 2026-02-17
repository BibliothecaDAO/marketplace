import { expect, test } from "@playwright/test";

test("home renders marketplace shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/Biblio Marketplace/i)).toBeVisible();
  await expect(
    page.getByText(
      /Shadcn \+ Tailwind starter powered by Arcade marketplace SDK/i,
    ),
  ).toBeVisible();
});
