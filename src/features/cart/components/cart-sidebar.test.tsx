import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CartSidebar } from "@/features/cart/components/cart-sidebar";
import { useCartStore } from "@/features/cart/store/cart-store";

const {
  mockUseAccount,
  mockUseMarketplaceClient,
  mockAccountExecute,
  mockArcadeExecute,
  mockListCollectionListings,
  mockBuildExecuteCalldata,
} = vi.hoisted(() => ({
  mockUseAccount: vi.fn(),
  mockUseMarketplaceClient: vi.fn(),
  mockAccountExecute: vi.fn(),
  mockArcadeExecute: vi.fn(),
  mockListCollectionListings: vi.fn(),
  mockBuildExecuteCalldata: vi.fn(),
}));

vi.mock("@starknet-react/core", () => ({
  useAccount: mockUseAccount,
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
    mockUseAccount.mockReset();
    mockUseMarketplaceClient.mockReset();

    mockUseAccount.mockReturnValue({
      account: undefined,
      isConnected: false,
      status: "disconnected",
      address: undefined,
    });
    mockUseMarketplaceClient.mockReturnValue({
      client: {
        listCollectionListings: mockListCollectionListings,
      },
      status: "ready",
      error: null,
      refresh: vi.fn(),
    });
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

    expect(await screen.findByText("1 0xfee")).toBeVisible();
    expect(screen.getByText("0.5 0xfee")).toBeVisible();
    expect(screen.getAllByText("1.5")).toHaveLength(2);
    expect(screen.queryByText("1000000000000000000 0xfee")).toBeNull();
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
      "0x045c587318c9ebcf2fbe21febf288ee2e3597a21cd48676005a5770a50d433c5",
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
    expect(await screen.findByText(/listing is stale or unavailable/i)).toBeVisible();
  });
});
