import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CollectionTokenGrid } from "@/features/collections/collection-token-grid";
import type { ActiveFilters } from "@/lib/marketplace/traits";

const { mockUseCollectionTokensQuery, mockUseCollectionListingsQuery } = vi.hoisted(() => ({
  mockUseCollectionTokensQuery: vi.fn(),
  mockUseCollectionListingsQuery: vi.fn(),
}));
const { mockCartAddItem } = vi.hoisted(() => ({
  mockCartAddItem: vi.fn(),
}));

vi.mock("@/lib/marketplace/hooks", () => ({
  useCollectionTokensQuery: mockUseCollectionTokensQuery,
  useCollectionListingsQuery: mockUseCollectionListingsQuery,
}));

vi.mock("@/features/cart/store/cart-store", () => ({
  useCartStore: (selector: (state: { addItem: typeof mockCartAddItem }) => unknown) =>
    selector({ addItem: mockCartAddItem }),
}));

function token(tokenId: string, overrides?: Record<string, unknown>) {
  return {
    token_id: tokenId,
    metadata: { name: `Token #${tokenId}` },
    ...overrides,
  };
}

function successListingsResult(listings: Array<Record<string, unknown>>) {
  return {
    data: listings,
    isLoading: false,
    isSuccess: true,
    isError: false,
    error: null,
    isFetching: false,
    refetch: vi.fn(),
  };
}

