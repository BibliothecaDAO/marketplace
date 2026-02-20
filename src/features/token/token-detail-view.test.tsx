import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { TokenDetailView } from "@/features/token/token-detail-view";

const { mockUseTokenDetailQuery, mockUseCollectionListingsQuery } = vi.hoisted(() => ({
  mockUseTokenDetailQuery: vi.fn(),
  mockUseCollectionListingsQuery: vi.fn(),
}));
const { mockUseAccount } = vi.hoisted(() => ({
  mockUseAccount: vi.fn(),
}));
const { mockCartAddItem, mockCartSetOpen } = vi.hoisted(() => ({
  mockCartAddItem: vi.fn(),
  mockCartSetOpen: vi.fn(),
}));
const { mockUseTokenOwnershipQuery } = vi.hoisted(() => ({
  mockUseTokenOwnershipQuery: vi.fn(),
}));
const { mockUseTokenHolderQuery } = vi.hoisted(() => ({
  mockUseTokenHolderQuery: vi.fn(),
}));
const { mockUseMarketplaceClient, mockGetFees, mockGetRoyaltyFee } = vi.hoisted(() => ({
  mockUseMarketplaceClient: vi.fn(),
  mockGetFees: vi.fn(),
  mockGetRoyaltyFee: vi.fn(),
}));

vi.mock("@/lib/marketplace/hooks", () => ({
  useTokenDetailQuery: mockUseTokenDetailQuery,
  useCollectionListingsQuery: mockUseCollectionListingsQuery,
  useTokenOwnershipQuery: mockUseTokenOwnershipQuery,
  useTokenHolderQuery: mockUseTokenHolderQuery,
}));

vi.mock("@starknet-react/core", () => ({
  useAccount: mockUseAccount,
}));

vi.mock("@cartridge/arcade/marketplace/react", () => ({
  useMarketplaceClient: mockUseMarketplaceClient,
}));

vi.mock("@/features/cart/store/cart-store", () => ({
  useCartStore: (
    selector: (state: { addItem: typeof mockCartAddItem; setOpen: typeof mockCartSetOpen }) => unknown,
  ) => selector({ addItem: mockCartAddItem, setOpen: mockCartSetOpen }),
}));

