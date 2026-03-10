import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockSelectFeaturedHomeCollection,
  mockHomeCollectionQueryOptions,
  mockHomeCollectionTokensQueryOptions,
  mockHomeCollectionListingsQueryOptions,
  mockGetInitialHomeTokensOptions,
} = vi.hoisted(() => ({
  mockSelectFeaturedHomeCollection: vi.fn(),
  mockHomeCollectionQueryOptions: vi.fn(),
  mockHomeCollectionTokensQueryOptions: vi.fn(),
  mockHomeCollectionListingsQueryOptions: vi.fn(),
  mockGetInitialHomeTokensOptions: vi.fn(),
}));

vi.mock("@/lib/marketplace/home-read-queries", () => ({
  selectFeaturedHomeCollection: mockSelectFeaturedHomeCollection,
  homeCollectionQueryOptions: mockHomeCollectionQueryOptions,
  homeCollectionTokensQueryOptions: mockHomeCollectionTokensQueryOptions,
  homeCollectionListingsQueryOptions: mockHomeCollectionListingsQueryOptions,
  getInitialHomeTokensOptions: mockGetInitialHomeTokensOptions,
}));

function resolvedQueryOptions<TData>(queryKey: readonly unknown[], data: TData) {
  return {
    queryKey,
    queryFn: vi.fn().mockResolvedValue(data),
  };
}

describe("home-prefetch", () => {
  beforeEach(() => {
    vi.resetModules();
    mockSelectFeaturedHomeCollection.mockReset();
    mockHomeCollectionQueryOptions.mockReset();
    mockHomeCollectionTokensQueryOptions.mockReset();
    mockHomeCollectionListingsQueryOptions.mockReset();
    mockGetInitialHomeTokensOptions.mockReset();
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
    mockHomeCollectionQueryOptions.mockReturnValue(
      resolvedQueryOptions(["collection", "0xabc"], { address: "0xabc" }),
    );
    mockHomeCollectionTokensQueryOptions.mockReturnValue(
      resolvedQueryOptions(
        ["collection-tokens", "0xabc"],
        { page: { tokens: [], nextCursor: null }, error: null },
      ),
    );
    mockHomeCollectionListingsQueryOptions.mockReturnValue(
      resolvedQueryOptions(["collection-listings", "0xabc"], []),
    );

    const { buildHomePageHydrationState } = await import("@/lib/marketplace/home-prefetch");
    const result = await buildHomePageHydrationState();

    expect(result.featuredCollection).toEqual({
      address: "0xabc",
      projectId: "project-a",
    });
    expect(result.state.queries).toHaveLength(3);
  });
});
