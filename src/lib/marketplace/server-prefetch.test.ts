import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockSelectFeaturedHomeCollection,
  mockResolveCollectionProjectId,
  mockCollectionQueryOptions,
  mockCollectionTokensQueryOptions,
  mockCollectionListingsQueryOptions,
  mockCollectionOrdersQueryOptions,
  mockTokenDetailQueryOptions,
  mockTokenBalancesQueryOptions,
  mockTraitNamesSummaryQueryOptions,
  mockGetInitialCollectionTokensOptions,
  mockGetInitialHomeTokensOptions,
  mockGetInitialListedTokensOptions,
  mockGetPortfolioTokenIds,
  mockParsePortfolioItems,
  mockGroupPortfolioItemsByCollection,
} = vi.hoisted(() => ({
  mockSelectFeaturedHomeCollection: vi.fn(),
  mockResolveCollectionProjectId: vi.fn(),
  mockCollectionQueryOptions: vi.fn(),
  mockCollectionTokensQueryOptions: vi.fn(),
  mockCollectionListingsQueryOptions: vi.fn(),
  mockCollectionOrdersQueryOptions: vi.fn(),
  mockTokenDetailQueryOptions: vi.fn(),
  mockTokenBalancesQueryOptions: vi.fn(),
  mockTraitNamesSummaryQueryOptions: vi.fn(),
  mockGetInitialCollectionTokensOptions: vi.fn(),
  mockGetInitialHomeTokensOptions: vi.fn(),
  mockGetInitialListedTokensOptions: vi.fn(),
  mockGetPortfolioTokenIds: vi.fn(),
  mockParsePortfolioItems: vi.fn(),
  mockGroupPortfolioItemsByCollection: vi.fn(),
}));

vi.mock("@/lib/marketplace/read-queries", () => ({
  selectFeaturedHomeCollection: mockSelectFeaturedHomeCollection,
  resolveCollectionProjectId: mockResolveCollectionProjectId,
  collectionQueryOptions: mockCollectionQueryOptions,
  collectionTokensQueryOptions: mockCollectionTokensQueryOptions,
  collectionListingsQueryOptions: mockCollectionListingsQueryOptions,
  collectionOrdersQueryOptions: mockCollectionOrdersQueryOptions,
  tokenDetailQueryOptions: mockTokenDetailQueryOptions,
  tokenBalancesQueryOptions: mockTokenBalancesQueryOptions,
  traitNamesSummaryQueryOptions: mockTraitNamesSummaryQueryOptions,
  getInitialCollectionTokensOptions: mockGetInitialCollectionTokensOptions,
  getInitialHomeTokensOptions: mockGetInitialHomeTokensOptions,
  getInitialListedTokensOptions: mockGetInitialListedTokensOptions,
  getPortfolioTokenIds: mockGetPortfolioTokenIds,
}));

vi.mock("@/lib/marketplace/portfolio", () => ({
  parsePortfolioItems: mockParsePortfolioItems,
  groupPortfolioItemsByCollection: mockGroupPortfolioItemsByCollection,
}));

function resolvedQueryOptions<TData>(queryKey: readonly unknown[], data: TData) {
  return {
    queryKey,
    queryFn: vi.fn().mockResolvedValue(data),
  };
}

