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

vi.mock("@/lib/marketplace/collection-prefetch", () => ({
  buildCollectionPageHydrationState: vi.fn(async () => ({
    state: { queries: [{ queryKey: ["collection", "0xabc"] }] },
  })),
}));

describe("collection route page", () => {
  it("renders_collection_route_inside_a_hydration_boundary", async () => {
    const pageModule = await import("./page");
    const CollectionPage = pageModule.default;
    const page = await CollectionPage({
      params: Promise.resolve({ address: "0xabc" }),
      searchParams: Promise.resolve({ cursor: "cursor-1" }),
    });

    render(page);

    expect(screen.getByTestId("hydration-boundary")).toHaveAttribute(
      "data-state",
      "present",
    );
    expect(screen.getByRole("main")).toBeVisible();
  });
});
