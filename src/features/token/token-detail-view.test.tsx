import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { TokenDetailView } from "@/features/token/token-detail-view";

const { mockUseTokenDetailQuery, mockUseCollectionListingsQuery } = vi.hoisted(() => ({
  mockUseTokenDetailQuery: vi.fn(),
  mockUseCollectionListingsQuery: vi.fn(),
}));
const { mockUseAccount, mockMarketplaceList, mockMarketplaceOffer } = vi.hoisted(() => ({
  mockUseAccount: vi.fn(),
  mockMarketplaceList: vi.fn(),
  mockMarketplaceOffer: vi.fn(),
}));
const { mockCartAddItem } = vi.hoisted(() => ({
  mockCartAddItem: vi.fn(),
}));

vi.mock("@/lib/marketplace/hooks", () => ({
  useTokenDetailQuery: mockUseTokenDetailQuery,
  useCollectionListingsQuery: mockUseCollectionListingsQuery,
}));

vi.mock("@starknet-react/core", () => ({
  useAccount: mockUseAccount,
}));

vi.mock("@/features/cart/store/cart-store", () => ({
  useCartStore: (selector: (state: { addItem: typeof mockCartAddItem }) => unknown) =>
    selector({ addItem: mockCartAddItem }),
}));

vi.mock("@cartridge/arcade", () => ({
  ArcadeProvider: class {
    marketplace = {
      list: mockMarketplaceList,
      offer: mockMarketplaceOffer,
      execute: vi.fn(),
      cancel: vi.fn(),
    };
  },
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

function loadingQuery() {
  return {
    data: undefined,
    isLoading: true,
    isSuccess: false,
    isError: false,
    error: null,
    isFetching: true,
    refetch: vi.fn(),
  };
}

function successListingsQuery(data: Array<Record<string, unknown>>) {
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

describe("token detail view", () => {
  beforeEach(() => {
    mockUseTokenDetailQuery.mockReset();
    mockUseCollectionListingsQuery.mockReset();
    mockUseAccount.mockReset();
    mockMarketplaceList.mockReset();
    mockMarketplaceOffer.mockReset();
    mockCartAddItem.mockReset();
    mockUseCollectionListingsQuery.mockReturnValue(successListingsQuery([]));
    mockUseAccount.mockReturnValue({
      account: undefined,
      address: undefined,
      isConnected: false,
      status: "disconnected",
    });
  });

  it("renders_token_name_and_image", () => {
    mockUseTokenDetailQuery.mockReturnValue(
      successQuery({
        token: {
          token_id: "42",
          image: "https://cdn.example/dragon-42.png",
          metadata: { name: "Dragon #42" },
        },
        orders: [],
        listings: [],
      }),
    );

    render(<TokenDetailView address="0xabc" tokenId="42" />);

    expect(screen.getByRole("heading", { name: "Dragon #42" })).toBeVisible();
    expect(screen.getByAltText("Dragon #42")).toBeVisible();
    expect(screen.getByAltText("Dragon #42")).toHaveAttribute(
      "src",
      "https://cdn.example/dragon-42.png",
    );
  });

  it("renders_token_attributes", () => {
    mockUseTokenDetailQuery.mockReturnValue(
      successQuery({
        token: {
          token_id: "1",
          image: "https://cdn.example/1.png",
          metadata: {
            name: "Styled Token",
            attributes: [
              { trait_type: "Background", value: "Blue" },
              { trait_type: "Eyes", value: "Laser" },
            ],
          },
        },
        orders: [],
        listings: [],
      }),
    );

    render(<TokenDetailView address="0xabc" tokenId="1" />);

    expect(screen.getByText("Background")).toBeVisible();
    expect(screen.getByText("Blue")).toBeVisible();
    expect(screen.getByText("Eyes")).toBeVisible();
    expect(screen.getByText("Laser")).toBeVisible();
  });

  it("shows_loading_skeleton", () => {
    mockUseTokenDetailQuery.mockReturnValue(loadingQuery());

    render(<TokenDetailView address="0xabc" tokenId="1" />);

    expect(screen.getAllByTestId("token-detail-skeleton").length).toBeGreaterThan(0);
  });

  it("shows_token_listings", () => {
    mockUseCollectionListingsQuery.mockReturnValue(
      successListingsQuery([
        {
          id: 1,
          price: 1000000000000000000,
          owner: "0xowner1",
          expiration: 1735689600,
        },
        {
          id: 2,
          price: 2000000000000000000,
          owner: "0xowner2",
          expiration: 1735689600,
        },
      ]),
    );

    mockUseTokenDetailQuery.mockReturnValue(
      successQuery({
        token: {
          token_id: "1",
          image: "https://cdn.example/1.png",
          metadata: { name: "Token #1" },
        },
        orders: [],
        listings: [],
      }),
    );

    render(<TokenDetailView address="0xabc" tokenId="1" />);

    expect(screen.getByText("Listings")).toBeVisible();
    expect(screen.getByText(/0xowner1/)).toBeVisible();
    expect(screen.getByText(/0xowner2/)).toBeVisible();
  });

  it("shows_empty_listings_message", () => {
    mockUseTokenDetailQuery.mockReturnValue(
      successQuery({
        token: {
          token_id: "1",
          image: "https://cdn.example/1.png",
          metadata: { name: "Token #1" },
        },
        orders: [],
        listings: [],
      }),
    );

    render(<TokenDetailView address="0xabc" tokenId="1" />);

    expect(screen.getByText("No listings")).toBeVisible();
  });

  it("passes_correct_args_to_hook", () => {
    mockUseTokenDetailQuery.mockReturnValue(
      successQuery({
        token: {
          token_id: "7",
          image: "https://cdn.example/7.png",
          metadata: { name: "Token #7" },
        },
        orders: [],
        listings: [],
      }),
    );

    render(
      <TokenDetailView address="0x123" tokenId="7" projectId="my-project" />,
    );

    expect(mockUseTokenDetailQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "0x123",
        tokenId: "7",
        projectId: "my-project",
        fetchImages: true,
      }),
    );
  });

  it("passes_token_and_project_to_listings_query", () => {
    mockUseTokenDetailQuery.mockReturnValue(
      successQuery({
        token: {
          token_id: "7",
          image: "https://cdn.example/7.png",
          metadata: { name: "Token #7" },
        },
        orders: [],
        listings: [],
      }),
    );

    render(
      <TokenDetailView address="0x123" tokenId="7" projectId="my-project" />,
    );

    expect(mockUseCollectionListingsQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "0x123",
        tokenId: "7",
        projectId: "my-project",
        verifyOwnership: false,
      }),
    );
  });

  it("listing_verify_toggle_updates_query_option", async () => {
    mockUseTokenDetailQuery.mockReturnValue(
      successQuery({
        token: {
          token_id: "7",
          image: "https://cdn.example/7.png",
          metadata: { name: "Token #7" },
        },
        orders: [],
        listings: [],
      }),
    );

    const user = userEvent.setup();
    render(<TokenDetailView address="0x123" tokenId="7" />);

    await user.click(screen.getByRole("button", { name: /ownership unverified/i }));

    const latestArgs = mockUseCollectionListingsQuery.mock.calls.at(-1)?.[0];
    expect(latestArgs).toMatchObject({
      collection: "0x123",
      tokenId: "7",
      verifyOwnership: true,
    });
  });

  it("shows_listing_transaction_actions", () => {
    mockUseTokenDetailQuery.mockReturnValue(
      successQuery({
        token: {
          token_id: "7",
          image: "https://cdn.example/7.png",
          metadata: { name: "Token #7" },
        },
        orders: [],
        listings: [],
      }),
    );

    render(<TokenDetailView address="0x123" tokenId="7" />);

    expect(screen.getByRole("button", { name: /add cheapest to cart/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /list token/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /make offer/i })).toBeVisible();
    expect(screen.queryByRole("button", { name: /buy cheapest/i })).toBeNull();
    expect(screen.getByRole("button", { name: /cancel mine/i })).toBeVisible();
  });

  it("token_detail_exposes_add_to_cart_only", async () => {
    mockUseTokenDetailQuery.mockReturnValue(
      successQuery({
        token: {
          token_id: "7",
          image: "https://cdn.example/7.png",
          metadata: { name: "Token #7" },
        },
        orders: [],
        listings: [],
      }),
    );
    mockUseCollectionListingsQuery.mockReturnValue(
      successListingsQuery([
        { id: 19, tokenId: 7, price: 120, currency: "0xfee", quantity: 1, owner: "0xowner" },
      ]),
    );

    const user = userEvent.setup();
    render(<TokenDetailView address="0x123" tokenId="7" />);

    await user.click(screen.getByRole("button", { name: /add cheapest to cart/i }));

    expect(mockCartAddItem).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "19",
        collection: "0x123",
        tokenId: "7",
        price: "120",
        currency: "0xfee",
      }),
    );
    expect(screen.queryByRole("button", { name: /buy cheapest/i })).toBeNull();
  });

  it("list_action_calls_marketplace_list_for_connected_account", async () => {
    mockUseAccount.mockReturnValue({
      account: { execute: vi.fn() },
      address: "0xabc",
      isConnected: true,
      status: "connected",
    });
    mockMarketplaceList.mockResolvedValue({ transaction_hash: "0xhash" });

    mockUseTokenDetailQuery.mockReturnValue(
      successQuery({
        token: {
          token_id: "7",
          image: "https://cdn.example/7.png",
          metadata: { name: "Token #7" },
        },
        orders: [],
        listings: [],
      }),
    );

    const user = userEvent.setup();
    render(<TokenDetailView address="0x123" tokenId="7" />);

    await user.click(screen.getByRole("button", { name: /list token/i }));

    expect(mockMarketplaceList).toHaveBeenCalled();
    expect(mockMarketplaceList).toHaveBeenCalledWith(
      expect.anything(),
      "0x123",
      "7",
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      true,
    );
  });

  // --- New tests ---

  it("renders_token_not_found", () => {
    mockUseTokenDetailQuery.mockReturnValue({
      data: null,
      isLoading: false,
      isSuccess: true,
      isError: false,
      error: null,
      isFetching: false,
      refetch: vi.fn(),
    });

    render(<TokenDetailView address="0xabc" tokenId="99" />);

    expect(screen.getByText("Token not found.")).toBeVisible();
  });

  it("renders_no_image_fallback", () => {
    mockUseTokenDetailQuery.mockReturnValue(
      successQuery({
        token: {
          token_id: "5",
          image: null,
          metadata: { name: "Imageless Token" },
        },
        orders: [],
        listings: [],
      }),
    );

    render(<TokenDetailView address="0xabc" tokenId="5" />);

    expect(screen.getByText("No Image")).toBeVisible();
  });

  it("make_offer_calls_marketplace_offer", async () => {
    mockUseAccount.mockReturnValue({
      account: { execute: vi.fn() },
      address: "0xabc",
      isConnected: true,
      status: "connected",
    });
    mockMarketplaceOffer.mockResolvedValue({ transaction_hash: "0xofferhash" });

    mockUseTokenDetailQuery.mockReturnValue(
      successQuery({
        token: {
          token_id: "7",
          image: "https://cdn.example/7.png",
          metadata: { name: "Token #7" },
        },
        orders: [],
        listings: [],
      }),
    );

    const user = userEvent.setup();
    render(<TokenDetailView address="0x123" tokenId="7" />);

    await user.click(screen.getByRole("button", { name: /make offer/i }));

    expect(mockMarketplaceOffer).toHaveBeenCalled();
    expect(mockMarketplaceOffer).toHaveBeenCalledWith(
      expect.anything(),
      "0x123",
      "7",
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(String),
    );
  });

  it("transaction_error_shown", async () => {
    mockUseAccount.mockReturnValue({
      account: { execute: vi.fn() },
      address: "0xabc",
      isConnected: true,
      status: "connected",
    });
    mockMarketplaceList.mockRejectedValue(new Error("Transaction reverted"));

    mockUseTokenDetailQuery.mockReturnValue(
      successQuery({
        token: {
          token_id: "7",
          image: "https://cdn.example/7.png",
          metadata: { name: "Token #7" },
        },
        orders: [],
        listings: [],
      }),
    );

    const user = userEvent.setup();
    render(<TokenDetailView address="0x123" tokenId="7" />);

    await user.click(screen.getByRole("button", { name: /list token/i }));

    await waitFor(() => {
      expect(screen.getByText("Transaction reverted")).toBeVisible();
    });
  });

  it("add_to_cart_disabled_when_no_cheapest_listing", () => {
    // listings array is empty, so cheapestListing will be null -> button disabled
    mockUseCollectionListingsQuery.mockReturnValue(successListingsQuery([]));
    mockUseTokenDetailQuery.mockReturnValue(
      successQuery({
        token: {
          token_id: "7",
          image: "https://cdn.example/7.png",
          metadata: { name: "Token #7" },
        },
        orders: [],
        listings: [],
      }),
    );

    render(<TokenDetailView address="0x123" tokenId="7" />);

    expect(screen.getByRole("button", { name: /add cheapest to cart/i })).toBeDisabled();
  });

  it("refresh_listings_button_calls_refetch", async () => {
    const mockRefetch = vi.fn().mockResolvedValue({});
    mockUseCollectionListingsQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isSuccess: true,
      isError: false,
      error: null,
      isFetching: false,
      refetch: mockRefetch,
    });
    mockUseTokenDetailQuery.mockReturnValue(
      successQuery({
        token: {
          token_id: "7",
          image: "https://cdn.example/7.png",
          metadata: { name: "Token #7" },
        },
        orders: [],
        listings: [],
      }),
    );

    const user = userEvent.setup();
    render(<TokenDetailView address="0x123" tokenId="7" />);

    await user.click(screen.getByRole("button", { name: /refresh listings/i }));

    expect(mockRefetch).toHaveBeenCalled();
  });
});
