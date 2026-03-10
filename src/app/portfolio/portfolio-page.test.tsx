import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { vi } from "vitest";

const { mockPortfolioView } = vi.hoisted(() => ({
  mockPortfolioView: vi.fn(),
}));

vi.mock("@/features/portfolio/portfolio-view", () => ({
  PortfolioView: (props: { initialAddress?: string }) => {
    mockPortfolioView(props);
    return <div data-testid="portfolio-route-view">Portfolio View</div>;
  },
}));

vi.mock("@/lib/marketplace/server-prefetch", () => ({
  buildPortfolioPageHydrationState: vi.fn(async () => ({
    state: { queries: [{ queryKey: ["token-balances", "0xabc123"] }] },
  })),
}));

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

describe("portfolio route page", () => {
  it("renders_portfolio_lookup_interface_inside_a_hydration_boundary", async () => {
    const pageModule = await import("./page");
    const PortfolioPage = pageModule.default;
    const page = await PortfolioPage({
      searchParams: Promise.resolve({ address: "0xabc123" }),
    });

    render(page);

    expect(screen.getByTestId("hydration-boundary")).toHaveAttribute(
      "data-state",
      "present",
    );
    expect(screen.getByTestId("portfolio-route-view")).toBeVisible();
    expect(mockPortfolioView).toHaveBeenCalledWith(
      expect.objectContaining({ initialAddress: "0xabc123" }),
    );
  });
});
