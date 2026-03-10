import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-query", () => ({
  HydrationBoundary: ({
    children,
    state,
  }: {
    children: React.ReactNode;
    state: unknown;
  }) => (
    <div
      data-testid="hydration-boundary"
      data-state={state ? "present" : "missing"}
    >
      {children}
    </div>
  ),
}));

vi.mock("@/components/marketplace/marketplace-home", () => ({
  MarketplaceHome: () => <div data-testid="marketplace-home-view">Marketplace Home</div>,
}));

vi.mock("@/lib/marketplace/home-prefetch", () => ({
  buildHomePageHydrationState: vi.fn(async () => ({
    featuredCollection: { address: "0xabc", projectId: "project-a" },
    state: { queries: [{ queryKey: ["collection", "0xabc"] }] },
  })),
}));

describe("home route page", () => {
  it("renders_home_inside_a_hydration_boundary", async () => {
    const pageModule = await import("./page");
    const HomePage = pageModule.default;
    const page = await HomePage();

    render(page);

    expect(screen.getByTestId("hydration-boundary")).toHaveAttribute(
      "data-state",
      "present",
    );
    expect(screen.getByTestId("marketplace-home-view")).toBeVisible();
  });
});
