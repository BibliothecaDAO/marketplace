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
  webServer: {
    command: "npm run dev -- --port 3400",
    url: "http://127.0.0.1:3400",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
