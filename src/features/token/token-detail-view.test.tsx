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
const { mockUseTokenOwnershipQuery } = vi.hoisted(() => ({
  mockUseTokenOwnershipQuery: vi.fn(),
}));

vi.mock("@/lib/marketplace/hooks", () => ({
  useTokenDetailQuery: mockUseTokenDetailQuery,
  useCollectionListingsQuery: mockUseCollectionListingsQuery,
  useTokenOwnershipQuery: mockUseTokenOwnershipQuery,
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

function ownershipQuery(ownsToken: boolean) {
  return {
    data: ownsToken ? {
      page: {
        balances: [{ balance: "1", account_address: "0xabc", contract_address: "0x123", token_id: "7" }],
        nextCursor: null,
      },
      error: null,
    } : { page: { balances: [], nextCursor: null }, error: null },
    status: "success",
    error: null,
    isFetching: false,
    refresh: vi.fn(),
  };
}

function ownershipLoadingQuery() {
  return {
    data: null,
    status: "loading",
    error: null,
    isFetching: true,
    refresh: vi.fn(),
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
    mockUseTokenOwnershipQuery.mockReset();
    mockUseCollectionListingsQuery.mockReturnValue(successListingsQuery([]));
    mockUseAccount.mockReturnValue({
      account: undefined,
      address: undefined,
      isConnected: false,
      status: "disconnected",
    });
    mockUseTokenOwnershipQuery.mockReturnValue({
      data: null,
      status: "success",
      error: null,
      isFetching: false,
      refresh: vi.fn(),
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
          price: "150000000000000000000",
          owner: "0xowner1",
          expiration: 1735689600,
        },
        {
          id: 2,
          price: "500000000000000000",
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
    expect(screen.getByText("150")).toBeVisible();
    expect(screen.getByText("0.5")).toBeVisible();
    expect(screen.queryByText("150000000000000000000")).toBeNull();
    // Expiration should NOT show raw timestamp
    expect(screen.queryByText("1735689600")).toBeNull();
    // Expiration should show as a date string
    expect(screen.getAllByText(/jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{4}/i).length).toBeGreaterThan(0);
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

  it("normalizes_hex_route_token_id_for_detail_and_listings_queries", () => {
    mockUseTokenDetailQuery.mockReturnValue(
      successQuery({
        token: {
          token_id: "1120",
          image: "https://cdn.example/1120.png",
          metadata: { name: "Token #1120" },
        },
        orders: [],
        listings: [],
      }),
    );

    render(
      <TokenDetailView address="0x123" tokenId="0x460" projectId="my-project" />,
    );

    expect(mockUseTokenDetailQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "0x123",
        tokenId: "1120",
        projectId: "my-project",
        fetchImages: true,
      }),
    );

    expect(mockUseCollectionListingsQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "0x123",
        tokenId: "1120",
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

    // Changed from button to switch
    await user.click(screen.getByRole("switch", { name: /verify ownership/i }));

    const latestArgs = mockUseCollectionListingsQuery.mock.calls.at(-1)?.[0];
    expect(latestArgs).toMatchObject({
      collection: "0x123",
      tokenId: "7",
      verifyOwnership: true,
    });
  });

  // UPDATED: was shows_listing_transaction_actions — now tests NOT-connected state
  it("shows_connect_prompt_when_wallet_not_connected", () => {
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
    expect(screen.getByText(/connect wallet to transact/i)).toBeVisible();
    expect(screen.queryByRole("button", { name: /list token/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /make offer/i })).toBeNull();
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

  // UPDATED: must be owner to see "List token"
  it("list_action_calls_marketplace_list_for_connected_account", async () => {
    mockUseAccount.mockReturnValue({
      account: { execute: vi.fn() },
      address: "0xabc",
      isConnected: true,
      status: "connected",
    });
    mockUseTokenOwnershipQuery.mockReturnValue(ownershipQuery(true)); // MUST OWN
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

  // UPDATED: non-owner sees "Make offer", not owner
  it("make_offer_calls_marketplace_offer", async () => {
    mockUseAccount.mockReturnValue({
      account: { execute: vi.fn() },
      address: "0xabc",
      isConnected: true,
      status: "connected",
    });
    mockUseTokenOwnershipQuery.mockReturnValue(ownershipQuery(false)); // NOT owner
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

  // UPDATED: must be owner to see "List token"
  it("transaction_error_shown", async () => {
    mockUseAccount.mockReturnValue({
      account: { execute: vi.fn() },
      address: "0xabc",
      isConnected: true,
      status: "connected",
    });
    mockUseTokenOwnershipQuery.mockReturnValue(ownershipQuery(true)); // MUST OWN
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

  // --- New tests for UX improvements ---

  it("price_input_defaults_to_human_readable", () => {
    mockUseAccount.mockReturnValue({
      account: { execute: vi.fn() },
      address: "0xabc",
      isConnected: true,
      status: "connected",
    });
    mockUseTokenOwnershipQuery.mockReturnValue(ownershipQuery(true));
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

    // Default price should be "1" (human-readable STRK), not raw wei
    const priceInput = screen.getByRole("spinbutton", { name: /price/i });
    expect(priceInput).toHaveValue(1);
    // Raw wei form should not be present
    expect(screen.queryByDisplayValue("1000000000000000000")).toBeNull();
  });

  it("listing_owner_address_truncated_when_long", () => {
    const longAddress = "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7";
    mockUseCollectionListingsQuery.mockReturnValue(
      successListingsQuery([
        {
          id: 1,
          price: "500000000000000000",
          owner: longAddress,
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

    // Full address should NOT appear
    expect(screen.queryByText(longAddress)).toBeNull();
    // Truncated form should appear: first 6 chars + "..." + last 4
    expect(screen.getByText("0x049d...4dc7")).toBeVisible();
  });

  it("expiration_shown_as_date_not_timestamp", () => {
    mockUseCollectionListingsQuery.mockReturnValue(
      successListingsQuery([
        {
          id: 1,
          price: "500000000000000000",
          owner: "0xowner1",
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

    // Raw timestamp should NOT appear
    expect(screen.queryByText("1735689600")).toBeNull();
    // A date string should appear (matches month name or year)
    expect(screen.getAllByText(/jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{4}/i).length).toBeGreaterThan(0);
  });

  it("cheapest_listing_has_best_price_badge", () => {
    mockUseCollectionListingsQuery.mockReturnValue(
      successListingsQuery([
        {
          id: 1,
          tokenId: "1",
          price: "500000000000000000",
          currency: "0xstrk",
          quantity: "1",
          owner: "0xowner1",
          expiration: 1735689600,
        },
        {
          id: 2,
          tokenId: "1",
          price: "100000000000000000",
          currency: "0xstrk",
          quantity: "1",
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

    // Exactly one "Best Price" badge should exist
    expect(screen.getAllByText("Best Price")).toHaveLength(1);
  });

  it("expiration_preset_select_exists", () => {
    mockUseAccount.mockReturnValue({
      account: { execute: vi.fn() },
      address: "0xabc",
      isConnected: true,
      status: "connected",
    });
    mockUseTokenOwnershipQuery.mockReturnValue(ownershipQuery(true));
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

    // Should have a combobox/select labeled "Expires in"
    expect(screen.getByRole("combobox", { name: /expires in/i })).toBeVisible();
    // Should NOT have raw expiration text input
    expect(screen.queryByRole("textbox", { name: /expiration/i })).toBeNull();
  });

  it("currency_input_is_not_shown", () => {
    mockUseAccount.mockReturnValue({
      account: { execute: vi.fn() },
      address: "0xabc",
      isConnected: true,
      status: "connected",
    });
    mockUseTokenOwnershipQuery.mockReturnValue(ownershipQuery(true));
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

    // Currency input should NOT be shown
    expect(screen.queryByRole("textbox", { name: /currency/i })).toBeNull();
    expect(screen.queryByPlaceholderText(/currency/i)).toBeNull();
  });

  // --- NEW ownership-gating tests ---

  it("list_token_shown_only_to_owner", () => {
    mockUseAccount.mockReturnValue({ account: { execute: vi.fn() }, address: "0xabc", isConnected: true, status: "connected" });
    mockUseTokenOwnershipQuery.mockReturnValue(ownershipQuery(true));
    mockUseTokenDetailQuery.mockReturnValue(successQuery({ token: { token_id: "7", image: null, metadata: { name: "Token #7" } }, orders: [], listings: [] }));
    render(<TokenDetailView address="0x123" tokenId="7" />);
    expect(screen.getByRole("button", { name: /list token/i })).toBeVisible();
    expect(screen.queryByRole("button", { name: /make offer/i })).toBeNull();
  });

  it("make_offer_shown_only_to_non_owner", () => {
    mockUseAccount.mockReturnValue({ account: { execute: vi.fn() }, address: "0xabc", isConnected: true, status: "connected" });
    mockUseTokenOwnershipQuery.mockReturnValue(ownershipQuery(false));
    mockUseTokenDetailQuery.mockReturnValue(successQuery({ token: { token_id: "7", image: null, metadata: { name: "Token #7" } }, orders: [], listings: [] }));
    render(<TokenDetailView address="0x123" tokenId="7" />);
    expect(screen.getByRole("button", { name: /make offer/i })).toBeVisible();
    expect(screen.queryByRole("button", { name: /list token/i })).toBeNull();
  });

  it("you_own_this_badge_shown_when_owner", () => {
    mockUseAccount.mockReturnValue({ account: undefined, address: "0xabc", isConnected: true, status: "connected" });
    mockUseTokenOwnershipQuery.mockReturnValue(ownershipQuery(true));
    mockUseTokenDetailQuery.mockReturnValue(successQuery({ token: { token_id: "7", image: null, metadata: { name: "Token #7" } }, orders: [], listings: [] }));
    render(<TokenDetailView address="0x123" tokenId="7" />);
    expect(screen.getByText(/you own this token/i)).toBeVisible();
  });

  it("ownership_loading_state_shown", () => {
    mockUseAccount.mockReturnValue({ account: undefined, address: "0xabc", isConnected: true, status: "connected" });
    mockUseTokenOwnershipQuery.mockReturnValue(ownershipLoadingQuery());
    mockUseTokenDetailQuery.mockReturnValue(successQuery({ token: { token_id: "7", image: null, metadata: { name: "Token #7" } }, orders: [], listings: [] }));
    render(<TokenDetailView address="0x123" tokenId="7" />);
    expect(screen.getByText(/checking ownership/i)).toBeVisible();
  });

  it("no_sell_form_when_not_connected", () => {
    // isConnected: false (default in beforeEach)
    mockUseTokenDetailQuery.mockReturnValue(successQuery({ token: { token_id: "7", image: null, metadata: { name: "Token #7" } }, orders: [], listings: [] }));
    render(<TokenDetailView address="0x123" tokenId="7" />);
    expect(screen.queryByRole("button", { name: /list token/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /make offer/i })).toBeNull();
    expect(screen.getByText(/connect wallet to transact/i)).toBeVisible();
  });

  it("ownership_query_called_with_wallet_address", () => {
    mockUseAccount.mockReturnValue({ account: undefined, address: "0xwallet", isConnected: true, status: "connected" });
    mockUseTokenDetailQuery.mockReturnValue(successQuery({ token: { token_id: "7", image: null, metadata: { name: "Token #7" } }, orders: [], listings: [] }));
    render(<TokenDetailView address="0x123" tokenId="7" />);
    expect(mockUseTokenOwnershipQuery).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "0x123", tokenId: "7", accountAddress: "0xwallet" })
    );
  });
});
