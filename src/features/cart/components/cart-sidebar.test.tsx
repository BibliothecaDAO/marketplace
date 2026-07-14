import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CartSidebar } from "@/features/cart/components/cart-sidebar";
import { useCartStore } from "@/features/cart/store/cart-store";
import { marketplaceOrderIdentityKey } from "@/lib/marketplace/order-identity";

const {
  mockUseAccount,
  mockUseBalance,
  mockUseMarketplaceClient,
  mockAccountExecute,
  mockListCollectionListings,
  mockBuildExecuteCalldata,
  mockGetValidity,
  mockGetFees,
  mockGetRoyaltyFee,
  mockLookupOrders,
  mockBook,
  mockIndexerStatus,
  mockManifestWorldAddress,
  mockIsSellOrderExecutable,
  mockGetAllowance,
} = vi.hoisted(() => ({
  mockUseAccount: vi.fn(),
  mockUseBalance: vi.fn(),
  mockUseMarketplaceClient: vi.fn(),
  mockAccountExecute: vi.fn(),
  mockListCollectionListings: vi.fn(),
  mockBuildExecuteCalldata: vi.fn(),
  mockGetValidity: vi.fn(),
  mockGetFees: vi.fn(),
  mockGetRoyaltyFee: vi.fn(),
  mockLookupOrders: vi.fn(),
  mockBook: vi.fn(),
  mockIndexerStatus: vi.fn(),
  mockManifestWorldAddress: { current: null as string | null },
  mockIsSellOrderExecutable: vi.fn(),
  mockGetAllowance: vi.fn(),
}));

vi.mock("@starknet-react/core", () => ({
  useAccount: mockUseAccount,
  useBalance: mockUseBalance,
}));

vi.mock("@/lib/marketplace/read-client", () => ({
  useMarketplaceClient: mockUseMarketplaceClient,
}));

vi.mock("@cartridge/arcade", () => ({
  ArcadeProvider: vi.fn().mockImplementation(() => {
    const worldAddress = mockManifestWorldAddress.current;
    return {
      manifest: {
        abis: [{ type: "interface", name: "ARCADE::Marketplace", items: [] }],
        contracts: [{ tag: "ARCADE-Marketplace", address: "0xmarket" }],
        ...(worldAddress ? { world: { address: worldAddress } } : {}),
      },
      marketplace: {
        buildExecuteCalldata: mockBuildExecuteCalldata,
        getValidity: mockGetValidity,
      },
    };
  }),
  NAMESPACE: "ARCADE",
}));

vi.mock("@/lib/marketplace/write-adapter", () => ({
  createMarketplaceWriteAdapter: () => ({
    isOrderValid: async (key: { id: string; collection: string; tokenId: string }) => {
      const result = await mockGetValidity(key.id, key.collection, key.tokenId);
      return Array.isArray(result) && (result[0] === "0x1" || result[0] === "1");
    },
    isSellOrderExecutable: mockIsSellOrderExecutable,
    getAllowance: mockGetAllowance,
    buildExecuteCall: (input: {
      orderId: string; collection: string; tokenId: string; assetId: string;
      quantity: string; royalties: boolean; clientFee: string; clientReceiver: string;
    }) => {
      mockBuildExecuteCalldata(
        input.orderId, input.collection, input.tokenId, input.assetId,
        input.quantity, input.royalties, input.clientFee, input.clientReceiver,
      );
      return {
        contractAddress: "0x456",
        entrypoint: "execute",
        calldata: [
          input.orderId, input.collection, input.tokenId, "0", input.assetId, "0",
          input.quantity, input.royalties ? "1" : "0", input.clientFee,
          input.clientReceiver,
        ],
      };
    },
    buildErc20ApprovalCall: (currency: string, amount: bigint) => ({
      contractAddress: currency,
      entrypoint: "approve",
      calldata: ["0x456", amount.toString(), "0"],
    }),
  }),
}));

