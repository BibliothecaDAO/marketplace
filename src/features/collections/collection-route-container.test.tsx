import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CollectionRouteContainer } from "@/features/collections/collection-route-container";
import type { SeedCollection } from "@/lib/marketplace/config";

const {
  mockUseMarketplaceCollection,
  mockUseMarketplaceCollectionTokens,
  mockUseMarketplaceCollectionOrders,
  mockUseMarketplaceCollectionListings,
  mockPush,
} =
  vi.hoisted(() => ({
    mockUseMarketplaceCollection: vi.fn(),
    mockUseMarketplaceCollectionTokens: vi.fn(),
    mockUseMarketplaceCollectionOrders: vi.fn(),
    mockUseMarketplaceCollectionListings: vi.fn(),
    mockPush: vi.fn(),
  }));

vi.mock("@cartridge/arcade/marketplace/react", () => ({
  useMarketplaceCollection: mockUseMarketplaceCollection,
  useMarketplaceCollectionTokens: mockUseMarketplaceCollectionTokens,
  useMarketplaceCollectionOrders: mockUseMarketplaceCollectionOrders,
  useMarketplaceCollectionListings: mockUseMarketplaceCollectionListings,
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
    mockUseMarketplaceCollection.mockReset();
    mockUseMarketplaceCollectionTokens.mockReset();
    mockUseMarketplaceCollectionOrders.mockReset();
    mockUseMarketplaceCollectionListings.mockReset();
    mockPush.mockReset();
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

  it("collection_switch_uses_router_push", async () => {
    mockUseMarketplaceCollection.mockReturnValue({
      data: null,
      status: "success",
      error: null,
      isFetching: false,
      refresh: vi.fn(),
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
