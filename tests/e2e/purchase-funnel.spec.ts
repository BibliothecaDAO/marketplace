import {
  expect,
  test,
  waitForReactHydration,
  type Page,
} from "./owned-marketplace-test";

async function openFirstCollection(page: Page) {
  const collectionCardLinks = page.locator(
    "main[data-testid='marketplace-home'] [data-testid='collection-cards-grid'] a[href^='/collections/']",
  );
  const heroCollectionLink = page.getByRole("link", { name: "View Collection" });

  const hasCollectionCardLink = (await collectionCardLinks.count()) > 0;

  const targetLink = hasCollectionCardLink
    ? collectionCardLinks.first()
    : heroCollectionLink;

  await expect(targetLink).toBeVisible();
  await targetLink.click();
}

test.describe("purchase funnel skeleton", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
    });
  });

  test("adds item to cart from collection grid", async ({ page }) => {
    await page.goto("/");

    await openFirstCollection(page);
    // Use waitForURL with full navigationTimeout – Next.js may need time to compile the
    // [address] route on first access in CI.
    await page.waitForURL(/\/collections\//, { timeout: 30_000 });

    const addButtons = page
      .getByRole("button", { name: "Buy Now" })
      .filter({ hasNotText: "Added" });
    await expect(addButtons.first()).toBeEnabled();
    await addButtons.first().click();

    await expect(page.getByRole("heading", { name: "Cart" })).toBeVisible();
    await expect(page.getByText("Your cart is empty.")).toHaveCount(0);
  });

  test("adds cheapest listing to cart from token detail", async ({ page }) => {
    await page.goto("/");

    await openFirstCollection(page);
    await page.waitForURL(/\/collections\//, { timeout: 30_000 });

    const tokenLinks = page.getByRole("link", { name: "View" });
    await expect(tokenLinks.first()).toBeVisible();
    await tokenLinks.first().click();
    await expect(page).toHaveURL(/\/collections\/.+\/.+/);

    const addCheapest = page.getByRole("button", { name: "Add cheapest to cart" });
    await expect(addCheapest).toBeVisible();
    await expect(addCheapest).toBeEnabled();

    await addCheapest.click();

    await expect(page.getByRole("heading", { name: "Cart" })).toBeVisible();
    await expect(page.getByText("Your cart is empty.")).toHaveCount(0);
  });

  test("portfolio_lookup_can_open_owned_token_detail", async ({ page }) => {
    await page.goto("/portfolio");

    await expect(page.locator("main[data-testid='portfolio-view']")).toBeVisible();
    await expect(page.getByRole("heading", { name: /portfolio/i })).toBeVisible();
    await waitForReactHydration(page, "#portfolio-address-input");

    await page.getByRole("textbox", { name: /wallet address/i }).fill("0x1");
    await page.getByRole("button", { name: /load holdings/i }).click();

    await expect(page.locator("[data-testid='wallet-profile-view']")).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: /wallet address/i }),
    ).toHaveValue("0x1");

    const firstTokenLink = page.getByRole("link", { name: /view token/i }).first();
    await expect(firstTokenLink).toBeVisible();
    await firstTokenLink.click();

    await expect(page).toHaveURL(/\/collections\/.+\/.+/);
  });
});
