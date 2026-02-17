import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CollectionRouteView } from "@/features/collections/collection-route-view";
import type { SeedCollection } from "@/lib/marketplace/config";

const {
  mockUseMarketplaceCollection,
  mockUseMarketplaceCollectionTokens,
  mockUseMarketplaceCollectionOrders,
  mockUseMarketplaceCollectionListings,
} =
  vi.hoisted(() => ({
    mockUseMarketplaceCollection: vi.fn(),
    mockUseMarketplaceCollectionTokens: vi.fn(),
    mockUseMarketplaceCollectionOrders: vi.fn(),
    mockUseMarketplaceCollectionListings: vi.fn(),
  }));

vi.mock("@cartridge/arcade/marketplace/react", () => ({
  useMarketplaceCollection: mockUseMarketplaceCollection,
  useMarketplaceCollectionTokens: mockUseMarketplaceCollectionTokens,
  useMarketplaceCollectionOrders: mockUseMarketplaceCollectionOrders,
  useMarketplaceCollectionListings: mockUseMarketplaceCollectionListings,
}));

const collections: SeedCollection[] = [
  { address: "0xabc", name: "Genesis", projectId: "project-a" },
  { address: "0xdef", name: "Artifacts", projectId: "project-b" },
];

describe("collection route view", () => {
  beforeEach(() => {
    mockUseMarketplaceCollection.mockReset();
    mockUseMarketplaceCollectionTokens.mockReset();
    mockUseMarketplaceCollectionOrders.mockReset();
    mockUseMarketplaceCollectionListings.mockReset();
    mockUseMarketplaceCollectionTokens.mockReturnValue({
      data: {
        page: {
          tokens: [],
          nextCursor: null,
        },
        error: null,
      },
      status: "success",
      error: null,
      isFetching: false,
      refresh: vi.fn(),
    });
    mockUseMarketplaceCollectionOrders.mockReturnValue({
      data: [],
      status: "success",
      error: null,
      isFetching: false,
      refresh: vi.fn(),
    });
    mockUseMarketplaceCollectionListings.mockReturnValue({
      data: [],
      status: "success",
      error: null,
      isFetching: false,
      refresh: vi.fn(),
    });
  });

  it("collection_route_loads_summary_for_address", () => {
    mockUseMarketplaceCollection.mockReturnValue({
      data: {
        projectId: "project-a",
        address: "0xabc",
        contractType: "erc721",
        metadata: { name: "Genesis" },
        totalSupply: BigInt(12),
        raw: {},
      },
      status: "success",
      error: null,
      isFetching: false,
      refresh: vi.fn(),
    });

    render(<CollectionRouteView address="0xabc" collections={collections} />);

    expect(mockUseMarketplaceCollection).toHaveBeenCalledWith(
      { address: "0xabc", projectId: "project-a", fetchImages: true },
      true,
    );
    expect(screen.getByText(/Contract Type: erc721/i)).toBeVisible();
    expect(screen.getByText("0xabc")).toBeVisible();
  });

  it("collection_switch_updates_url_and_resets_cursor", async () => {
    mockUseMarketplaceCollection.mockReturnValue({
      data: null,
      status: "success",
      error: null,
      isFetching: false,
      refresh: vi.fn(),
    });
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
    mockUseMarketplaceCollection.mockReturnValue({
      data: null,
      status: "success",
      error: null,
      isFetching: false,
      refresh: vi.fn(),
    });

    render(<CollectionRouteView address="0x404" collections={collections} />);

    expect(screen.getByText(/collection not found/i)).toBeVisible();
  });
});
