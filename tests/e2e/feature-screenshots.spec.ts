import fs from "node:fs";
import path from "node:path";
import { test } from "@playwright/test";

function parseRoutes() {
  const jsonValue = process.env.SCREENSHOT_ROUTES_JSON;
  if (jsonValue) {
    try {
      const parsed = JSON.parse(jsonValue) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((entry): entry is string => typeof entry === "string");
      }
    } catch {
      return [];
    }
  }

  const rawValue = process.env.SCREENSHOT_ROUTES;
  if (!rawValue) {
    return [];
  }

  return rawValue
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function routeToFilename(route: string) {
  if (route === "/") {
    return "home";
  }

  return route
    .replace(/^\//, "")
    .replaceAll("/", "-")
    .replaceAll(/[^a-zA-Z0-9\-_.]/g, "_")
    .toLowerCase();
}

const routes = parseRoutes();

if (routes.length === 0) {
  test("skip when no feature routes are selected", async () => {
    test.skip(true, "No feature routes selected for screenshots.");
  });
} else {
  test.describe("feature screenshots", () => {
    for (const route of routes) {
      test(`capture ${route}`, async ({ page }) => {
        await page.goto(route, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1200);

        const fileName = routeToFilename(route);
        const outputPath = path.join(
          "artifacts",
          "feature-screenshots",
          `${fileName}.png`,
        );
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        await page.screenshot({ path: outputPath, fullPage: true });
      });
    }
  });
}
