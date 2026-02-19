import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { vi } from "vitest";

vi.mock("@/features/portfolio/portfolio-view", () => ({
  PortfolioView: () => <div data-testid="portfolio-route-view">Portfolio View</div>,
}));

describe("portfolio route page", () => {
  it("renders_portfolio_lookup_interface", async () => {
    const pageModule = await import("./page");
    const PortfolioPage = pageModule.default;
    const page = await PortfolioPage();

    render(page);

    expect(screen.getByTestId("portfolio-route-view")).toBeVisible();
  });
});
