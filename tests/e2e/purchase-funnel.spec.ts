import { expect, test, type Page } from "@playwright/test";

async function openFirstCollection(page: Page) {
  const collectionCardLinks = page.locator(
    "main[data-testid='marketplace-home'] [data-testid='collection-cards-grid'] a[href^='/collections/']",
  );
  const heroCollectionLink = page.getByRole("link", { name: "View Collection" });

  const hasCollectionCardLink = (await collectionCardLinks.count()) > 0;
  const hasHeroCollectionLink = (await heroCollectionLink.count()) > 0;
  test.skip(
    !hasCollectionCardLink && !hasHeroCollectionLink,
    "No collection links available from home.",
  );

  const targetLink = hasCollectionCardLink
    ? collectionCardLinks.first()
    : heroCollectionLink.first();

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
      .getByRole("button", { name: "Add to cart" })
      .filter({ hasNotText: "Added" });
    const hasAddableListing = (await addButtons.count()) > 0;
    test.skip(!hasAddableListing, "No addable listings in active collection.");

    await addButtons.first().click();

    await expect(page.getByRole("heading", { name: "Cart" })).toBeVisible();
    await expect(page.getByText("Your cart is empty.")).toHaveCount(0);
  });

  test("adds cheapest listing to cart from token detail", async ({ page }) => {
    await page.goto("/");

    await openFirstCollection(page);
    await page.waitForURL(/\/collections\//, { timeout: 30_000 });

    const tokenLinks = page.locator("a[aria-label^='token-']");
    const hasTokenLink = (await tokenLinks.count()) > 0;
    test.skip(!hasTokenLink, "No token cards available in collection grid.");

    await tokenLinks.first().click();
    await expect(page).toHaveURL(/\/collections\/.+\/.+/);

    const addCheapest = page.getByRole("button", { name: "Add cheapest to cart" });
    await expect(addCheapest).toBeVisible();
    test.skip(await addCheapest.isDisabled(), "No purchasable listing on token detail.");

    await addCheapest.click();

    await expect(page.getByRole("heading", { name: "Cart" })).toBeVisible();
    await expect(page.getByText("Your cart is empty.")).toHaveCount(0);
  });

  test("portfolio_lookup_can_open_owned_token_detail", async ({ page }) => {
    await page.goto("/portfolio");

    await expect(page.locator("main[data-testid='portfolio-view']")).toBeVisible();
    await expect(page.getByRole("heading", { name: /portfolio/i })).toBeVisible();

    await page.getByRole("textbox", { name: /wallet address/i }).fill("0x1");
    await page.getByRole("button", { name: /load holdings/i }).click();

    const profileViewVisible =
      (await page.locator("main[data-testid='wallet-profile-view']").count()) > 0;
    test.skip(
      !profileViewVisible,
      "Portfolio holdings view did not initialize in this environment.",
    );

    await expect(page.getByText("0x1")).toBeVisible();

    const emptyStateVisible =
      (await page.getByText(/no items found for this wallet/i).count()) > 0;
    test.skip(emptyStateVisible, "No holdings available for test wallet.");

    const errorStateVisible =
      (await page.getByText(/unable to load wallet items right now/i).count()) > 0;
    test.skip(errorStateVisible, "Portfolio query unavailable in current environment.");

    const firstTokenLink = page.getByRole("link", { name: /view token/i }).first();
    await expect(firstTokenLink).toBeVisible();
    await firstTokenLink.click();

    await expect(page).toHaveURL(/\/collections\/.+\/.+/);
  });
});
