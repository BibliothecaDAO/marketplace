import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: "http://127.0.0.1:3400",
    trace: "on-first-retry",
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  webServer: [
    {
      command:
        "pnpm --filter @biblio/marketplace-api exec tsx ../../tests/e2e/owned-marketplace-api-server.ts",
      url: "http://127.0.0.1:3401/health",
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: "npm run dev -- --port 3400",
      env: {
        MARKETPLACE_READ_ROLLOUT: "checkout",
        NEXT_PUBLIC_MARKETPLACE_API_BASE_URL: "http://127.0.0.1:3401",
        NEXT_PUBLIC_MARKETPLACE_CHAIN_ID: "SN_MAIN",
        NEXT_PUBLIC_MARKETPLACE_COLLECTIONS:
          "0x07ae27a31bb6526e3de9cf02f081f6ce0615ac12a6d7b85ee58b8ad7947a2809|Realms",
        NEXT_PUBLIC_MARKETPLACE_READ_ROLLOUT: "checkout",
      },
      url: "http://127.0.0.1:3400",
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
