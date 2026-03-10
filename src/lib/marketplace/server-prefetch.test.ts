import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockResolveCollectionProjectId,
  mockCollectionQueryOptions,
  mockCollectionTokensQueryOptions,
  mockTokenBalancesQueryOptions,
  mockGetPortfolioTokenIds,
  mockParsePortfolioItems,
  mockGroupPortfolioItemsByCollection,
} = vi.hoisted(() => ({
  mockResolveCollectionProjectId: vi.fn(),
  mockCollectionQueryOptions: vi.fn(),
  mockCollectionTokensQueryOptions: vi.fn(),
  mockTokenBalancesQueryOptions: vi.fn(),
  mockGetPortfolioTokenIds: vi.fn(),
  mockParsePortfolioItems: vi.fn(),
  mockGroupPortfolioItemsByCollection: vi.fn(),
}));

vi.mock("@/lib/marketplace/read-queries", () => ({
  resolveCollectionProjectId: mockResolveCollectionProjectId,
  collectionQueryOptions: mockCollectionQueryOptions,
  collectionTokensQueryOptions: mockCollectionTokensQueryOptions,
  tokenBalancesQueryOptions: mockTokenBalancesQueryOptions,
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
    mockResolveCollectionProjectId.mockReset();
    mockCollectionQueryOptions.mockReset();
    mockCollectionTokensQueryOptions.mockReset();
    mockTokenBalancesQueryOptions.mockReset();
    mockGetPortfolioTokenIds.mockReset();
    mockParsePortfolioItems.mockReset();
    mockGroupPortfolioItemsByCollection.mockReset();
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
  });
});
