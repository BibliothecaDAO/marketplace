import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CollectionMarketPanel } from "@/features/collections/collection-market-panel";

const { mockUseMarketplaceCollectionOrders, mockUseMarketplaceCollectionListings } =
  vi.hoisted(() => ({
    mockUseMarketplaceCollectionOrders: vi.fn(),
    mockUseMarketplaceCollectionListings: vi.fn(),
  }));

vi.mock("@cartridge/arcade/marketplace/react", () => ({
  useMarketplaceCollectionOrders: mockUseMarketplaceCollectionOrders,
  useMarketplaceCollectionListings: mockUseMarketplaceCollectionListings,
}));

describe("collection market panel", () => {
  beforeEach(() => {
    mockUseMarketplaceCollectionOrders.mockReset();
    mockUseMarketplaceCollectionListings.mockReset();

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

  it("orders_tab_filters_by_status_and_category", async () => {
    const user = userEvent.setup();
    render(<CollectionMarketPanel address="0xabc" projectId="project-a" />);

    await user.type(screen.getByLabelText(/order status/i), "Placed");
    await user.type(screen.getByLabelText(/order category/i), "Buy");

    await waitFor(() => {
      const latest = mockUseMarketplaceCollectionOrders.mock.calls.at(-1)?.[0];
      expect(latest).toMatchObject({
        collection: "0xabc",
        status: "Placed",
        category: "Buy",
      });
    });
  });

  it("listings_tab_filters_by_token_and_project", async () => {
    const user = userEvent.setup();
    render(<CollectionMarketPanel address="0xabc" projectId="project-a" />);

    await user.click(screen.getByRole("tab", { name: /listings/i }));
    await user.type(screen.getByLabelText(/listing token id/i), "42");

    await waitFor(() => {
      const latest = mockUseMarketplaceCollectionListings.mock.calls.at(-1)?.[0];
      expect(latest).toMatchObject({
        collection: "0xabc",
        tokenId: "42",
        projectId: "project-a",
      });
    });
  });

  it("listings_verify_ownership_flag_changes_query_behavior", async () => {
    const user = userEvent.setup();
    render(<CollectionMarketPanel address="0xabc" projectId="project-a" />);

    await user.click(screen.getByRole("tab", { name: /listings/i }));
    await user.click(screen.getByRole("switch", { name: /verify ownership/i }));

    await waitFor(() => {
      const latest = mockUseMarketplaceCollectionListings.mock.calls.at(-1)?.[0];
      expect(latest).toMatchObject({
        verifyOwnership: true,
      });
    });
  });

  it("orders_and_listings_errors_are_isolated_per_panel", async () => {
    mockUseMarketplaceCollectionOrders.mockReturnValue({
      data: null,
      status: "error",
      error: new Error("orders endpoint failed"),
      isFetching: false,
      refresh: vi.fn(),
    });
    mockUseMarketplaceCollectionListings.mockReturnValue({
      data: [
        {
          id: 10,
          tokenId: 7,
          owner: "0x1",
          price: 100,
        },
      ],
      status: "success",
      error: null,
      isFetching: false,
      refresh: vi.fn(),
    });

    const user = userEvent.setup();
    render(<CollectionMarketPanel address="0xabc" projectId="project-a" />);

    expect(
      within(screen.getByTestId("orders-panel")).getByText(/orders failed to load/i),
    ).toBeVisible();

    await user.click(screen.getByRole("tab", { name: /listings/i }));

    const listingsPanel = screen.getByTestId("listings-panel");
    expect(within(listingsPanel).queryByText(/orders failed to load/i)).toBeNull();
    expect(within(listingsPanel).getByText(/Listing #10/i)).toBeVisible();
  });
});
