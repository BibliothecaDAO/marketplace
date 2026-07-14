import { expect, test as base, type Page, type Route } from "@playwright/test";
import {
  E2E_API_BASE_URL,
  E2E_COLLECTION,
  E2E_LORDS,
  E2E_MARKETPLACE,
  E2E_STRK,
  E2E_WORLD,
  ownedApiResponseHeaders,
  ownedMarketplaceApiResponse,
  type OwnedApiOptions,
} from "./owned-marketplace-fixtures";

async function fulfillOwnedResponse(
  route: Route,
  options: OwnedApiOptions,
) {
  const request = route.request();
  if (request.method() === "OPTIONS") {
    await route.fulfill({
      status: 204,
      headers: ownedApiResponseHeaders(),
      body: "",
    });
    return;
  }

  const response = ownedMarketplaceApiResponse(
    {
      method: request.method(),
      url: request.url(),
      body: request.postData() ? request.postDataJSON() : undefined,
    },
    options,
  );
  await route.fulfill({
    status: response.status,
    headers: ownedApiResponseHeaders(),
    body: JSON.stringify(response.payload),
  });
}

export async function installOwnedMarketplaceApi(
  page: Page,
  options: OwnedApiOptions = {},
) {
  await page.route(`${E2E_API_BASE_URL}/**`, (route) =>
    fulfillOwnedResponse(route, options));
}

export async function waitForReactHydration(page: Page, selector: string) {
  await page.waitForFunction((targetSelector) => {
    const element = document.querySelector(targetSelector);
    return element
      ? Object.keys(element).some((key) => key.startsWith("__reactProps$"))
      : false;
  }, selector);
}

export const test = base.extend({
  page: async ({ page }, run) => {
    await installOwnedMarketplaceApi(page);
    await run(page);
  },
});

export {
  E2E_API_BASE_URL,
  E2E_COLLECTION,
  E2E_LORDS,
  E2E_MARKETPLACE,
  E2E_STRK,
  E2E_WORLD,
  expect,
};
export type { Page } from "@playwright/test";