describe("collection token grid", () => {
  beforeEach(() => {
    mockUseCollectionTokensQuery.mockReset();
    mockUseCollectionListingsQuery.mockReset();
    mockCartAddItem.mockReset();
    mockUseCollectionListingsQuery.mockReturnValue(successListingsResult([]));
  });

  it("token_grid_renders_first_page_with_skeleton_then_data", async () => {
    let isLoaded = false;
    mockUseCollectionTokensQuery.mockImplementation(() => {
      if (isLoaded) {
        return {
          data: {
            page: {
              tokens: [token("1"), token("2")],
              nextCursor: null,
            },
            error: null,
          },
          isLoading: false,
          isSuccess: true,
          isError: false,
          error: null,
          isFetching: false,
          refetch: vi.fn(),
        };
      }

      return {
        data: undefined,
        isLoading: true,
        isSuccess: false,
        isError: false,
        error: null,
        isFetching: true,
        refetch: vi.fn(),
      };
    });

    const { rerender } = render(
      <CollectionTokenGrid address="0xabc" projectId="project-a" />,
    );

    expect(screen.getAllByTestId("token-skeleton")).toHaveLength(6);

    isLoaded = true;

    rerender(<CollectionTokenGrid address="0xabc" projectId="project-a" />);

    expect(await screen.findByText("Token #1")).toBeVisible();
    expect(await screen.findByText("Token #2")).toBeVisible();
  });

  it("token_grid_loads_next_cursor_page_without_duplicates", async () => {
    mockUseCollectionTokensQuery.mockImplementation((options) => {
      const cursor = options?.cursor;
      if (cursor === "cursor-2") {
        return {
          data: {
            page: {
              tokens: [token("2"), token("3")],
              nextCursor: null,
            },
            error: null,
          },
          isLoading: false,
          isSuccess: true,
          isError: false,
          error: null,
          isFetching: false,
          refetch: vi.fn(),
        };
      }

      return {
        data: {
          page: {
            tokens: [token("1"), token("2")],
            nextCursor: "cursor-2",
          },
          error: null,
        },
        isLoading: false,
        isSuccess: true,
        isError: false,
        error: null,
        isFetching: false,
        refetch: vi.fn(),
      };
    });

    const user = userEvent.setup();
    render(<CollectionTokenGrid address="0xabc" projectId="project-a" />);

    expect(screen.getByText("Token #1")).toBeVisible();
    expect(screen.getByText("Token #2")).toBeVisible();
    await user.click(screen.getByRole("button", { name: /load more/i }));

    expect(
      await screen.findByRole("article", { name: "token-3" }),
    ).toBeVisible();
    expect(screen.getAllByText("Token #2")).toHaveLength(1);
  });

  it("token_grid_respects_limit_and_tokenIds_filters", () => {
    mockUseCollectionTokensQuery.mockReturnValue({
      data: {
        page: {
          tokens: [],
          nextCursor: null,
        },
        error: null,
      },
      isLoading: false,
      isSuccess: true,
      isError: false,
      error: null,
      isFetching: false,
      refetch: vi.fn(),
    });

    render(
      <CollectionTokenGrid
        address="0xabc"
        projectId="project-a"
        limit={10}
        tokenIds={["7", "9"]}
      />,
    );

    expect(mockUseCollectionTokensQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        address: "0xabc",
        project: "project-a",
        limit: 10,
        tokenIds: ["7", "9"],
      }),
    );
  });

  it("token_grid_uses_image_fallback_when_missing", async () => {
    mockUseCollectionTokensQuery.mockReturnValue({
      data: {
        page: {
          tokens: [
            token("1", {
              image: undefined,
              metadata: {
                name: "Token #1",
                image_url: "https://cdn.example/token-1.png",
              },
            }),
          ],
          nextCursor: null,
        },
        error: null,
      },
      isLoading: false,
      isSuccess: true,
      isError: false,
      error: null,
      isFetching: false,
      refetch: vi.fn(),
    });

    render(<CollectionTokenGrid address="0xabc" projectId="project-a" />);

    expect(await screen.findByAltText("Token #1")).toHaveAttribute(
      "src",
      "https://cdn.example/token-1.png",
    );
  });

  it("token_cards_link_to_token_detail_page", () => {
    mockUseCollectionTokensQuery.mockReturnValue({
      data: {
        page: {
          tokens: [
            token("1", {
              image: "https://cdn.example/1.png",
              metadata: { name: "Token #1" },
            }),
            token("2", {
              image: "https://cdn.example/2.png",
              metadata: { name: "Token #2" },
            }),
          ],
          nextCursor: null,
        },
        error: null,
      },
      isLoading: false,
      isSuccess: true,
      isError: false,
      error: null,
      isFetching: false,
      refetch: vi.fn(),
    });

    render(<CollectionTokenGrid address="0xabc" projectId="project-a" />);

    const link = screen.getByRole("link", { name: "token-1" });
    expect(link).toBeVisible();
    expect(link).toHaveAttribute("href", "/collections/0xabc/1");

    const link2 = screen.getByRole("link", { name: "token-2" });
    expect(link2).toBeVisible();
    expect(link2).toHaveAttribute("href", "/collections/0xabc/2");
  });

  it("token_grid_filters_tokens_by_active_filters", async () => {
    const filters: ActiveFilters = { Background: new Set(["Blue"]) };
    mockUseCollectionTokensQuery.mockReturnValue({
      data: {
        page: {
          tokens: [
            token("1", {
              metadata: {
                name: "Token #1",
                attributes: [{ trait_type: "Background", value: "Blue" }],
              },
            }),
            token("2", {
              metadata: {
                name: "Token #2",
                attributes: [{ trait_type: "Background", value: "Red" }],
              },
            }),
          ],
          nextCursor: null,
        },
        error: null,
      },
      isLoading: false,
      isSuccess: true,
      isError: false,
      error: null,
      isFetching: false,
      refetch: vi.fn(),
    });

    render(
      <CollectionTokenGrid
        activeFilters={filters}
        address="0xabc"
        projectId="project-a"
      />,
    );

    expect(await screen.findByText("Token #1")).toBeVisible();
    expect(screen.queryByText("Token #2")).toBeNull();
  });

  it("formats_hex_ids_and_renders_price_in_shared_card_layout", async () => {
    mockUseCollectionTokensQuery.mockReturnValue({
      data: {
        page: {
          tokens: [
            token("0x460", {
              image: "https://cdn.example/1120.png",
              metadata: { name: "Golden Token #1120" },
            }),
          ],
          nextCursor: null,
        },
        error: null,
      },
      isLoading: false,
      isSuccess: true,
      isError: false,
      error: null,
      isFetching: false,
      refetch: vi.fn(),
    });
    mockUseCollectionListingsQuery.mockReturnValue(
      successListingsResult([
        {
          id: 501,
          tokenId: "0x460",
          price: 77,
          currency: "0xfee",
          quantity: 1,
        },
      ]),
    );

    render(<CollectionTokenGrid address="0xabc" projectId="project-a" />);

    expect(await screen.findByText("#1120")).toBeVisible();
    expect(screen.getByText("Price: 77")).toBeVisible();

    const tokenLink = screen.getByRole("link", { name: "token-1120" });
    const card = tokenLink.querySelector("[data-slot='card']");
    expect(card).toHaveClass("py-0", "overflow-hidden");
  });

  it("passes_collection_listing_query_args", () => {
    mockUseCollectionTokensQuery.mockReturnValue({
      data: { page: { tokens: [], nextCursor: null }, error: null },
      isLoading: false,
      isSuccess: true,
      isError: false,
      error: null,
      isFetching: false,
      refetch: vi.fn(),
    });

    render(<CollectionTokenGrid address="0xabc" projectId="project-a" />);

    expect(mockUseCollectionListingsQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "0xabc",
        projectId: "project-a",
        verifyOwnership: false,
      }),
    );
  });

  it("token_grid_add_to_cart_resolves_cheapest_listing", async () => {
    mockUseCollectionTokensQuery.mockReturnValue({
      data: {
        page: {
          tokens: [
            token("1", {
              image: "https://cdn.example/1.png",
              metadata: { name: "Token #1" },
            }),
          ],
          nextCursor: null,
        },
        error: null,
      },
      isLoading: false,
      isSuccess: true,
      isError: false,
      error: null,
      isFetching: false,
      refetch: vi.fn(),
    });
    mockUseCollectionListingsQuery.mockReturnValue(
      successListingsResult([
        { id: 21, tokenId: 1, price: 200, currency: "0xfee", quantity: 1 },
        { id: 22, tokenId: 1, price: 120, currency: "0xfee", quantity: 1 },
      ]),
    );

    const user = userEvent.setup();
    render(<CollectionTokenGrid address="0xabc" projectId="project-a" />);

    await user.click(screen.getByRole("button", { name: /add to cart/i }));

    expect(mockCartAddItem).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "22",
        collection: "0xabc",
        tokenId: "1",
        price: "120",
      }),
    );
  });

  it("grid_density_selector_updates_grid_columns", async () => {
    mockUseCollectionTokensQuery.mockReturnValue({
      data: {
        page: {
          tokens: [token("1")],
          nextCursor: null,
        },
        error: null,
      },
      isLoading: false,
      isSuccess: true,
      isError: false,
      error: null,
      isFetching: false,
      refetch: vi.fn(),
    });

    const user = userEvent.setup();
    render(<CollectionTokenGrid address="0xabc" projectId="project-a" />);

    const grid = screen.getByTestId("collection-token-grid-cards");
    expect(grid).toHaveClass("lg:grid-cols-3");

    await user.click(screen.getByRole("button", { name: /compact/i }));
    expect(grid).toHaveClass("lg:grid-cols-5");

    await user.click(screen.getByRole("button", { name: /comfort/i }));
    expect(grid).toHaveClass("lg:grid-cols-2");
  });
});
