import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CartSidebar } from "@/features/cart/components/cart-sidebar";
import { useCartStore } from "@/features/cart/store/cart-store";

const {
  mockUseAccount,
  mockUseBalance,
  mockUseMarketplaceClient,
  mockAccountExecute,
  mockArcadeExecute,
  mockListCollectionListings,
  mockBuildExecuteCalldata,
  mockGetFees,
  mockGetRoyaltyFee,
} = vi.hoisted(() => ({
  mockUseAccount: vi.fn(),
  mockUseBalance: vi.fn(),
  mockUseMarketplaceClient: vi.fn(),
  mockAccountExecute: vi.fn(),
  mockArcadeExecute: vi.fn(),
  mockListCollectionListings: vi.fn(),
  mockBuildExecuteCalldata: vi.fn(),
  mockGetFees: vi.fn(),
  mockGetRoyaltyFee: vi.fn(),
}));

vi.mock("@starknet-react/core", () => ({
  useAccount: mockUseAccount,
  useBalance: mockUseBalance,
}));

vi.mock("@cartridge/arcade/marketplace/react", () => ({
  useMarketplaceClient: mockUseMarketplaceClient,
}));

vi.mock("@cartridge/arcade", () => ({
  ArcadeProvider: vi.fn().mockImplementation(() => ({
    manifest: {
      abis: [{ type: "interface", name: "ARCADE::Marketplace", items: [] }],
      contracts: [{ tag: "ARCADE-Marketplace", address: "0xmarket" }],
    },
    execute: mockArcadeExecute,
    marketplace: {
      buildExecuteCalldata: mockBuildExecuteCalldata,
    },
  })),
  NAMESPACE: "ARCADE",
}));

vi.mock("@/lib/marketplace/config", () => ({
  getMarketplaceRuntimeConfig: () => ({
    chainLabel: "SN_SEPOLIA",
    sdkConfig: { chainId: "0x534e5f5345504f4c4941" },
    warnings: [],
    collections: [],
  }),
}));

function makeItem(orderId: string, tokenId: string, price: string) {
  return {
    orderId,
    collection: "0xabc",
    tokenId,
    price,
    currency: "0xfee",
    quantity: "1",
    tokenName: `Token #${tokenId}`,
  };
}

