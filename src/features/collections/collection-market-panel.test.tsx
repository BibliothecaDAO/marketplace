import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CollectionMarketPanel } from "@/features/collections/collection-market-panel";

const { mockUseCollectionOrdersQuery, mockUseCollectionListingsQuery } =
  vi.hoisted(() => ({
    mockUseCollectionOrdersQuery: vi.fn(),
    mockUseCollectionListingsQuery: vi.fn(),
  }));

vi.mock("@/lib/marketplace/hooks", () => ({
  useCollectionOrdersQuery: mockUseCollectionOrdersQuery,
  useCollectionListingsQuery: mockUseCollectionListingsQuery,
}));

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

function errorQuery(error: Error) {
  return {
    data: undefined,
    isLoading: false,
    isSuccess: false,
    isError: true,
    error,
    isFetching: false,
    refetch: vi.fn(),
  };
}

describe("collection market panel", () => {
  beforeEach(() => {
    mockUseCollectionOrdersQuery.mockReset();
    mockUseCollectionListingsQuery.mockReset();

    mockUseCollectionOrdersQuery.mockReturnValue(successQuery([]));
    mockUseCollectionListingsQuery.mockReturnValue(successQuery([]));
  });

  it("orders_tab_filters_by_status_and_category", async () => {
    const user = userEvent.setup();
    render(<CollectionMarketPanel address="0xabc" projectId="project-a" />);

    await user.type(screen.getByLabelText(/order status/i), "Placed");
    await user.type(screen.getByLabelText(/order category/i), "Buy");

    await waitFor(() => {
      const latest = mockUseCollectionOrdersQuery.mock.calls.at(-1)?.[0];
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
      const latest = mockUseCollectionListingsQuery.mock.calls.at(-1)?.[0];
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
      const latest = mockUseCollectionListingsQuery.mock.calls.at(-1)?.[0];
      expect(latest).toMatchObject({
        verifyOwnership: true,
      });
    });
  });

  it("orders_and_listings_errors_are_isolated_per_panel", async () => {
    mockUseCollectionOrdersQuery.mockReturnValue(
      errorQuery(new Error("orders endpoint failed")),
    );
    mockUseCollectionListingsQuery.mockReturnValue(
      successQuery([
        {
          id: 10,
          tokenId: 7,
          owner: "0x1",
          price: 100,
        },
      ]),
    );

    const user = userEvent.setup();
    render(<CollectionMarketPanel address="0xabc" projectId="project-a" />);

    expect(
      within(screen.getByTestId("orders-panel")).getByText(/orders failed to load/i),
    ).toBeVisible();

    await user.click(screen.getByRole("tab", { name: /listings/i }));

    const listingsPanel = screen.getByTestId("listings-panel");
    expect(within(listingsPanel).queryByText(/orders failed to load/i)).toBeNull();
    expect(within(listingsPanel).getByText(/#10/)).toBeVisible();
  });
});