describe("server-prefetch", () => {
  beforeEach(() => {
    vi.resetModules();
    mockSelectFeaturedHomeCollection.mockReset();
    mockResolveCollectionProjectId.mockReset();
    mockCollectionQueryOptions.mockReset();
    mockCollectionTokensQueryOptions.mockReset();
    mockCollectionListingsQueryOptions.mockReset();
    mockCollectionOrdersQueryOptions.mockReset();
    mockTokenDetailQueryOptions.mockReset();
    mockTokenBalancesQueryOptions.mockReset();
    mockTraitNamesSummaryQueryOptions.mockReset();
    mockGetInitialCollectionTokensOptions.mockReset();
    mockGetInitialHomeTokensOptions.mockReset();
    mockGetInitialListedTokensOptions.mockReset();
    mockGetPortfolioTokenIds.mockReset();
    mockParsePortfolioItems.mockReset();
    mockGroupPortfolioItemsByCollection.mockReset();
  });

  it("buildHomePageHydrationState_prefetches_featured_home_queries", async () => {
    mockSelectFeaturedHomeCollection.mockReturnValue({
      address: "0xabc",
      projectId: "project-a",
    });
    mockGetInitialHomeTokensOptions.mockReturnValue({
      address: "0xabc",
      project: "project-a",
      limit: 12,
      fetchImages: true,
    });
    mockCollectionQueryOptions.mockReturnValue(
      resolvedQueryOptions(["collection", "0xabc"], { address: "0xabc" }),
    );
    mockCollectionTokensQueryOptions.mockReturnValue(
      resolvedQueryOptions(
        ["collection-tokens", "0xabc"],
        { page: { tokens: [], nextCursor: null }, error: null },
      ),
    );
    mockCollectionListingsQueryOptions.mockReturnValue(
      resolvedQueryOptions(["collection-listings", "0xabc"], []),
    );

    const { buildHomePageHydrationState } = await import("@/lib/marketplace/server-prefetch");
    const result = await buildHomePageHydrationState();

    expect(result.featuredCollection).toEqual({
      address: "0xabc",
      projectId: "project-a",
    });
    expect(result.state.queries).toHaveLength(3);
  });

  it("buildTokenPageHydrationState_prefetches_token_and_listings", async () => {
    mockResolveCollectionProjectId.mockReturnValue("project-a");
    mockTokenDetailQueryOptions.mockReturnValue(
      resolvedQueryOptions(
        ["token-detail", "0xabc", "42"],
        { token: { token_id: "42" }, listings: [] },
      ),
    );
    mockCollectionListingsQueryOptions.mockReturnValue(
      resolvedQueryOptions(["collection-listings", "0xabc", "42"], []),
    );

    const { buildTokenPageHydrationState } = await import("@/lib/marketplace/server-prefetch");
    const result = await buildTokenPageHydrationState({ address: "0xabc", tokenId: "42" });

    expect(result.state.queries).toHaveLength(2);
    expect(mockTokenDetailQueryOptions).toHaveBeenCalledWith({
      collection: "0xabc",
      tokenId: "42",
      projectId: "project-a",
      fetchImages: true,
    });
  });

  it("buildWalletProfileHydrationState_prefetches_portfolio_and_collection_tokens", async () => {
    mockTokenBalancesQueryOptions.mockReturnValue(
      resolvedQueryOptions(
        ["token-balances", "0xwallet"],
        { page: { balances: [{ contract_address: "0xabc", token_id: "1", balance: "1" }] } },
      ),
    );
    mockParsePortfolioItems.mockReturnValue([
      { collectionAddress: "0xabc", tokenId: "1", balance: "1" },
    ]);
    mockGroupPortfolioItemsByCollection.mockReturnValue([
      { collectionAddress: "0xabc", tokenIds: ["1"] },
    ]);
    mockGetPortfolioTokenIds.mockReturnValue(["1", "0x1"]);
    mockResolveCollectionProjectId.mockReturnValue("project-a");
    mockCollectionQueryOptions.mockReturnValue(
      resolvedQueryOptions(["collection", "0xabc"], { address: "0xabc" }),
    );
    mockCollectionTokensQueryOptions.mockReturnValue(
      resolvedQueryOptions(
        ["collection-tokens", "0xabc", ["1", "0x1"]],
        { page: { tokens: [{ token_id: "1" }], nextCursor: null }, error: null },
      ),
    );

    const { buildWalletProfileHydrationState } = await import("@/lib/marketplace/server-prefetch");
    const result = await buildWalletProfileHydrationState("0xwallet");

    expect(result.state.queries).toHaveLength(3);
    expect(mockCollectionTokensQueryOptions).toHaveBeenCalled();
  });
});
