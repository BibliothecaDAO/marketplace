import {
  E2E_API_BASE_URL,
  E2E_COLLECTION,
  E2E_LORDS,
  E2E_STRK,
  expect,
  installOwnedMarketplaceApi,
  test,
  waitForReactHydration,
} from "./owned-marketplace-test";

test("browse filters and currency stay URL-canonical and query the owned API", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));

  await page.goto(`/collections/${E2E_COLLECTION}`);
  await expect(page.getByRole("heading", { name: "Realms" })).toBeVisible();
  await expect(page.getByRole("button", { name: "token-1" })).toBeVisible();

  await page.getByRole("button", { name: "Region" }).click();
  await page.getByRole("button", { name: "North (1)" }).click();
  await expect(page).toHaveURL(/trait=Region%3ANorth/);

  const lordsTokenRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return (
      request.url().startsWith(`${E2E_API_BASE_URL}/`) &&
      url.pathname.endsWith("/tokens") &&
      url.searchParams.get("currency")?.toLowerCase() === E2E_LORDS.toLowerCase()
    );
  });
  await page.getByRole("combobox", { name: "Marketplace currency" }).click();
  await page.getByRole("option", { name: "LORDS" }).click();
  await lordsTokenRequest;
  await expect(page).toHaveURL(/currency=LORDS/);

  expect(
    requests.some((url) => url.startsWith(`${E2E_API_BASE_URL}/v1/chains/SN_MAIN/`)),
  ).toBe(true);
  expect(
    requests.filter((url) => /api\.cartridge\.gg\/.*\/torii|\/torii\/static\//i.test(url)),
  ).toEqual([]);
});

test("token detail exposes indexed activity and purchasable identity", async ({
  page,
}) => {
  await page.goto(`/collections/${E2E_COLLECTION}/1`);

  await expect(page.getByRole("heading", { name: "Realm #1" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add cheapest to cart" })).toBeEnabled();
  await expect(page.getByRole("heading", { name: "Activity" })).toBeVisible();
  await expect(page.getByText("Listing created")).toBeVisible();
  await expect(page.getByRole("link", { name: "View transaction" })).toHaveAttribute(
    "href",
    /\/tx\/0x0+abc$/,
  );
});

test("portfolio and diagnostics are exclusively populated by owned response envelopes", async ({
  page,
}) => {
  await page.goto("/portfolio");
  await waitForReactHydration(page, "#portfolio-address-input");
  await page.getByRole("textbox", { name: /wallet address/i }).fill("0x1");
  await page.getByRole("button", { name: /load holdings/i }).click();
  await expect(page.getByText(/1 item across 1 collection/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /view token/i })).toBeVisible();

  await page.goto("/ops");
  await expect(page.getByText("API version: e2e-owned-api")).toBeVisible();
  await expect(page.getByText("Schema: 1.0.0")).toBeVisible();
  await expect(page.getByText("Lag: 1 block")).toBeVisible();
  await expect(page.getByText("Finality: accepted_l2")).toBeVisible();
  await expect(page.getByText("Metadata failures: 0")).toBeVisible();
});

test("a missing tuple order remains visibly stale during cart refresh", async ({ page }) => {
  await page.unroute(`${E2E_API_BASE_URL}/**`);
  await installOwnedMarketplaceApi(page, { staleOrderLookup: true });
  await page.addInitScript(
    ({ collection, currency }) => {
      localStorage.setItem(
        "marketplace-cart-v1",
        JSON.stringify({
          state: {
            items: [
              {
                orderId: "42",
                collection,
                tokenId: "1",
                price: "1000000000000000000",
                currency,
                quantity: "1",
                tokenName: "Realm #1",
                tokenImage: null,
              },
            ],
            isOpen: true,
            inlineErrors: { "42": "Listing is stale or unavailable." },
            lastActionError: null,
          },
          version: 0,
        }),
      );
    },
    { collection: E2E_COLLECTION, currency: E2E_STRK },
  );

  await page.goto("/");
  await expect(page.getByTestId("cart-item-42")).toBeVisible();
  const lookup = page.waitForRequest((request) =>
    request.url().endsWith("/orders/lookup"),
  );
  await page.getByRole("button", { name: "Refresh" }).click();
  await lookup;
  await expect(page.getByText(/listing is still stale or unavailable/i)).toBeVisible();
  await expect(page.getByTestId("cart-item-42")).toContainText(
    "Listing is stale or unavailable.",
  );
});
