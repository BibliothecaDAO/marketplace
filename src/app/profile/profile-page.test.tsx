import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { vi } from "vitest";

const {
  mockUseWalletPortfolioQuery,
  mockHydrationBoundary,
} = vi.hoisted(() => ({
  mockUseWalletPortfolioQuery: vi.fn(),
  mockHydrationBoundary: vi.fn(),
}));

vi.mock("@/lib/marketplace/hooks", () => ({
  useWalletPortfolioQuery: mockUseWalletPortfolioQuery,
}));

vi.mock("@/lib/marketplace/server-prefetch", () => ({
  buildWalletProfileHydrationState: vi.fn(async () => ({
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
  }) => {
    mockHydrationBoundary(state);
    return (
      <div
        data-testid="hydration-boundary"
        data-state={state ? "present" : "missing"}
      >
        {children}
      </div>
    );
  },
}));

describe("profile route page", () => {
  it("renders profile content for an address route", async () => {
    mockUseWalletPortfolioQuery.mockReturnValue({
      data: { page: { balances: [] } },
      status: "ready",
      error: null,
      isFetching: false,
      refresh: vi.fn(),
    });

    const pageModule = await import("./[address]/page");
    const ProfilePage = pageModule.default;

    const page = await ProfilePage({
      params: Promise.resolve({ address: "0xabc123" }),
    });

    render(page);

    expect(screen.getByTestId("hydration-boundary")).toHaveAttribute(
      "data-state",
      "present",
    );
    expect(
      screen.getByRole("heading", { name: /wallet profile/i }),
    ).toBeVisible();
    expect(screen.getByText("0xabc123")).toBeVisible();
  });
});