vi.mock("@/lib/marketplace/config", () => ({
  getMarketplaceRuntimeConfig: () => ({
    collections: [
      { address: "0x123", name: "Realms", projectId: "realms" },
    ],
    chainLabel: "SN_SEPOLIA",
    sdkConfig: { chainId: "0x534e5f5345504f4c4941" },
    warnings: [],
  }),
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

const FAR_FUTURE_EXPIRATION = 4_102_444_800; // year 2100

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
    mockCartAddItem.mockReset();
    mockCartSetOpen.mockReset();
    mockCartAddItem.mockReturnValue({ ok: true });
    mockUseTokenOwnershipQuery.mockReset();
    mockUseMarketplaceClient.mockReset();
    mockGetFees.mockReset();
    mockGetRoyaltyFee.mockReset();
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
    mockUseTokenHolderQuery.mockReturnValue({
      data: null,
      status: "success",
      error: null,
      isFetching: false,
      refresh: vi.fn(),
    });
    mockGetFees.mockResolvedValue({
      feeNum: 500,
      feeDenominator: 10_000,
      feeReceiver: "0xfee-receiver",
    });
    mockGetRoyaltyFee.mockResolvedValue({
      receiver: "0xroyalty-receiver",
      amount: BigInt(0),
    });
    mockUseMarketplaceClient.mockReturnValue({
      client: {
        getFees: mockGetFees,
        getRoyaltyFee: mockGetRoyaltyFee,
      },
      status: "ready",
      error: null,
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
          expiration: FAR_FUTURE_EXPIRATION,
        },
        {
          id: 2,
          price: "500000000000000000",
          owner: "0xowner2",
          expiration: FAR_FUTURE_EXPIRATION,
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
    expect(screen.queryByText(String(FAR_FUTURE_EXPIRATION))).toBeNull();
    // Expiration should show as a date string
    expect(screen.getAllByText(/jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{4}/i).length).toBeGreaterThan(0);
  });

  it("hides_expired_listings_and_excludes_them_from_cheapest_add", async () => {
    const now = Math.floor(Date.now() / 1000);
    mockUseCollectionListingsQuery.mockReturnValue(
      successListingsQuery([
        {
          id: 1,
          tokenId: "1",
          price: "100000000000000000",
          currency: "0xstrk",
          quantity: "1",
          owner: "0xexpired",
          expiration: now - 60,
        },
        {
          id: 2,
          tokenId: "1",
          price: "200000000000000000",
          currency: "0xstrk",
          quantity: "1",
          owner: "0xactive",
          expiration: now + 3600,
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

    const user = userEvent.setup();
    render(<TokenDetailView address="0xabc" tokenId="1" />);

    expect(screen.queryByText("0xexpired")).toBeNull();
    expect(screen.getByText("0xactive")).toBeVisible();

    await user.click(screen.getByRole("button", { name: /add cheapest to cart/i }));

    expect(mockCartAddItem).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "2",
      }),
    );
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
    expect(screen.getByTestId("token-fee-empty")).toBeVisible();
  });

  it("shows_fee_estimate_loading_state", async () => {
    mockGetFees.mockReturnValue(new Promise(() => {}));
    mockGetRoyaltyFee.mockReturnValue(new Promise(() => {}));
    mockUseCollectionListingsQuery.mockReturnValue(
      successListingsQuery([
        {
          id: 11,
          tokenId: "1",
          price: "100",
          currency: "0xfee",
          quantity: "1",
          owner: "0xowner",
          expiration: FAR_FUTURE_EXPIRATION,
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

    expect(await screen.findByTestId("token-fee-loading")).toBeVisible();
  });

  it("shows_fee_estimate_error_state_when_sdk_calls_fail", async () => {
    mockGetFees.mockRejectedValue(new Error("fee endpoint unavailable"));
    mockUseCollectionListingsQuery.mockReturnValue(
      successListingsQuery([
        {
          id: 12,
          tokenId: "1",
          price: "100",
          currency: "0xfee",
          quantity: "1",
          owner: "0xowner",
          expiration: FAR_FUTURE_EXPIRATION,
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

    expect(await screen.findByTestId("token-fee-error")).toBeVisible();
  });

  it("renders_fee_estimate_breakdown_from_sdk_values", async () => {
    mockGetFees.mockResolvedValue({
      feeNum: 250,
      feeDenominator: 10_000,
      feeReceiver: "0xfee-receiver",
    });
    mockGetRoyaltyFee.mockResolvedValue({
      receiver: "0xroyalty-receiver",
      amount: BigInt(7),
    });
    mockUseCollectionListingsQuery.mockReturnValue(
      successListingsQuery([
        {
          id: 13,
          tokenId: "1",
          price: "100",
          currency: "0xfee",
          quantity: "1",
          owner: "0xowner",
          expiration: FAR_FUTURE_EXPIRATION,
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

    await waitFor(() => {
      expect(screen.getByTestId("token-fee-marketplace")).toHaveTextContent("2");
      expect(screen.getByTestId("token-fee-royalty")).toHaveTextContent("7");
      expect(screen.getByTestId("token-fee-total")).toHaveTextContent("107");
    });
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
        verifyOwnership: true,
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
        verifyOwnership: true,
      }),
    );
  });

  it("verify_ownership_toggle_not_visible", () => {
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

    // The verify ownership toggle was a debug feature — it must not be visible to users
    expect(screen.queryByRole("switch", { name: /verify ownership/i })).toBeNull();
    expect(screen.queryByLabelText(/verify ownership/i)).toBeNull();
  });

  it("listings_query_always_uses_verify_ownership_true", () => {
    mockUseTokenDetailQuery.mockReturnValue(
      successQuery({
        token: { token_id: "7", image: null, metadata: { name: "Token #7" } },
        orders: [],
        listings: [],
      }),
    );

    render(<TokenDetailView address="0x123" tokenId="7" />);

    expect(mockUseCollectionListingsQuery).toHaveBeenCalledWith(
      expect.objectContaining({ verifyOwnership: true }),
    );
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
    expect(screen.queryByRole("button", { name: /list for sale/i })).toBeNull();
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
    expect(mockCartSetOpen).toHaveBeenCalledWith(true);
    expect(screen.getAllByRole("button", { name: /added/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /buy cheapest/i })).toBeNull();
  });

  // UPDATED: checks account.execute called with list entrypoint
  it("list_action_calls_account_execute_with_list_entrypoint", async () => {
    const mockAccountExecute = vi.fn().mockResolvedValue({ transaction_hash: "0xhash" });
    mockUseAccount.mockReturnValue({
      account: { execute: mockAccountExecute },
      address: "0xabc",
      isConnected: true,
      status: "connected",
    });
    mockUseTokenOwnershipQuery.mockReturnValue(ownershipQuery(true)); // isOwner=true → effectiveIsOwner=true when holderAddress=null

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

    await user.click(screen.getByRole("button", { name: /list for sale/i }));

    expect(mockAccountExecute).toHaveBeenCalled();
    const [calls] = mockAccountExecute.mock.calls[0] as [Array<{ contractAddress: string; entrypoint: string; calldata: string[] }>];
    // calls[0] = set_approval_for_all (approve marketplace for all tokens in collection)
    expect(calls[0].entrypoint).toBe("set_approval_for_all");
    expect(calls[0].contractAddress).toBe("0x123"); // collection address
    // calls[1] = list
    expect(calls[1].entrypoint).toBe("list");
    expect(calls[1].calldata[0]).toBe("0x123"); // collection address
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

  // UPDATED: checks account.execute called with offer entrypoint
  it("make_offer_calls_account_execute_with_offer_entrypoint", async () => {
    const mockAccountExecute = vi.fn().mockResolvedValue({ transaction_hash: "0xofferhash" });
    mockUseAccount.mockReturnValue({
      account: { execute: mockAccountExecute },
      address: "0xabc",
      isConnected: true,
      status: "connected",
    });
    mockUseTokenOwnershipQuery.mockReturnValue(ownershipQuery(false)); // isOwner=false → effectiveIsOwner=false when holderAddress=null

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

    expect(mockAccountExecute).toHaveBeenCalled();
    const [calls] = mockAccountExecute.mock.calls[0] as [Array<{ contractAddress: string; entrypoint: string; calldata: string[] }>];
    expect(calls[0].entrypoint).toBe("offer");
    expect(calls[0].calldata[0]).toBe("0x123"); // collection address
  });

  // UPDATED: account.execute rejects to test error display
  it("transaction_error_shown", async () => {
    const mockAccountExecute = vi.fn().mockRejectedValue(new Error("Transaction reverted"));
    mockUseAccount.mockReturnValue({
      account: { execute: mockAccountExecute },
      address: "0xabc",
      isConnected: true,
      status: "connected",
    });
    mockUseTokenOwnershipQuery.mockReturnValue(ownershipQuery(true)); // isOwner=true → sell form shown

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

    await user.click(screen.getByRole("button", { name: /list for sale/i }));

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
          expiration: FAR_FUTURE_EXPIRATION,
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
          expiration: FAR_FUTURE_EXPIRATION,
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
    expect(screen.queryByText(String(FAR_FUTURE_EXPIRATION))).toBeNull();
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
          expiration: FAR_FUTURE_EXPIRATION,
        },
        {
          id: 2,
          tokenId: "1",
          price: "100000000000000000",
          currency: "0xstrk",
          quantity: "1",
          owner: "0xowner2",
          expiration: FAR_FUTURE_EXPIRATION,
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
    expect(screen.getByRole("button", { name: /list for sale/i })).toBeVisible();
    expect(screen.queryByRole("button", { name: /make offer/i })).toBeNull();
  });

  it("make_offer_shown_to_confirmed_non_owner", () => {
    mockUseAccount.mockReturnValue({ account: { execute: vi.fn() }, address: "0xabc", isConnected: true, status: "connected" });
    mockUseTokenOwnershipQuery.mockReturnValue(ownershipQuery(false));
    mockUseTokenDetailQuery.mockReturnValue(successQuery({ token: { token_id: "7", image: null, metadata: { name: "Token #7" } }, orders: [], listings: [] }));
    render(<TokenDetailView address="0x123" tokenId="7" />);
    expect(screen.getByRole("button", { name: /make offer/i })).toBeVisible();
    // Non-owner should NOT see the list form
    expect(screen.queryByRole("button", { name: /list for sale/i })).toBeNull();
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
    expect(screen.queryByRole("button", { name: /list for sale/i })).toBeNull();
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

  it("displays_decimal_token_id_not_hex", () => {
    mockUseTokenDetailQuery.mockReturnValue(
      successQuery({
        token: {
          token_id: "0x17a",  // hex 378 decimal
          image: "https://cdn.example/1.png",
          metadata: { name: "Token #378" },
        },
        orders: [],
        listings: [],
      }),
    );

    render(<TokenDetailView address="0xabc" tokenId="0x17a" />);

    // Should display as decimal, not raw hex
    expect(screen.getByText("#378")).toBeVisible();
    expect(screen.queryByText("#0x17a")).toBeNull();
  });

  it("owner_address_shown_as_link_to_profile", () => {
    mockUseTokenHolderQuery.mockReturnValue({
      data: {
        page: {
          balances: [
            {
              balance: "1",
              account_address: "0xholder99",
              contract_address: "0xabc",
              token_id: "1",
            },
          ],
          nextCursor: null,
        },
        error: null,
      },
      status: "success",
      error: null,
      isFetching: false,
      refresh: vi.fn(),
    });
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

    const ownerLink = screen.getByRole("link", { name: /owner/i });
    expect(ownerLink).toHaveAttribute("href", "/profile/0xholder99");
  });

  it("owner_not_shown_when_holder_unknown", () => {
    mockUseTokenHolderQuery.mockReturnValue({
      data: { page: { balances: [], nextCursor: null }, error: null },
      status: "success",
      error: null,
      isFetching: false,
      refresh: vi.fn(),
    });
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

    expect(screen.queryByRole("link", { name: /owner/i })).toBeNull();
  });

  // M3: Cancel button label
  it("cancel_listing_button_labeled_cancel_my_listing", () => {
    const mockAccountExecute = vi.fn().mockResolvedValue({ transaction_hash: "0xhash" });
    mockUseAccount.mockReturnValue({
      account: { execute: mockAccountExecute },
      address: "0xabc",
      isConnected: true,
      status: "connected",
    });
    mockUseTokenOwnershipQuery.mockReturnValue(ownershipQuery(true));
    mockUseCollectionListingsQuery.mockReturnValue(
      successListingsQuery([
        { id: 77, tokenId: "7", price: "100", currency: "0xstrk", quantity: "1", owner: "0xabc", expiration: FAR_FUTURE_EXPIRATION },
      ]),
    );
    mockUseTokenDetailQuery.mockReturnValue(
      successQuery({ token: { token_id: "7", image: null, metadata: { name: "Token #7" } }, orders: [], listings: [] }),
    );

    render(<TokenDetailView address="0x123" tokenId="7" />);

    expect(screen.getByRole("button", { name: /^cancel$/i })).toBeVisible();
  });

  // M3: Sell form has distinct heading
  it("sell_form_has_list_this_token_heading", () => {
    mockUseAccount.mockReturnValue({
      account: { execute: vi.fn() },
      address: "0xabc",
      isConnected: true,
      status: "connected",
    });
    mockUseTokenOwnershipQuery.mockReturnValue(ownershipQuery(true));
    mockUseTokenDetailQuery.mockReturnValue(
      successQuery({ token: { token_id: "7", image: null, metadata: { name: "Token #7" } }, orders: [], listings: [] }),
    );

    render(<TokenDetailView address="0x123" tokenId="7" />);

    expect(screen.getAllByText(/list for sale/i)[0]).toBeVisible();
  });

  // M3: Offer form has distinct heading
  it("offer_form_has_make_an_offer_heading", () => {
    mockUseAccount.mockReturnValue({
      account: { execute: vi.fn() },
      address: "0xabc",
      isConnected: true,
      status: "connected",
    });
    mockUseTokenOwnershipQuery.mockReturnValue(ownershipQuery(false));
    mockUseTokenDetailQuery.mockReturnValue(
      successQuery({ token: { token_id: "7", image: null, metadata: { name: "Token #7" } }, orders: [], listings: [] }),
    );

    render(<TokenDetailView address="0x123" tokenId="7" />);

    expect(screen.getByText(/make an offer/i)).toBeVisible();
  });

  // M3: tx status auto-clears — verify setTimeout is registered with 5000ms
  it("tx_status_registers_5s_auto_clear_timer_on_success", async () => {
    const mockAccountExecute = vi.fn().mockResolvedValue({ transaction_hash: "0xtxhash" });
    mockUseAccount.mockReturnValue({
      account: { execute: mockAccountExecute },
      address: "0xabc",
      isConnected: true,
      status: "connected",
    });
    mockUseTokenOwnershipQuery.mockReturnValue(ownershipQuery(true));
    mockUseTokenDetailQuery.mockReturnValue(
      successQuery({ token: { token_id: "7", image: null, metadata: { name: "Token #7" } }, orders: [], listings: [] }),
    );

    const setTimeoutSpy = vi.spyOn(window, "setTimeout");

    const user = userEvent.setup();
    render(<TokenDetailView address="0x123" tokenId="7" />);

    await user.click(screen.getByRole("button", { name: /list for sale/i }));

    await waitFor(() => {
      expect(screen.getByText(/transaction submitted/i)).toBeVisible();
    });

    // The auto-clear useEffect should have scheduled a 5000ms timer
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 5000);

    setTimeoutSpy.mockRestore();
  });


  it("breadcrumb_shows_home_link", () => {
    mockUseTokenDetailQuery.mockReturnValue(
      successQuery({ token: { token_id: "7", image: null, metadata: { name: "Token #7" } }, orders: [], listings: [] }),
    );

    render(<TokenDetailView address="0x123" tokenId="7" />);

    const homeLink = screen.getByRole("link", { name: /home/i });
    expect(homeLink).toHaveAttribute("href", "/");
  });

  it("breadcrumb_shows_collection_name_from_config", () => {
    mockUseTokenDetailQuery.mockReturnValue(
      successQuery({ token: { token_id: "7", image: null, metadata: { name: "Token #7" } }, orders: [], listings: [] }),
    );

    render(<TokenDetailView address="0x123" tokenId="7" />);

    // 0x123 maps to "Realms" in the mocked config
    const collectionLink = screen.getByRole("link", { name: /realms/i });
    expect(collectionLink).toHaveAttribute("href", "/collections/0x123");
  });

  it("breadcrumb_falls_back_to_address_for_unknown_collection", () => {
    mockUseTokenDetailQuery.mockReturnValue(
      successQuery({ token: { token_id: "7", image: null, metadata: { name: "Token #7" } }, orders: [], listings: [] }),
    );

    render(<TokenDetailView address="0xunknown" tokenId="7" />);

    const collectionLink = screen.getByRole("link", { name: /0xunknown/i });
    expect(collectionLink).toHaveAttribute("href", "/collections/0xunknown");
  });

  it("trait_box_links_to_collection_with_filter", () => {
    mockUseTokenDetailQuery.mockReturnValue(
      successQuery({
        token: {
          token_id: "7",
          image: null,
          metadata: {
            name: "Token #7",
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

    render(<TokenDetailView address="0x123" tokenId="7" />);

    const bgLink = screen.getByRole("link", { name: /background.*blue/i });
    expect(bgLink).toHaveAttribute("href", "/collections/0x123?trait=Background%3ABlue");

    const eyesLink = screen.getByRole("link", { name: /eyes.*laser/i });
    expect(eyesLink).toHaveAttribute("href", "/collections/0x123?trait=Eyes%3ALaser");
  });

  it("listing_owner_is_a_link_to_profile_page", () => {
    // Use a short address (≤14 chars) so truncation doesn't change it
    const ownerAddress = "0xseller99";
    mockUseCollectionListingsQuery.mockReturnValue(
      successListingsQuery([
        {
          id: 1,
          price: "500000000000000000",
          owner: ownerAddress,
          expiration: FAR_FUTURE_EXPIRATION,
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

    // The owner address should be displayed as a link to their profile
    const ownerText = screen.getByText(ownerAddress);
    const link = ownerText.closest("a");
    expect(link).not.toBeNull();
    expect(link).toHaveAttribute("href", `/profile/${ownerAddress}`);
  });
});