vi.mock("@/lib/marketplace/config", () => ({
  getMarketplaceRuntimeConfig: () => ({
    chainLabel: "SN_SEPOLIA",
    chainId: "0x534e5f5345504f4c4941",
    apiBaseUrl: "http://marketplace.test",
    readRollout: "checkout",
    worldAddress: "0x123",
    marketplaceAddress: "0x456",
    schemaVersion: "1.0.0",
    currencies: [],
    warnings: [],
    collections: [],
    isReadSurfaceEnabled: () => true,
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
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    useCartStore.setState({ items: [], inlineErrors: {}, isOpen: false, lastActionError: null });

    mockAccountExecute.mockReset();
    mockListCollectionListings.mockReset();
    mockBuildExecuteCalldata.mockReset();
    mockGetValidity.mockReset();
    mockGetFees.mockReset();
    mockGetRoyaltyFee.mockReset();
    mockLookupOrders.mockReset();
    mockBook.mockReset();
    mockIndexerStatus.mockReset();
    mockUseAccount.mockReset();
    mockUseBalance.mockReset();
    mockUseMarketplaceClient.mockReset();
    mockIsSellOrderExecutable.mockReset();
    mockGetAllowance.mockReset();

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
        lookupOrders: mockLookupOrders,
        book: mockBook,
        indexerStatus: mockIndexerStatus,
      },
      status: "ready",
      error: null,
      refresh: vi.fn(),
    });
    mockGetFees.mockResolvedValue(null);
    mockGetRoyaltyFee.mockResolvedValue(null);
    mockBook.mockResolvedValue({
      data: {
        paused: false,
        feeNumerator: "500",
        feeDenominator: "10000",
        feeReceiver: "0x789",
        updatedAtBlock: 100,
      },
      meta: {
        schemaVersion: "1.0.0",
        chain: "SN_SEPOLIA",
        chainId: "0x534e5f5345504f4c4941",
        worldAddress: "0x123",
        marketplaceAddress: "0x456",
        indexedBlock: 100,
        indexedBlockHash: "0x999",
        chainHead: 101,
        lagBlocks: 1,
        finality: "accepted_l2",
        observedAt: "2026-07-14T00:00:00.000Z",
      },
    });
    mockIndexerStatus.mockResolvedValue({
      data: {
        indexedBlock: 100,
        indexedBlockHash: "0x999",
        chainHead: 101,
        lagBlocks: 1,
        finality: "accepted_l2",
        syncing: false,
        safeForCheckout: true,
        metadataFailures: 0,
        toriiVersion: "1.8.16-owned.1",
        apiVersion: "0.1.0",
      },
      meta: {
        schemaVersion: "1.0.0",
        chain: "SN_SEPOLIA",
        chainId: "0x534e5f5345504f4c4941",
        worldAddress: "0x123",
        marketplaceAddress: "0x456",
        indexedBlock: 100,
        indexedBlockHash: "0x999",
        chainHead: 101,
        lagBlocks: 1,
        finality: "accepted_l2",
        observedAt: "2026-07-14T00:00:00.000Z",
      },
    });
    mockListCollectionListings.mockImplementation(async (options: { tokenId?: string }) => {
      const item = useCartStore.getState().items.find((entry) => entry.tokenId === options.tokenId);
      return item
        ? [{
            id: Number(item.orderId),
            tokenId: Number(item.tokenId),
            price: item.price,
            currency: item.currency,
            quantity: item.quantity,
            owner: "0xseller",
            expiration: "4102444800",
            status: { value: "Placed" },
          }]
        : [];
    });
    mockLookupOrders.mockImplementation(async (keys: Array<{ id: string; collection: string; tokenId: string }>) => {
      const orders = await Promise.all(keys.map(async (key) => {
        const listings = await mockListCollectionListings({
          collection: key.collection,
          tokenId: key.tokenId,
          limit: 100,
          verifyOwnership: true,
        });
        const listing = listings?.find((candidate: { id?: number | string }) => String(candidate.id) === key.id);
        return {
          key,
          order: listing ? {
            id: String(listing.id),
            collection: key.collection,
            tokenId: BigInt(key.tokenId).toString(),
            category: "sell",
            categoryRaw: "1",
            status: String(listing.status?.value ?? "Placed").toLowerCase(),
            statusRaw: "1",
            owner: listing.owner ?? "0xseller",
            currency: listing.currency,
            unitPriceAtomic: String(listing.price),
            originalQuantity: String(listing.quantity),
            remainingQuantity: String(listing.quantity),
            expiration: String(listing.expiration ?? "4102444800"),
            royaltyTerms: { enabled: true, receiver: null, amountAtomic: null, source: "order" },
            created: { block: 90, transactionHash: "0x111", transactionIndex: 0, eventIndex: 0, caller: "0xseller" },
            updated: { block: 90, transactionHash: "0x111", transactionIndex: 0, eventIndex: 0, caller: "0xseller" },
          } : null,
        };
      }));
      return {
        data: { orders },
        meta: {
          schemaVersion: "1.0.0",
          chain: "SN_SEPOLIA",
          chainId: "0x534e5f5345504f4c4941",
          worldAddress: "0x123",
          marketplaceAddress: "0x456",
          indexedBlock: 100,
          indexedBlockHash: "0x999",
          chainHead: 101,
          lagBlocks: 1,
          finality: "accepted_l2",
          observedAt: "2026-07-14T00:00:00.000Z",
        },
      };
    });
    mockManifestWorldAddress.current = null;
    mockBuildExecuteCalldata.mockImplementation((orderId: string) => ({
      contractName: "Marketplace",
      entrypoint: "execute",
      calldata: [orderId],
    }));
    mockGetValidity.mockResolvedValue(["0x1", "0x0"]);
    mockIsSellOrderExecutable.mockImplementation(
      async (input: { key: { id: string; collection: string; tokenId: string } }) => {
        const result = await mockGetValidity(
          input.key.id,
          input.key.collection,
          input.key.tokenId,
        );
        return Array.isArray(result) && (result[0] === "0x1" || result[0] === "1");
      },
    );
    mockGetAllowance.mockResolvedValue(BigInt(0));
    mockAccountExecute.mockResolvedValue({ transaction_hash: "0xcheckout" });
    vi.unstubAllEnvs();
    consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleInfoSpy.mockRestore();
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

  it("cart_trigger_button_has_hover_highlight_classes", () => {
    render(<CartSidebar />);

    expect(screen.getByRole("button", { name: /cart \(0\)/i })).toHaveClass(
      "hover:bg-accent",
      "hover:text-accent-foreground",
    );
  });

  it("cart_trigger_uses_outline_hover_styling", () => {
    useCartStore.setState({
      items: [makeItem("7001", "1", "100")],
      inlineErrors: {},
      isOpen: false,
      lastActionError: null,
    });

    render(<CartSidebar />);

    const trigger = screen.getByRole("button", { name: /cart \(1\)/i });
    expect(trigger).toHaveAttribute("data-variant", "outline");
    expect(trigger).toHaveClass("hover:bg-accent", "hover:text-accent-foreground");
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
    const item = makeItem("7001", "1", "100");
    useCartStore.setState({
      items: [item],
      inlineErrors: { [marketplaceOrderIdentityKey(item)]: "Listing is stale." },
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
    expect(within(screen.getByTestId("cart-summary-total")).getByText("1.575")).toBeVisible();
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

    // Subtotal=150, fee=7, royalty=8, total=150+7+8=165 (fee added on top for buyer)
    await waitFor(() => {
      expect(
        within(screen.getByTestId("cart-summary-marketplace-fee")).getByText("7"),
      ).toBeVisible();
      expect(
        within(screen.getByTestId("cart-summary-royalty")).getByText("8"),
      ).toBeVisible();
      expect(within(screen.getByTestId("cart-summary-total")).getByText("165")).toBeVisible();
    });

    const removeButtons = screen.getAllByRole("button", { name: /remove/i });
    await user.click(removeButtons[1]);

    // After removing item 2 (price=50): subtotal=100, fee=5, royalty=5, total=100+5+5=110
    await waitFor(() => {
      expect(
        within(screen.getByTestId("cart-summary-marketplace-fee")).getByText("5"),
      ).toBeVisible();
      expect(
        within(screen.getByTestId("cart-summary-royalty")).getByText("5"),
      ).toBeVisible();
      expect(within(screen.getByTestId("cart-summary-total")).getByText("110")).toBeVisible();
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
      expect(mockAccountExecute).toHaveBeenCalledTimes(1);
    });
    const executeCalls = mockAccountExecute.mock.calls[0]?.[0];
    expect(Array.isArray(executeCalls)).toBe(true);
    expect(executeCalls).toHaveLength(3);
    expect(executeCalls?.[0]).toMatchObject({
      contractAddress: "0xfee",
      entrypoint: "approve",
      calldata: ["0x456", "157", "0"],
    });
    expect(executeCalls?.[1]).toMatchObject({
      contractAddress: "0x456",
      entrypoint: "execute",
      calldata: ["7001", "0xabc", "1", "0", "1", "0", "1", "1", "500", "0x049fb4281d13e1f5f488540cd051e1507149e99cc2e22635101041ec5e4e4557"],
    });
    expect(mockIsSellOrderExecutable).toHaveBeenCalledWith({
      key: { id: "7001", collection: "0xabc", tokenId: "1" },
      owner: "0xseller",
    });
    expect(await screen.findByText(/transaction submitted; waiting for onchain confirmation/i)).toBeVisible();
    expect(screen.getByText("Token #1")).toBeVisible();
  });

  it("checkout_skips_erc20_approval_when_direct_allowance_already_covers_total", async () => {
    const user = userEvent.setup();
    mockUseAccount.mockReturnValue({
      account: { address: "0xwallet", execute: mockAccountExecute },
      isConnected: true,
      status: "connected",
      address: "0xwallet",
    });
    mockGetAllowance.mockResolvedValue(BigInt(10_000));
    useCartStore.setState({
      items: [makeItem("7001", "1", "100")],
      inlineErrors: {},
      isOpen: true,
      lastActionError: null,
    });

    render(<CartSidebar />);
    await user.click(screen.getByRole("button", { name: /complete purchase/i }));

    await waitFor(() => expect(mockAccountExecute).toHaveBeenCalledOnce());
    const calls = mockAccountExecute.mock.calls[0]?.[0] as Array<{ entrypoint: string }>;
    expect(calls.map((call) => call.entrypoint)).toEqual(["execute"]);
  });

  it("checkout_approves_total_wallet_outflow_including_royalty_estimate", async () => {
    const user = userEvent.setup();
    mockUseAccount.mockReturnValue({
      account: { address: "0xwallet", execute: mockAccountExecute },
      isConnected: true,
      status: "connected",
      address: "0xwallet",
    });
    mockGetRoyaltyFee.mockResolvedValue({
      receiver: "0xroyalty",
      amount: BigInt(5),
    });
    mockListCollectionListings.mockResolvedValue([
      {
        id: 7001,
        tokenId: 1,
        price: 100,
        currency: "0xfee",
        quantity: 1,
      },
    ]);
    useCartStore.setState({
      items: [makeItem("7001", "1", "100")],
      inlineErrors: {},
      isOpen: true,
      lastActionError: null,
    });

    render(<CartSidebar />);
    await user.click(screen.getByRole("button", { name: /complete purchase/i }));

    await waitFor(() => {
      expect(mockAccountExecute).toHaveBeenCalledTimes(1);
    });
    const txCalls = mockAccountExecute.mock.calls[0]?.[0];
    expect(txCalls).toHaveLength(2);
    expect(txCalls?.[0]).toMatchObject({
      contractAddress: "0xfee",
      entrypoint: "approve",
      // price=100 + fee=5 + royalty=5 => approve 110
      calldata: ["0x456", "110", "0"],
    });
    expect(txCalls?.[1]).toMatchObject({
      contractAddress: "0x456",
      entrypoint: "execute",
    });
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
    expect(mockLookupOrders).toHaveBeenCalledWith([
      { id: "7001", collection: "0xabc", tokenId: "1" },
    ]);
    expect(await screen.findByText(/listing is stale or unavailable/i)).toBeVisible();
    expect(screen.getByRole("button", { name: /remove item/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /refresh/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /retry checkout/i })).toBeVisible();
    expect(
      screen.getByText(/remove stale rows or refresh them, then retry checkout/i),
    ).toBeVisible();
  });

  it("checkout_blocks_when_listing_status_is_executed", async () => {
    const user = userEvent.setup();
    mockUseAccount.mockReturnValue({
      account: { address: "0xwallet", execute: mockAccountExecute },
      isConnected: true,
      status: "connected",
      address: "0xwallet",
    });
    mockListCollectionListings.mockResolvedValue([
      {
        id: 7001,
        tokenId: 1,
        price: 100,
        currency: "0xfee",
        quantity: 1,
        status: { value: "Executed" },
      },
    ]);
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
    expect(await screen.findByText(/listing is not placed/i)).toBeVisible();
  });

  it("checkout_blocks_when_listing_owner_matches_connected_wallet", async () => {
    const user = userEvent.setup();
    mockUseAccount.mockReturnValue({
      account: { address: "0xwallet", execute: mockAccountExecute },
      isConnected: true,
      status: "connected",
      address: "0xwallet",
    });
    mockListCollectionListings.mockResolvedValue([
      {
        id: 7001,
        tokenId: 1,
        price: 100,
        currency: "0xfee",
        quantity: 1,
        status: { value: "Placed" },
        owner: "0xwallet",
      },
    ]);
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
    expect(mockGetValidity).not.toHaveBeenCalled();
    expect(await screen.findByText(/cannot buy your own listing/i)).toBeVisible();
  });

  it("checkout_blocks_when_on_chain_validity_is_false", async () => {
    const user = userEvent.setup();
    mockUseAccount.mockReturnValue({
      account: { address: "0xwallet", execute: mockAccountExecute },
      isConnected: true,
      status: "connected",
      address: "0xwallet",
    });
    mockListCollectionListings.mockResolvedValue([
      {
        id: 7001,
        tokenId: 1,
        price: 100,
        currency: "0xfee",
        quantity: 1,
        status: { value: "Placed" },
      },
    ]);
    mockGetValidity.mockResolvedValue(["0x0", "0x53616c653a206e6f7420616c6c6f776564"]);
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
    expect(mockGetValidity).toHaveBeenCalledWith("7001", "0xabc", "1");
    expect(await screen.findByText(/listing is stale or unavailable/i)).toBeVisible();
  });

  it("checkout_ignores_legacy_strict_precheck_override_and_fails_closed", async () => {
    const user = userEvent.setup();
    vi.stubEnv("NEXT_PUBLIC_MARKETPLACE_STRICT_ONCHAIN_VALIDATION", "false");
    mockUseAccount.mockReturnValue({
      account: { address: "0xwallet", execute: mockAccountExecute },
      isConnected: true,
      status: "connected",
      address: "0xwallet",
    });
    mockListCollectionListings.mockResolvedValue([
      {
        id: 7001,
        tokenId: 1,
        price: 100,
        currency: "0xfee",
        quantity: 1,
        status: { value: "Placed" },
      },
    ]);
    mockGetValidity.mockResolvedValue(["0x0", "0x53616c653a206e6f7420616c6c6f776564"]);
    useCartStore.setState({
      items: [makeItem("7001", "1", "100")],
      inlineErrors: {},
      isOpen: true,
      lastActionError: null,
    });

    render(<CartSidebar />);
    await user.click(screen.getByRole("button", { name: /complete purchase/i }));

    await waitFor(() => {
      expect(mockGetValidity).toHaveBeenCalledWith("7001", "0xabc", "1");
    });
    expect(mockAccountExecute).not.toHaveBeenCalled();
    expect(await screen.findByText(/listing is stale or unavailable/i)).toBeVisible();
  });

  it("checkout_logs_validation_diagnostics_when_debug_flag_is_enabled", async () => {
    const user = userEvent.setup();
    vi.stubEnv("NEXT_PUBLIC_MARKETPLACE_CHECKOUT_DEBUG", "true");
    mockUseAccount.mockReturnValue({
      account: { address: "0xwallet", execute: mockAccountExecute },
      isConnected: true,
      status: "connected",
      address: "0xwallet",
    });
    mockListCollectionListings.mockResolvedValue([
      {
        id: 7001,
        tokenId: 1,
        price: 100,
        currency: "0xfee",
        quantity: 1,
        status: { value: "Placed" },
      },
    ]);
    useCartStore.setState({
      items: [makeItem("7001", "1", "100")],
      inlineErrors: {},
      isOpen: true,
      lastActionError: null,
    });

    render(<CartSidebar />);
    await user.click(screen.getByRole("button", { name: /complete purchase/i }));

    await waitFor(() => {
      expect(mockAccountExecute).toHaveBeenCalledTimes(1);
    });
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining("[cart-checkout] validate.onchain.response"),
      expect.objectContaining({
        orderId: "7001",
      }),
    );
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining("[cart-checkout] checkout.execute.success"),
      expect.objectContaining({
        txHash: "0xcheckout",
      }),
    );
  });

  it("checkout_ignores_legacy_bypass_override_and_fails_closed", async () => {
    const user = userEvent.setup();
    vi.stubEnv("NEXT_PUBLIC_MARKETPLACE_BYPASS_CHECKOUT_VALIDATION", "true");
    mockUseAccount.mockReturnValue({
      account: { address: "0xwallet", execute: mockAccountExecute },
      isConnected: true,
      status: "connected",
      address: "0xwallet",
    });
    mockListCollectionListings.mockResolvedValue([]);
    mockGetValidity.mockResolvedValue(["0x0", "0x0"]);
    useCartStore.setState({
      items: [makeItem("7001", "1", "100")],
      inlineErrors: {},
      isOpen: true,
      lastActionError: null,
    });

    render(<CartSidebar />);
    await user.click(screen.getByRole("button", { name: /complete purchase/i }));

    await waitFor(() => {
      expect(mockLookupOrders).toHaveBeenCalledTimes(1);
    });
    expect(mockAccountExecute).not.toHaveBeenCalled();
    expect(mockGetValidity).not.toHaveBeenCalled();
    expect(await screen.findByText(/listing is stale or unavailable/i)).toBeVisible();
  });

  it("checkout_keeps_purchase_execute_call_after_single_approval", async () => {
    const user = userEvent.setup();
    mockUseAccount.mockReturnValue({
      account: { address: "0xwallet", execute: mockAccountExecute },
      isConnected: true,
      status: "connected",
      address: "0xwallet",
    });
    mockListCollectionListings.mockResolvedValue([
      {
        id: 7001,
        tokenId: 1,
        price: 100,
        currency: "0xfee",
        quantity: 1,
        status: { value: "Placed" },
      },
    ]);
    useCartStore.setState({
      items: [makeItem("7001", "1", "100")],
      inlineErrors: {},
      isOpen: true,
      lastActionError: null,
    });

    render(<CartSidebar />);
    await user.click(screen.getByRole("button", { name: /complete purchase/i }));

    await waitFor(() => {
      expect(mockAccountExecute).toHaveBeenCalledTimes(1);
    });
    const txCalls = mockAccountExecute.mock.calls[0]?.[0];
    expect(txCalls).toHaveLength(2);
    expect(txCalls?.[0]).toMatchObject({
      contractAddress: "0xfee",
      entrypoint: "approve",
      calldata: ["0x456", "105", "0"],
    });
    expect(txCalls?.[1]).toMatchObject({
      contractAddress: "0x456",
      entrypoint: "execute",
    });
  });

  it("checkout_prefers_marketplace_contract_over_world_address_for_approval", async () => {
    const user = userEvent.setup();
    mockManifestWorldAddress.current = "0xworld";
    mockUseAccount.mockReturnValue({
      account: { address: "0xwallet", execute: mockAccountExecute },
      isConnected: true,
      status: "connected",
      address: "0xwallet",
    });
    mockListCollectionListings.mockResolvedValue([
      {
        id: 7001,
        tokenId: 1,
        price: 100,
        currency: "0xfee",
        quantity: 1,
        status: { value: "Placed" },
      },
    ]);
    useCartStore.setState({
      items: [makeItem("7001", "1", "100")],
      inlineErrors: {},
      isOpen: true,
      lastActionError: null,
    });

    render(<CartSidebar />);
    await user.click(screen.getByRole("button", { name: /complete purchase/i }));

    await waitFor(() => {
      expect(mockAccountExecute).toHaveBeenCalledTimes(1);
    });
    const txCalls = mockAccountExecute.mock.calls[0]?.[0];
    expect(txCalls?.[0]).toMatchObject({
      contractAddress: "0xfee",
      entrypoint: "approve",
      calldata: ["0x456", "105", "0"],
    });
  });

  it("checkout_always_approves_marketplace_contract_from_registry", async () => {
    const user = userEvent.setup();
    mockUseAccount.mockReturnValue({
      account: { address: "0xwallet", execute: mockAccountExecute },
      isConnected: true,
      status: "connected",
      address: "0xwallet",
    });
    mockListCollectionListings.mockResolvedValue([
      {
        id: 7001,
        tokenId: 1,
        price: 100,
        currency: "0xfee",
        quantity: 1,
        status: { value: "Placed" },
      },
    ]);
    useCartStore.setState({
      items: [makeItem("7001", "1", "100")],
      inlineErrors: {},
      isOpen: true,
      lastActionError: null,
    });

    render(<CartSidebar />);
    await user.click(screen.getByRole("button", { name: /complete purchase/i }));

    await waitFor(() => {
      expect(mockAccountExecute).toHaveBeenCalledTimes(1);
    });
    const txCalls = mockAccountExecute.mock.calls[0]?.[0];
    expect(txCalls?.[0]).toMatchObject({
      contractAddress: "0xfee",
      entrypoint: "approve",
      calldata: ["0x456", "105", "0"],
    });
    expect(txCalls?.[1]).toMatchObject({
      contractAddress: "0x456",
      entrypoint: "execute",
    });
  });

  it("checkout_preserves_zero_quantity_for_execute", async () => {
    const user = userEvent.setup();
    mockUseAccount.mockReturnValue({
      account: { address: "0xwallet", execute: mockAccountExecute },
      isConnected: true,
      status: "connected",
      address: "0xwallet",
    });
    mockListCollectionListings.mockResolvedValue([
      {
        id: 7001,
        tokenId: 1,
        price: 100,
        currency: "0xfee",
        quantity: 0,
        status: { value: "Placed" },
      },
    ]);
    useCartStore.setState({
      items: [{
        ...makeItem("7001", "1", "100"),
        quantity: "0",
      }],
      inlineErrors: {},
      isOpen: true,
      lastActionError: null,
    });

    render(<CartSidebar />);
    await user.click(screen.getByRole("button", { name: /complete purchase/i }));

    await waitFor(() => {
      expect(mockAccountExecute).toHaveBeenCalledTimes(1);
    });
    const txCalls = mockAccountExecute.mock.calls[0]?.[0];
    expect(txCalls?.[1]).toMatchObject({
      contractAddress: "0x456",
      entrypoint: "execute",
      // u256-encoded tokenId/assetId + quantity=0
      calldata: ["7001", "0xabc", "1", "0", "1", "0", "0", "1", "500", "0x049fb4281d13e1f5f488540cd051e1507149e99cc2e22635101041ec5e4e4557"],
    });
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

    await user.click(screen.getByRole("button", { name: /refresh/i }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /refresh/i })).toBeNull();
    });
    expect(mockLookupOrders).toHaveBeenCalledWith([
      { id: "7001", collection: "0xabc", tokenId: "1" },
    ]);
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
    expect(mockAccountExecute).not.toHaveBeenCalled();

    // The stale item (7001 / Token #1) has a visible remove button; click it.
    const staleRow = screen.getByTestId("cart-item-7001");
    await user.click(staleRow.querySelector("button[aria-label='Remove item']")!);
    await waitFor(() => {
      expect(screen.queryByText("Token #1")).toBeNull();
    });

    await user.click(screen.getByRole("button", { name: /retry checkout/i }));

    await waitFor(() => {
      expect(mockAccountExecute).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText(/transaction submitted; waiting for onchain confirmation/i)).toBeVisible();
  });
});
