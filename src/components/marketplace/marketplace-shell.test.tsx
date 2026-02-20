import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoist mocks so they exist before any module evaluation.
// ---------------------------------------------------------------------------

const {
  mockUseMarketplaceClient,
  mockUseMarketplaceCollection,
  mockUseMarketplaceCollectionTokens,
  mockUseMarketplaceCollectionListings,
} = vi.hoisted(() => ({
  mockUseMarketplaceClient: vi.fn(),
  mockUseMarketplaceCollection: vi.fn(),
  mockUseMarketplaceCollectionTokens: vi.fn(),
  mockUseMarketplaceCollectionListings: vi.fn(),
}));

const { mockGetMarketplaceRuntimeConfig } = vi.hoisted(() => ({
  mockGetMarketplaceRuntimeConfig: vi.fn(),
}));

vi.mock("@cartridge/arcade/marketplace/react", () => ({
  useMarketplaceClient: mockUseMarketplaceClient,
  useMarketplaceCollection: mockUseMarketplaceCollection,
  useMarketplaceCollectionTokens: mockUseMarketplaceCollectionTokens,
  useMarketplaceCollectionListings: mockUseMarketplaceCollectionListings,
}));

vi.mock("@/lib/marketplace/config", () => ({
  getMarketplaceRuntimeConfig: mockGetMarketplaceRuntimeConfig,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRuntimeConfig(overrides: Record<string, unknown> = {}) {
  return {
    chainLabel: "SN_MAIN",
    collections: [{ address: "0xabc", name: "Dragons", projectId: "dragons" }],
    warnings: [],
    sdkConfig: { chainId: "SN_MAIN" },
    ...overrides,
  };
}

function makeQueryResult(overrides: Record<string, unknown> = {}) {
  return {
    data: undefined,
    status: "pending",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Default mock state before every test.
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetModules();
  mockGetMarketplaceRuntimeConfig.mockReturnValue(makeRuntimeConfig());
  mockUseMarketplaceClient.mockReturnValue({ status: "success" });
  mockUseMarketplaceCollection.mockReturnValue(
    makeQueryResult({ status: "success" }),
  );
  mockUseMarketplaceCollectionTokens.mockReturnValue(
    makeQueryResult({ status: "success", data: { page: { tokens: [] } } }),
  );
  mockUseMarketplaceCollectionListings.mockReturnValue(
    makeQueryResult({ status: "success", data: [] }),
  );
});

// ---------------------------------------------------------------------------
// Tests – each test does a fresh dynamic import so the module-level
// `runtimeConfig` const is re-evaluated after the mock is configured.
// ---------------------------------------------------------------------------

describe("MarketplaceShell", () => {
  it("renders_biblio_marketplace_text", async () => {
    const { MarketplaceShell } = await import(
      "@/components/marketplace/marketplace-shell"
    );
    render(<MarketplaceShell />);

    expect(screen.getByText("Biblio Marketplace")).toBeVisible();
  });

  it("renders_chain_label_badge", async () => {
    const { MarketplaceShell } = await import(
      "@/components/marketplace/marketplace-shell"
    );
    render(<MarketplaceShell />);

    expect(screen.getByText("Chain: SN_MAIN")).toBeVisible();
  });

  it("renders_client_status_badge", async () => {
    const { MarketplaceShell } = await import(
      "@/components/marketplace/marketplace-shell"
    );
    render(<MarketplaceShell />);

    expect(screen.getByText("Client: success")).toBeVisible();
  });

  it("renders_collections_count_badge", async () => {
    const { MarketplaceShell } = await import(
      "@/components/marketplace/marketplace-shell"
    );
    render(<MarketplaceShell />);

    // Default config has 1 collection.
    expect(screen.getByText("Collections: 1")).toBeVisible();
  });

  it("renders_no_collection_message", async () => {
    mockGetMarketplaceRuntimeConfig.mockReturnValue(
      makeRuntimeConfig({ collections: [] }),
    );

    const { MarketplaceShell } = await import(
      "@/components/marketplace/marketplace-shell"
    );
    render(<MarketplaceShell />);

    expect(
      screen.getByText(/No collection is configured yet\./),
    ).toBeVisible();
  });

  it("renders_warnings", async () => {
    mockGetMarketplaceRuntimeConfig.mockReturnValue(
      makeRuntimeConfig({
        warnings: [
          "Warning: invalid chain id supplied",
          "Warning: missing project id",
        ],
      }),
    );

    const { MarketplaceShell } = await import(
      "@/components/marketplace/marketplace-shell"
    );
    render(<MarketplaceShell />);

    expect(
      screen.getByText("Warning: invalid chain id supplied"),
    ).toBeVisible();
    expect(screen.getByText("Warning: missing project id")).toBeVisible();
  });

  it("shows_skeleton_when_loading", async () => {
    mockUseMarketplaceCollectionTokens.mockReturnValue(
      makeQueryResult({ status: "pending" }),
    );

    const { MarketplaceShell } = await import(
      "@/components/marketplace/marketplace-shell"
    );
    render(<MarketplaceShell />);

    // The component renders 6 skeleton cards each with Skeleton elements.
    const skeletons = document.querySelectorAll("[data-slot='skeleton']");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows_token_grid", async () => {
    mockUseMarketplaceCollectionTokens.mockReturnValue(
      makeQueryResult({
        status: "success",
        data: {
          page: {
            tokens: [
              {
                token_id: "1",
                image: null,
                metadata: { name: "Dragon #1" },
              },
              {
                token_id: "2",
                image: "https://cdn.example/2.png",
                metadata: { name: "Dragon #2" },
              },
            ],
          },
        },
      }),
    );

    const { MarketplaceShell } = await import(
      "@/components/marketplace/marketplace-shell"
    );
    render(<MarketplaceShell />);

    expect(screen.getByText("Dragon #1")).toBeVisible();
    expect(screen.getByText("Dragon #2")).toBeVisible();
  });

  it("shows_empty_filter_message", async () => {
    mockUseMarketplaceCollectionTokens.mockReturnValue(
      makeQueryResult({
        status: "success",
        data: {
          page: {
            tokens: [
              {
                token_id: "1",
                image: null,
                metadata: { name: "Dragon #1" },
              },
            ],
          },
        },
      }),
    );

    const { MarketplaceShell } = await import(
      "@/components/marketplace/marketplace-shell"
    );
    render(<MarketplaceShell />);

    const user = userEvent.setup();
    await user.type(
      screen.getByPlaceholderText(/filter loaded tokens/i),
      "xyz",
    );

    expect(
      screen.getByText("No tokens matched the current filters."),
    ).toBeVisible();
  });

  it("shows_address_stats_when_collection_selected", async () => {
    const { MarketplaceShell } = await import(
      "@/components/marketplace/marketplace-shell"
    );
    render(<MarketplaceShell />);

    // The stats section renders an "Address" card header label.
    expect(screen.getByText("Address")).toBeVisible();
  });

  it("shows_listings_count", async () => {
    mockUseMarketplaceCollectionListings.mockReturnValue(
      makeQueryResult({
        status: "success",
        data: [
          { id: 1, tokenId: "1", price: 100, currency: "0xfee" },
          { id: 2, tokenId: "2", price: 200, currency: "0xfee" },
          { id: 3, tokenId: "3", price: 300, currency: "0xfee" },
        ],
      }),
    );

    const { MarketplaceShell } = await import(
      "@/components/marketplace/marketplace-shell"
    );
    render(<MarketplaceShell />);

    // "Active Listings" stat card header label should be visible.
    expect(screen.getByText("Active Listings")).toBeVisible();
    // The listings count (3) is rendered in the card content.
    expect(screen.getByText("3")).toBeVisible();
  });
});
