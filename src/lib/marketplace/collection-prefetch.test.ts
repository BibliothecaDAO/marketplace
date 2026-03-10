import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockResolveCollectionProjectId,
  mockCollectionQueryOptions,
  mockCollectionTokensQueryOptions,
  mockCollectionListingsQueryOptions,
  mockCollectionOrdersQueryOptions,
  mockTraitNamesSummaryQueryOptions,
  mockGetInitialCollectionTokensOptions,
  mockGetInitialListedTokensOptions,
} = vi.hoisted(() => ({
  mockResolveCollectionProjectId: vi.fn(),
  mockCollectionQueryOptions: vi.fn(),
  mockCollectionTokensQueryOptions: vi.fn(),
  mockCollectionListingsQueryOptions: vi.fn(),
  mockCollectionOrdersQueryOptions: vi.fn(),
  mockTraitNamesSummaryQueryOptions: vi.fn(),
  mockGetInitialCollectionTokensOptions: vi.fn(),
  mockGetInitialListedTokensOptions: vi.fn(),
}));

vi.mock("@/lib/marketplace/collection-read-queries", () => ({
  resolveCollectionProjectId: mockResolveCollectionProjectId,
  collectionQueryOptions: mockCollectionQueryOptions,
  collectionTokensQueryOptions: mockCollectionTokensQueryOptions,
  collectionListingsQueryOptions: mockCollectionListingsQueryOptions,
  collectionOrdersQueryOptions: mockCollectionOrdersQueryOptions,
  traitNamesSummaryQueryOptions: mockTraitNamesSummaryQueryOptions,
  getInitialCollectionTokensOptions: mockGetInitialCollectionTokensOptions,
  getInitialListedTokensOptions: mockGetInitialListedTokensOptions,
}));

function resolvedQueryOptions<TData>(queryKey: readonly unknown[], data: TData) {
  return {
    queryKey,
    queryFn: vi.fn().mockResolvedValue(data),
  };
}

describe("collection-prefetch", () => {
  beforeEach(() => {
    vi.resetModules();
    mockResolveCollectionProjectId.mockReset();
    mockCollectionQueryOptions.mockReset();
    mockCollectionTokensQueryOptions.mockReset();
    mockCollectionListingsQueryOptions.mockReset();
    mockCollectionOrdersQueryOptions.mockReset();
    mockTraitNamesSummaryQueryOptions.mockReset();
    mockGetInitialCollectionTokensOptions.mockReset();
    mockGetInitialListedTokensOptions.mockReset();
  });

  it("buildCollectionPageHydrationState_prefetches_collection_queries", async () => {
    mockResolveCollectionProjectId.mockReturnValue("project-a");
    mockGetInitialCollectionTokensOptions.mockReturnValue({
      address: "0xabc",
      project: "project-a",
      limit: 24,
      fetchImages: true,
    });
    mockGetInitialListedTokensOptions.mockReturnValue({
      address: "0xabc",
      project: "project-a",
      tokenIds: ["1", "0x1"],
      limit: 2,
      fetchImages: true,
    });
    mockCollectionQueryOptions.mockReturnValue(
      resolvedQueryOptions(["collection", "0xabc"], { address: "0xabc" }),
    );
    mockCollectionListingsQueryOptions.mockImplementation((options: { limit?: number }) => {
      if (options.limit === 100) {
        return resolvedQueryOptions(
          ["collection-listings", "0xabc", 100],
          [{ id: "1", token_id: "1", price: "100", currency: "0xfee", status: 1, category: 2 }],
        );
      }

      return resolvedQueryOptions(["collection-listings", "0xabc", 24], []);
    });
    mockCollectionTokensQueryOptions.mockImplementation((options: { tokenIds?: string[]; limit?: number }) => {
      if (options.tokenIds) {
        return resolvedQueryOptions(
          ["collection-tokens", "0xabc", ["1", "0x1"]],
          { page: { tokens: [], nextCursor: null }, error: null },
        );
      }

      return resolvedQueryOptions(
        ["collection-tokens", "0xabc", 24],
        { page: { tokens: [], nextCursor: null }, error: null },
      );
    });
    mockCollectionOrdersQueryOptions.mockReturnValue(
      resolvedQueryOptions(["collection-orders", "0xabc"], []),
    );
    mockTraitNamesSummaryQueryOptions.mockReturnValue(
      resolvedQueryOptions(["trait-names", "0xabc"], []),
    );

    const { buildCollectionPageHydrationState } = await import("@/lib/marketplace/collection-prefetch");
    const result = await buildCollectionPageHydrationState({ address: "0xabc" });

    expect(result.state.queries.length).toBeGreaterThanOrEqual(5);
    expect(mockCollectionTokensQueryOptions).toHaveBeenCalledTimes(2);
  });
});
