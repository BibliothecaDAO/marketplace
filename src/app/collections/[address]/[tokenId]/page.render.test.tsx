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

vi.mock("@/features/token/token-detail-view", () => ({
  TokenDetailView: ({
    address,
    tokenId,
  }: {
    address: string;
    tokenId: string;
  }) => <div data-testid="token-detail-view">{`${address}:${tokenId}`}</div>,
}));

vi.mock("@/lib/marketplace/token-prefetch", () => ({
  buildTokenPageHydrationState: vi.fn(async () => ({
    state: { queries: [{ queryKey: ["token-detail", "0xabc", "42"] }] },
  })),
}));

describe("token route page", () => {
  it("renders_token_route_inside_a_hydration_boundary", async () => {
    const pageModule = await import("./page");
    const TokenPage = pageModule.default;
    const page = await TokenPage({
      params: Promise.resolve({ address: "0xabc", tokenId: "42" }),
    });

    render(page);

    expect(screen.getByTestId("hydration-boundary")).toHaveAttribute(
      "data-state",
      "present",
    );
    expect(screen.getByTestId("token-detail-view")).toHaveTextContent("0xabc:42");
  });
});
