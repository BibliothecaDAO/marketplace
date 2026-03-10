import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CollectionMarketPanel } from "@/features/collections/collection-market-panel";
import { _resetConfigCache } from "@/lib/marketplace/config";

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
    process.env.NEXT_PUBLIC_MARKETPLACE_COLLECTIONS =
      "0xrealm|Realms|project-realms,0xbeast|Beasts|project-beasts";
    _resetConfigCache();
    mockUseCollectionOrdersQuery.mockReset();
    mockUseCollectionListingsQuery.mockReset();

    mockUseCollectionOrdersQuery.mockReturnValue(successQuery([]));
    mockUseCollectionListingsQuery.mockReturnValue(successQuery([]));
  });

  it("orders_tab_filters_by_status_and_category", async () => {
    const user = userEvent.setup();
    render(<CollectionMarketPanel address="0xabc" projectId="project-a" />);

    // Open order status select and pick "Placed"
    await user.click(screen.getByRole("combobox", { name: /order status/i }));
    await user.click(await screen.findByRole("option", { name: "Placed" }));

    // Open order category select and pick "Buy"
    await user.click(screen.getByRole("combobox", { name: /order category/i }));
    await user.click(await screen.findByRole("option", { name: "Buy" }));

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
    expect(within(listingsPanel).getByText(/token #7/i)).toBeVisible();
  });

  it("debug_status_badges_not_shown", () => {
    render(<CollectionMarketPanel address="0xabc" />);
    expect(screen.queryByText(/orders:/i)).toBeNull();
    expect(screen.queryByText(/listings:/i)).toBeNull();
  });

  it("order_status_select_has_options", async () => {
    const user = userEvent.setup();
    render(<CollectionMarketPanel address="0xabc" />);
    await user.click(screen.getByRole("combobox", { name: /order status/i }));
    expect(await screen.findByRole("option", { name: /placed/i })).toBeVisible();
    expect(screen.getByRole("option", { name: /canceled/i })).toBeVisible();
    expect(screen.getByRole("option", { name: /filled/i })).toBeVisible();
    expect(screen.queryByRole("option", { name: /executed/i })).toBeNull();
  });

  it("orders_rows_include_actionable_market_context", () => {
    mockUseCollectionOrdersQuery.mockReturnValue(
      successQuery([
        {
          id: 9,
          tokenId: 77,
          price: "150",
          owner: "0x1234567890abcdef",
          status: "Executed",
          updatedAt: "2024-11-16T10:30:00.000Z",
          token: {
            token_id: "77",
            metadata: { image: "https://cdn.example/token-77.png" },
          },
        },
      ]),
    );

    render(<CollectionMarketPanel address="0xabc" />);

    const ordersPanel = screen.getByTestId("orders-panel");
    expect(within(ordersPanel).queryByText(/order #9/i)).toBeNull();
    expect(within(ordersPanel).getByText(/token #77/i)).toBeVisible();
    expect(within(ordersPanel).getByAltText("Token #77 preview")).toHaveAttribute(
      "src",
      "https://cdn.example/token-77.png",
    );
    expect(within(ordersPanel).getByText(/150/)).toBeVisible();
    expect(within(ordersPanel).getByText(/filled/i)).toBeVisible();
    expect(within(ordersPanel).queryByText(/executed/i)).toBeNull();
    expect(within(ordersPanel).getByText(/owner/i)).toBeVisible();
    expect(within(ordersPanel).getByText(/2024/i)).toBeVisible();
  });

  it("orders_rows_show_realms_resource_details", () => {
    mockUseCollectionOrdersQuery.mockReturnValue(
      successQuery([
        {
          id: 9,
          tokenId: 77,
          price: "150",
          token: {
            token_id: "77",
            metadata: {
              image: "https://cdn.example/realm-77.png",
              attributes: [
                { trait_type: "Resource", value: "Wood" },
                { trait_type: "Resource", value: "Stone" },
                { traitName: "Resource", traitValue: "Wood" },
              ],
            },
          },
        },
      ]),
    );

    render(<CollectionMarketPanel address="0xrealm" />);

    const ordersPanel = screen.getByTestId("orders-panel");
    expect(within(ordersPanel).getByText("Wood")).toBeVisible();
    expect(within(ordersPanel).getByText("Stone")).toBeVisible();
    expect(within(ordersPanel).getAllByText("Wood")).toHaveLength(1);
  });

  it("listings_rows_show_beast_type_and_level", async () => {
    mockUseCollectionListingsQuery.mockReturnValue(
      successQuery([
        {
          id: 101,
          tokenId: 42,
          token: {
            token_id: "42",
            metadata: {
              attributes: [
                { name: "Beast", value: "Phoenix" },
                { trait_type: "Level", value: 12 },
                { trait_type: "Power", value: 1800 },
              ],
            },
          },
        },
      ]),
    );

    const user = userEvent.setup();
    render(<CollectionMarketPanel address="0xbeast" />);
    await user.click(screen.getByRole("tab", { name: /listings/i }));

    const listingsPanel = screen.getByTestId("listings-panel");
    expect(within(listingsPanel).getByText("Type Phoenix")).toBeVisible();
    expect(within(listingsPanel).getByText("Level 12")).toBeVisible();
  });

  it("generic_collections_do_not_render_extra_detail_chips", async () => {
    mockUseCollectionListingsQuery.mockReturnValue(
      successQuery([
        {
          id: 101,
          tokenId: 42,
          token: {
            token_id: "42",
            metadata: {
              attributes: [
                { trait_type: "Resource", value: "Wood" },
                { trait_type: "Level", value: 12 },
              ],
            },
          },
        },
      ]),
    );

    const user = userEvent.setup();
    render(<CollectionMarketPanel address="0xgeneric" />);
    await user.click(screen.getByRole("tab", { name: /listings/i }));

    const listingsPanel = screen.getByTestId("listings-panel");
    expect(within(listingsPanel).queryByText("Wood")).toBeNull();
    expect(within(listingsPanel).queryByText("Level 12")).toBeNull();
  });

  it("listings_rows_expose_token_detail_navigation", async () => {
    const routeTokenId = "0x000000000000000000000000000000000000000000000000000000000000002a";
    mockUseCollectionListingsQuery.mockReturnValue(
      successQuery([
        {
          id: 101,
          tokenId: 42,
          price: "88",
          owner: "0x1234567890abcdef",
          status: "Placed",
          createdAt: "2024-11-16T10:30:00.000Z",
          token: {
            token_id: routeTokenId,
            metadata: { image: "https://cdn.example/token-42.png" },
          },
        },
      ]),
    );

    const user = userEvent.setup();
    render(<CollectionMarketPanel address="0xabc" />);
    await user.click(screen.getByRole("tab", { name: /listings/i }));

    const listingsPanel = screen.getByTestId("listings-panel");
    expect(within(listingsPanel).getByText(/token #42/i)).toBeVisible();
    expect(within(listingsPanel).getByAltText("Token #42 preview")).toHaveAttribute(
      "src",
      "https://cdn.example/token-42.png",
    );
    expect(within(listingsPanel).getByText(/88/)).toBeVisible();
    expect(within(listingsPanel).getByText(/owner 0x1234/i)).toBeVisible();
    expect(within(listingsPanel).getByText(/2024/i)).toBeVisible();

    const tokenLink = within(listingsPanel).getByRole("link", { name: /view token/i });
    expect(tokenLink).toHaveAttribute("href", `/collections/0xabc/${routeTokenId}`);
  });
});