describe("cart sidebar", () => {
  beforeEach(() => {
    localStorage.clear();
    useCartStore.setState({ items: [], inlineErrors: {}, isOpen: false, lastActionError: null });

    mockAccountExecute.mockReset();
    mockArcadeExecute.mockReset();
    mockListCollectionListings.mockReset();
    mockBuildExecuteCalldata.mockReset();
    mockGetFees.mockReset();
    mockGetRoyaltyFee.mockReset();
    mockUseAccount.mockReset();
    mockUseBalance.mockReset();
    mockUseMarketplaceClient.mockReset();

    // Default: ample balance so balance check doesn't interfere with unrelated tests
    mockUseBalance.mockReturnValue({ data: { value: BigInt("999999999999999999999") }, isLoading: false });

    mockUseAccount.mockReturnValue({
      account: undefined,
      isConnected: false,
      status: "disconnected",
      address: undefined,
    });
    mockUseMarketplaceClient.mockReturnValue({
      client: {
        listCollectionListings: mockListCollectionListings,
        getFees: mockGetFees,
        getRoyaltyFee: mockGetRoyaltyFee,
      },
      status: "ready",
      error: null,
      refresh: vi.fn(),
    });
    mockGetFees.mockResolvedValue(null);
    mockGetRoyaltyFee.mockResolvedValue(null);
    mockBuildExecuteCalldata.mockImplementation((orderId: string) => ({
      contractName: "Marketplace",
      entrypoint: "execute",
      calldata: [orderId],
    }));
    mockArcadeExecute.mockResolvedValue({ transaction_hash: "0xcheckout" });
  });

  it("shows_trigger_count_in_header", () => {
    useCartStore.setState({
      items: [makeItem("7001", "1", "100")],
      inlineErrors: {},
      isOpen: false,
      lastActionError: null,
    });

    render(<CartSidebar />);

    expect(screen.getByRole("button", { name: /cart \(1\)/i })).toBeVisible();
  });

  it("cart_trigger_button_shows_icon_not_text", () => {
    useCartStore.setState({
      items: [makeItem("7001", "1", "100")],
      inlineErrors: {},
      isOpen: false,
      lastActionError: null,
    });

    render(<CartSidebar />);

    const trigger = screen.getByRole("button", { name: /cart \(1\)/i });
    // Icon button: should not display "Cart" as visible text
    expect(trigger.textContent).not.toContain("Cart");
  });

  it("empty_cart_shows_browse_collections_link", async () => {
    useCartStore.setState({
      items: [],
      inlineErrors: {},
      isOpen: false,
      lastActionError: null,
    });
    const user = userEvent.setup();

    render(<CartSidebar />);
    await user.click(screen.getByRole("button", { name: /cart \(0\)/i }));

    const browseLink = await screen.findByRole("link", { name: /browse collections/i });
    expect(browseLink).toBeVisible();
    expect(browseLink).toHaveAttribute("href", "/");
  });

  it("header_cart_trigger_opens_top_right_sidebar", async () => {
    useCartStore.setState({
      items: [makeItem("7001", "1", "100")],
      inlineErrors: {},
      isOpen: false,
      lastActionError: null,
    });
    const user = userEvent.setup();

    render(<CartSidebar />);

    await user.click(screen.getByRole("button", { name: /cart \(1\)/i }));

    expect(await screen.findByRole("heading", { name: /cart/i })).toBeVisible();
    expect(screen.getByText("Token #1")).toBeVisible();
  });

  it("cart_sidebar_renders_inline_item_errors", async () => {
    const user = userEvent.setup();
    useCartStore.setState({
      items: [makeItem("7001", "1", "100")],
      inlineErrors: { "7001": "Listing is stale." },
      isOpen: false,
      lastActionError: null,
    });

    render(<CartSidebar />);
    await user.click(screen.getByRole("button", { name: /cart \(1\)/i }));

    expect(await screen.findByText("Listing is stale.")).toBeVisible();
  });

  it("formats_wei_prices_for_items_and_totals", async () => {
    const user = userEvent.setup();
    useCartStore.setState({
      items: [
        makeItem("9001", "1", "1000000000000000000"),
        makeItem("9002", "2", "500000000000000000"),
      ],
      inlineErrors: {},
      isOpen: false,
      lastActionError: null,
    });

    render(<CartSidebar />);
    await user.click(screen.getByRole("button", { name: /cart \(2\)/i }));

    const item1 = await screen.findByTestId("cart-item-9001");
    const item2 = screen.getByTestId("cart-item-9002");
    expect(within(item1).getByText("1")).toBeVisible();
    expect(within(item1).getByText("0xfee")).toBeVisible();
    expect(within(item2).getByText("0.5")).toBeVisible();
    expect(within(item2).getByText("0xfee")).toBeVisible();
    expect(
      within(screen.getByTestId("cart-summary-marketplace-fee")).getByText("0.075"),
    ).toBeVisible();
    expect(within(screen.getByTestId("cart-summary-total")).getByText("1.5")).toBeVisible();
    expect(screen.queryByText("1000000000000000000 0xfee")).toBeNull();
  });

  it("summary_uses_sdk_fee_and_royalty_estimates_and_updates_on_remove", async () => {
    const user = userEvent.setup();
    // fee receiver comes from on-chain; fee rate is always pinned to CLIENT_FEE_BPS (500)
    mockGetFees.mockResolvedValue({
      feeNum: 250,
      feeDenominator: 10_000,
      feeReceiver: "0xfee-recipient",
    });
    mockGetRoyaltyFee.mockImplementation(
      async (options: { tokenId: string }) => ({
        receiver: "0xroyalty",
        amount: options.tokenId === "1" ? BigInt(5) : BigInt(3),
      }),
    );

    useCartStore.setState({
      items: [
        makeItem("7101", "1", "100"),
        makeItem("7102", "2", "50"),
      ],
      inlineErrors: {},
      isOpen: true,
      lastActionError: null,
    });

    render(<CartSidebar />);

    // Subtotal=150, fee=7 (display only), royalty=8, total=150+8=158 (fee not added on top)
    await waitFor(() => {
      expect(
        within(screen.getByTestId("cart-summary-marketplace-fee")).getByText("7"),
      ).toBeVisible();
      expect(
        within(screen.getByTestId("cart-summary-royalty")).getByText("8"),
      ).toBeVisible();
      expect(within(screen.getByTestId("cart-summary-total")).getByText("158")).toBeVisible();
    });

    const removeButtons = screen.getAllByRole("button", { name: /remove/i });
    await user.click(removeButtons[1]);

    // After removing item 2 (price=50): subtotal=100, fee=5 (display only), royalty=5, total=100+5=105
    await waitFor(() => {
      expect(
        within(screen.getByTestId("cart-summary-marketplace-fee")).getByText("5"),
      ).toBeVisible();
      expect(
        within(screen.getByTestId("cart-summary-royalty")).getByText("5"),
      ).toBeVisible();
      expect(within(screen.getByTestId("cart-summary-total")).getByText("105")).toBeVisible();
    });
  });

  it("checkout_submits_single_transaction_for_all_items_and_routes_client_fee", async () => {
    const user = userEvent.setup();
    mockUseAccount.mockReturnValue({
      account: { address: "0xwallet", execute: mockAccountExecute },
      isConnected: true,
      status: "connected",
      address: "0xwallet",
    });
    mockListCollectionListings.mockImplementation(
      async (options: { tokenId?: string }) => {
        if (options.tokenId === "1") {
          return [{ id: 7001, tokenId: 1, price: 100, currency: "0xfee", quantity: 1 }];
        }
        return [{ id: 7002, tokenId: 2, price: 50, currency: "0xfee", quantity: 1 }];
      },
    );
    useCartStore.setState({
      items: [
        makeItem("7001", "1", "100"),
        makeItem("7002", "2", "50"),
      ],
      inlineErrors: {},
      isOpen: true,
      lastActionError: null,
    });

    render(<CartSidebar />);
    await user.click(screen.getByRole("button", { name: /complete purchase/i }));

    await waitFor(() => {
      expect(mockArcadeExecute).toHaveBeenCalledTimes(1);
    });
    expect(mockAccountExecute).not.toHaveBeenCalled();
    const executeCalls = mockArcadeExecute.mock.calls[0]?.[1];
    expect(Array.isArray(executeCalls)).toBe(true);
    expect(executeCalls).toHaveLength(2);
    expect(executeCalls?.[0]).toMatchObject({
      contractName: "Marketplace",
      entrypoint: "execute",
    });
    expect(mockBuildExecuteCalldata).toHaveBeenCalledWith(
      "7001",
      "0xabc",
      "1",
      "0xfee",
      "1",
      true,
      500,
      "0x049fb4281d13e1f5f488540cd051e1507149e99cc2e22635101041ec5e4e4557",
    );
    expect(await screen.findByText(/cart is empty/i)).toBeVisible();
  });

  it("checkout_blocks_when_any_listing_is_stale_and_sets_inline_errors", async () => {
    const user = userEvent.setup();
    mockUseAccount.mockReturnValue({
      account: { address: "0xwallet", execute: mockAccountExecute },
      isConnected: true,
      status: "connected",
      address: "0xwallet",
    });
    mockListCollectionListings.mockResolvedValue([]);
    useCartStore.setState({
      items: [makeItem("7001", "1", "100")],
      inlineErrors: {},
      isOpen: true,
      lastActionError: null,
    });

    render(<CartSidebar />);
    await user.click(screen.getByRole("button", { name: /complete purchase/i }));

    await waitFor(() => {
      expect(mockAccountExecute).not.toHaveBeenCalled();
    });
    expect(mockListCollectionListings).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "0xabc",
        tokenId: "1",
        verifyOwnership: true,
      }),
    );
    expect(await screen.findByText(/listing is stale or unavailable/i)).toBeVisible();
    expect(screen.getByRole("button", { name: /remove stale/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /refresh listing/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /retry checkout/i })).toBeVisible();
    expect(
      screen.getByText(/remove stale rows or refresh them, then retry checkout/i),
    ).toBeVisible();
  });

  it("refresh_listing_clears_inline_error_when_listing_recovers", async () => {
    const user = userEvent.setup();
    mockUseAccount.mockReturnValue({
      account: { address: "0xwallet", execute: mockAccountExecute },
      isConnected: true,
      status: "connected",
      address: "0xwallet",
    });
    mockListCollectionListings
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 7001, tokenId: 1, price: 100, currency: "0xfee", quantity: 1 },
      ]);
    useCartStore.setState({
      items: [makeItem("7001", "1", "100")],
      inlineErrors: {},
      isOpen: true,
      lastActionError: null,
    });

    render(<CartSidebar />);
    await user.click(screen.getByRole("button", { name: /complete purchase/i }));
    expect(await screen.findByText(/listing is stale or unavailable/i)).toBeVisible();

    await user.click(screen.getByRole("button", { name: /refresh listing/i }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /refresh listing/i })).toBeNull();
    });
    expect(mockListCollectionListings).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "0xabc",
        tokenId: "1",
        verifyOwnership: true,
      }),
    );
  });

  it("retry_checkout_succeeds_after_removing_stale_rows", async () => {
    const user = userEvent.setup();
    mockUseAccount.mockReturnValue({
      account: { address: "0xwallet", execute: mockAccountExecute },
      isConnected: true,
      status: "connected",
      address: "0xwallet",
    });
    mockListCollectionListings.mockImplementation(
      async (options: { tokenId?: string }) => {
        if (options.tokenId === "1") {
          return [];
        }

        return [{ id: 7002, tokenId: 2, price: 50, currency: "0xfee", quantity: 1 }];
      },
    );
    useCartStore.setState({
      items: [
        makeItem("7001", "1", "100"),
        makeItem("7002", "2", "50"),
      ],
      inlineErrors: {},
      isOpen: true,
      lastActionError: null,
    });

    render(<CartSidebar />);
    await user.click(screen.getByRole("button", { name: /complete purchase/i }));
    expect(await screen.findByText(/checkout blocked due to stale listings/i)).toBeVisible();
    expect(mockArcadeExecute).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /remove stale/i }));
    await waitFor(() => {
      expect(screen.queryByText("Token #1")).toBeNull();
    });

    await user.click(screen.getByRole("button", { name: /retry checkout/i }));

    await waitFor(() => {
      expect(mockArcadeExecute).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText(/purchase complete/i)).toBeVisible();
  });
});
