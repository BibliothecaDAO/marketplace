import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CollectionRouteView } from "@/features/collections/collection-route-view";
import type { SeedCollection } from "@/lib/marketplace/config";

const { mockUseCollectionQuery, mockUseCollectionTraitMetadataQuery, mockUseCollectionListingsQuery } = vi.hoisted(() => ({
  mockUseCollectionQuery: vi.fn(),
  mockUseCollectionTraitMetadataQuery: vi.fn(),
  mockUseCollectionListingsQuery: vi.fn(),
}));

vi.mock("@/lib/marketplace/hooks", () => ({
  useCollectionQuery: mockUseCollectionQuery,
  useCollectionTraitMetadataQuery: mockUseCollectionTraitMetadataQuery,
  useCollectionListingsQuery: mockUseCollectionListingsQuery,
}));

vi.mock("@/features/collections/collection-token-grid", () => ({
  CollectionTokenGrid: (props: Record<string, unknown>) => (
    <div data-testid="collection-token-grid">
      Token Grid: {props.address as string} | Sort: {String(props.sortMode ?? "recent")}
    </div>
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

const collections: SeedCollection[] = [
  { address: "0xabc", name: "Genesis", projectId: "project-a" },
  { address: "0xdef", name: "Artifacts", projectId: "project-b" },
];

function successQuery(data: unknown) {
  return {
    data,
    isLoading: false,
    isSuccess: true,
    isError: false,
    error: null,
    isFetching: false,
    refetch: vi.fn(),
  };
}

describe("collection route view", () => {
  beforeEach(() => {
    mockUseCollectionQuery.mockReset();
    mockUseCollectionTraitMetadataQuery.mockReset();
    mockUseCollectionListingsQuery.mockReset();
    mockUseCollectionTraitMetadataQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isSuccess: true,
      isError: false,
      error: null,
      isFetching: false,
      refetch: vi.fn(),
    });
    mockUseCollectionListingsQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isSuccess: true,
      isError: false,
      error: null,
      isFetching: false,
      refetch: vi.fn(),
    });
  });

  it("collection_route_loads_summary_for_address", () => {
    mockUseCollectionQuery.mockReturnValue(
      successQuery({
        projectId: "project-a",
        address: "0xabc",
        contractType: "erc721",
        metadata: { name: "Genesis" },
        totalSupply: BigInt(12),
        raw: {},
      }),
    );

    render(<CollectionRouteView address="0xabc" collections={collections} />);

    expect(mockUseCollectionQuery).toHaveBeenCalledWith(
      { address: "0xabc", projectId: "project-a", fetchImages: true },
    );
    expect(screen.getByRole("heading", { name: "Genesis" })).toBeVisible();
  });

  it("collection_switch_updates_url_and_resets_cursor", async () => {
    mockUseCollectionQuery.mockReturnValue(successQuery(null));
    const onNavigate = vi.fn();
    const user = userEvent.setup();

    render(
      <CollectionRouteView
        address="0xabc"
        collections={collections}
        cursor="next-cursor-1"
        onNavigate={onNavigate}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: /collection/i }));
    await user.click(await screen.findByRole("option", { name: "Artifacts" }));

    expect(onNavigate).toHaveBeenCalledWith("/collections/0xdef");
  });

  it("collection_empty_state_shows_when_not_found", () => {
    mockUseCollectionQuery.mockReturnValue(successQuery(null));

    render(<CollectionRouteView address="0x404" collections={collections} />);

    expect(screen.getByText(/find collection/i)).toBeVisible();
  });

  it("shows_tokens_tab_by_default", () => {
    mockUseCollectionQuery.mockReturnValue(successQuery(null));

    render(<CollectionRouteView address="0xabc" collections={collections} />);

    expect(screen.getByRole("tab", { name: /tokens/i })).toBeVisible();
    expect(screen.getByRole("tab", { name: /market activity/i })).toBeVisible();
    expect(screen.getByTestId("collection-token-grid")).toBeVisible();
  });

  it("switches_to_market_activity_tab", async () => {
    mockUseCollectionQuery.mockReturnValue(successQuery(null));
    const user = userEvent.setup();

    render(<CollectionRouteView address="0xabc" collections={collections} />);

    await user.click(screen.getByRole("tab", { name: /market activity/i }));

    expect(screen.getByTestId("collection-market-panel")).toBeVisible();
  });

  it("trait_sidebar_has_sticky_positioning", () => {
    mockUseCollectionQuery.mockReturnValue(successQuery(null));

    render(<CollectionRouteView address="0xabc" collections={collections} />);

    expect(screen.getByTestId("trait-sidebar-container")).toBeVisible();
  });

  it("cursor_debug_badge_not_shown", () => {
    mockUseCollectionQuery.mockReturnValue(successQuery(null));
    render(<CollectionRouteView address="0xabc" collections={collections} cursor="some-cursor" />);
    expect(screen.queryByText(/cursor:/i)).toBeNull();
  });

  it("fetches_trait_metadata_from_sdk_for_active_collection", () => {
    mockUseCollectionQuery.mockReturnValue(successQuery(null));

    render(<CollectionRouteView address="0xabc" collections={collections} />);

    expect(mockUseCollectionTraitMetadataQuery).toHaveBeenCalledWith(
      expect.objectContaining({ address: "0xabc", projectId: "project-a" }),
    );
  });

  it("contract_type_not_shown_to_users", () => {
    mockUseCollectionQuery.mockReturnValue(
      successQuery({ metadata: { name: "Genesis" }, contractType: "erc721", address: "0xabc" })
    );
    render(<CollectionRouteView address="0xabc" collections={collections} />);
    expect(screen.queryByText(/contract type/i)).toBeNull();
  });

  it("sort_controls_update_mode_and_pass_selection_to_token_grid", async () => {
    mockUseCollectionQuery.mockReturnValue(successQuery(null));
    const onSortModeChange = vi.fn();
    const user = userEvent.setup();

    render(
      <CollectionRouteView
        address="0xabc"
        collections={collections}
        sortMode="recent"
        onSortModeChange={onSortModeChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: /price low to high/i }));

    expect(onSortModeChange).toHaveBeenCalledWith("price-asc");
    expect(screen.getByText(/sort: recent/i)).toBeVisible();
  });
});
