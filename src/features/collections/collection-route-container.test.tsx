import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CollectionRouteContainer } from "@/features/collections/collection-route-container";
import type { SeedCollection } from "@/lib/marketplace/config";

const { mockUseCollectionQuery, mockPush } = vi.hoisted(() => ({
  mockUseCollectionQuery: vi.fn(),
  mockPush: vi.fn(),
}));

vi.mock("@/lib/marketplace/hooks", () => ({
  useCollectionQuery: mockUseCollectionQuery,
  useCollectionTraitMetadataQuery: () => ({ data: [], isLoading: false }),
  useCollectionListingsQuery: () => ({ data: [], isLoading: false, isSuccess: true }),
  useCollectionTokensQuery: () => ({ data: null, isLoading: false, isSuccess: false }),
}));

vi.mock("@/features/collections/collection-token-grid", () => ({
  CollectionTokenGrid: (props: Record<string, unknown>) => (
    <div data-testid="collection-token-grid">Token Grid: {props.address as string}</div>
  ),
}));

vi.mock("@/features/collections/collection-market-panel", () => ({
  CollectionMarketPanel: (props: Record<string, unknown>) => (
    <div data-testid="collection-market-panel">Market Panel: {props.address as string}</div>
  ),
}));

vi.mock("@/features/collections/trait-filter-sidebar", () => ({
  TraitFilterSidebar: () => (
    <div data-testid="trait-filter-sidebar">Trait Sidebar</div>
  ),
}));

vi.mock("@/features/cart/store/cart-store", () => ({
  CART_MAX_ITEMS: 25,
  useCartStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ items: [], addCandidates: vi.fn(), setOpen: vi.fn() }),
}));

vi.mock("@/features/collections/sweep-bar", () => ({
  SweepBar: () => <div data-testid="sweep-bar" />,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => "/collections/0xabc",
  useSearchParams: () => new URLSearchParams(),
}));

const collections: SeedCollection[] = [
  { address: "0xabc", name: "Genesis", projectId: "project-a" },
  { address: "0xdef", name: "Artifacts", projectId: "project-b" },
];

describe("collection route container", () => {
  beforeEach(() => {
    mockUseCollectionQuery.mockReset();
    mockPush.mockReset();
  });

  it("collection_switch_uses_router_push", async () => {
    mockUseCollectionQuery.mockReturnValue({
      data: null,
      isLoading: false,
      isSuccess: true,
      isError: false,
      error: null,
      isFetching: false,
      refetch: vi.fn(),
    });
    const user = userEvent.setup();

    render(
      <CollectionRouteContainer
        address="0xabc"
        collections={collections}
        cursor="next-cursor-1"
      />,
    );

    await user.click(screen.getByRole("combobox", { name: /collection/i }));
    await user.click(await screen.findByRole("option", { name: "Artifacts" }));

    expect(mockPush).toHaveBeenCalledWith("/collections/0xdef");
  });
});
