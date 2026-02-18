import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { CollectionRow } from "@/components/marketplace/collection-row";

const { mockUseCollectionTokensQuery } = vi.hoisted(() => ({
  mockUseCollectionTokensQuery: vi.fn(),
}));
const { mockUseCollectionListingsQuery } = vi.hoisted(() => ({
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

function successResult(tokens: ReturnType<typeof token>[]) {
  return {
    data: {
      page: {
        tokens,
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

describe("collection row", () => {
  beforeEach(() => {
    mockUseCollectionTokensQuery.mockReset();
    mockUseCollectionListingsQuery.mockReset();
    mockCartAddItem.mockReset();
    mockUseCollectionTokensQuery.mockReturnValue(
      successResult([token("1"), token("2")]),
    );
    mockUseCollectionListingsQuery.mockReturnValue(successListingsResult([]));
  });

  it("renders_collection_name", () => {
    render(
      <CollectionRow address="0xabc" name="Cool Cats" />,
    );

    expect(
      screen.getByRole("heading", { name: "Cool Cats" }),
    ).toBeVisible();
  });

  it("renders_token_cards_from_sdk", () => {
    mockUseCollectionTokensQuery.mockReturnValue(
      successResult([
        token("1", {
          image: "https://cdn.example/1.png",
          metadata: { name: "Alpha" },
        }),
        token("2", {
          image: "https://cdn.example/2.png",
          metadata: { name: "Beta" },
        }),
        token("3", {
          image: "https://cdn.example/3.png",
          metadata: { name: "Gamma" },
        }),
      ]),
    );

    render(
      <CollectionRow address="0xabc" name="My Collection" />,
    );

    expect(screen.getByText("Alpha")).toBeVisible();
    expect(screen.getByAltText("Alpha")).toBeVisible();
    expect(screen.getByText("Beta")).toBeVisible();
    expect(screen.getByAltText("Beta")).toBeVisible();
    expect(screen.getByText("Gamma")).toBeVisible();
    expect(screen.getByAltText("Gamma")).toBeVisible();
  });

  it("shows_skeleton_while_loading", () => {
    mockUseCollectionTokensQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isSuccess: false,
      isError: false,
      error: null,
      isFetching: true,
      refetch: vi.fn(),
    });

    render(
      <CollectionRow address="0xabc" name="Loading Collection" />,
    );

    expect(screen.getAllByTestId("collection-row-skeleton")).toHaveLength(6);
  });

  it("shows_empty_state_when_no_tokens", () => {
    mockUseCollectionTokensQuery.mockReturnValue(
      successResult([]),
    );

    render(
      <CollectionRow address="0xabc" name="Empty Collection" />,
    );

    expect(screen.getByText(/ls tokens/i)).toBeVisible();
  });

  it("passes_correct_args_to_hook", () => {
    render(
      <CollectionRow
        address="0x123"
        name="Test Collection"
        projectId="my-project"
      />,
    );

    expect(mockUseCollectionTokensQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        address: "0x123",
        project: "my-project",
        limit: 12,
        fetchImages: true,
      }),
    );
  });

  it("links_collection_name_to_detail_page", () => {
    render(
      <CollectionRow address="0xdef" name="Linked Collection" />,
    );

    const link = screen.getByRole("link", { name: "Linked Collection" });
    expect(link).toBeVisible();
    expect(link).toHaveAttribute("href", "/collections/0xdef");
  });

  it("token_cards_link_to_token_page", () => {
    mockUseCollectionTokensQuery.mockReturnValue(
      successResult([
        token("1", {
          image: "https://cdn.example/1.png",
          metadata: { name: "Alpha" },
        }),
      ]),
    );

    render(
      <CollectionRow address="0xabc" name="Clickable Collection" />,
    );

    const tokenLink = screen.getByRole("link", { name: /alpha/i });
    expect(tokenLink).toBeVisible();
    expect(tokenLink).toHaveAttribute("href", "/collections/0xabc/1");
  });

  it("formats_hex_token_ids_for_display", () => {
    mockUseCollectionTokensQuery.mockReturnValue(
      successResult([
        token("0x460", {
          image: "https://cdn.example/1120.png",
          metadata: { name: "Golden Token #1120" },
        }),
      ]),
    );

    render(
      <CollectionRow address="0xabc" name="Hex Collection" />,
    );

    expect(screen.getByText("#1120")).toBeVisible();
    expect(screen.queryByText("#0x460")).toBeNull();
  });

  it("renders_price_below_token_id", () => {
    mockUseCollectionListingsQuery.mockReturnValue(
      successListingsResult([
        {
          id: 7,
          tokenId: 1,
          price: 100,
          currency: "0xfee",
          quantity: 1,
          owner: "0xowner",
        },
      ]),
    );

    mockUseCollectionTokensQuery.mockReturnValue(
      successResult([
        token("1", {
          image: "https://cdn.example/1.png",
          metadata: { name: "Alpha" },
        }),
      ]),
    );

    render(
      <CollectionRow address="0xabc" name="Priced Collection" />,
    );

    expect(screen.getByText("Price: 100")).toBeVisible();
  });

  it("passes_collection_listing_query_args", () => {
    render(
      <CollectionRow
        address="0x123"
        name="Listings Hook Collection"
        projectId="my-project"
      />,
    );

    expect(mockUseCollectionListingsQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "0x123",
        projectId: "my-project",
        verifyOwnership: false,
      }),
    );
  });

  it("collection_and_home_add_to_cart_resolves_cheapest_listing", async () => {
    const user = userEvent.setup();
    mockUseCollectionListingsQuery.mockReturnValue(
      successListingsResult([
        { id: 10, tokenId: 1, price: 150, currency: "0xfee", quantity: 1 },
        { id: 11, tokenId: 1, price: 90, currency: "0xfee", quantity: 1 },
      ]),
    );
    mockUseCollectionTokensQuery.mockReturnValue(
      successResult([
        token("1", {
          image: "https://cdn.example/1.png",
          metadata: { name: "Alpha" },
        }),
      ]),
    );

    render(<CollectionRow address="0xabc" name="Addable Collection" />);

    await user.click(screen.getByRole("button", { name: /add to cart/i }));

    expect(mockCartAddItem).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "11",
        collection: "0xabc",
        tokenId: "1",
        price: "90",
        currency: "0xfee",
      }),
    );
  });

  it("makes_token_image_flush_to_card_edges", () => {
    mockUseCollectionTokensQuery.mockReturnValue(
      successResult([
        token("1", {
          image: "https://cdn.example/1.png",
          metadata: { name: "Alpha" },
        }),
      ]),
    );

    render(
      <CollectionRow address="0xabc" name="Flush Layout Collection" />,
    );

    const tokenLink = screen.getByRole("link", { name: /alpha/i });
    const card = tokenLink.querySelector("[data-slot='card']");
    expect(card).toHaveClass("py-0", "overflow-hidden");
  });
});
