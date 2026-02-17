import { describe, expect, it } from "vitest";
import {
  collectFeatureScreenshotRoutes,
  routeFromAppPage,
} from "./feature-screenshot-routes.mjs";

describe("routeFromAppPage", () => {
  it("maps static pages", () => {
    expect(routeFromAppPage("src/app/ops/page.tsx")).toBe("/ops");
  });

  it("maps dynamic pages to sample params", () => {
    expect(routeFromAppPage("src/app/collections/[address]/page.tsx")).toBe(
      "/collections/0xabc",
    );
  });

  it("maps root page", () => {
    expect(routeFromAppPage("src/app/page.tsx")).toBe("/");
  });

  it("ignores non page files", () => {
    expect(routeFromAppPage("src/app/layout.tsx")).toBeNull();
  });
});

describe("collectFeatureScreenshotRoutes", () => {
  it("collects routes from feature and app changes", () => {
    const routes = collectFeatureScreenshotRoutes([
      "src/features/collections/collection-route-view.tsx",
      "src/features/ops/ops-status-panel.tsx",
      "src/app/page.tsx",
      "README.md",
    ]);

    expect(routes).toEqual(["/", "/collections/0xabc", "/ops"]);
  });

  it("returns empty when no frontend feature files changed", () => {
    const routes = collectFeatureScreenshotRoutes(["README.md", "package.json"]);
    expect(routes).toEqual([]);
  });
});
