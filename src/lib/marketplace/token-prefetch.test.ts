import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockResolveCollectionProjectId,
  mockTokenDetailQueryOptions,
  mockTokenListingsQueryOptions,
} = vi.hoisted(() => ({
  mockResolveCollectionProjectId: vi.fn(),
  mockTokenDetailQueryOptions: vi.fn(),
  mockTokenListingsQueryOptions: vi.fn(),
}));

vi.mock("@/lib/marketplace/token-read-queries", () => ({
  resolveCollectionProjectId: mockResolveCollectionProjectId,
  tokenDetailQueryOptions: mockTokenDetailQueryOptions,
  tokenListingsQueryOptions: mockTokenListingsQueryOptions,
}));

function resolvedQueryOptions<TData>(queryKey: readonly unknown[], data: TData) {
  return {
    queryKey,
    queryFn: vi.fn().mockResolvedValue(data),
  };
}

describe("token-prefetch", () => {
  beforeEach(() => {
    vi.resetModules();
    mockResolveCollectionProjectId.mockReset();
    mockTokenDetailQueryOptions.mockReset();
    mockTokenListingsQueryOptions.mockReset();
  });

  it("buildTokenPageHydrationState_prefetches_token_and_listings", async () => {
    mockResolveCollectionProjectId.mockReturnValue("project-a");
    mockTokenDetailQueryOptions.mockReturnValue(
      resolvedQueryOptions(
        ["token-detail", "0xabc", "42"],
        { token: { token_id: "42" }, listings: [] },
      ),
    );
    mockTokenListingsQueryOptions.mockReturnValue(
      resolvedQueryOptions(["collection-listings", "0xabc", "42"], []),
    );

    const { buildTokenPageHydrationState } = await import("@/lib/marketplace/token-prefetch");
    const result = await buildTokenPageHydrationState({ address: "0xabc", tokenId: "42" });

    expect(result.state.queries).toHaveLength(2);
    expect(mockTokenDetailQueryOptions).toHaveBeenCalledWith({
      collection: "0xabc",
      tokenId: "42",
      projectId: "project-a",
      fetchImages: true,
    });
  });
});
