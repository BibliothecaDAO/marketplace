import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import type { CollectionOrdersOptions } from "@cartridge/arcade/marketplace";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockUseMarketplaceTokenBalances,
  mockCollectionQueryOptions,
  mockCollectionTokensQueryOptions,
  mockCollectionOrdersQueryOptions,
  mockCollectionListingsQueryOptions,
  mockTokenDetailQueryOptions,
  mockTraitNamesSummaryQueryOptions,
  mockTraitValuesQueryOptions,
  mockTokenBalancesQueryOptions,
} = vi.hoisted(() => ({
  mockUseMarketplaceTokenBalances: vi.fn(),
  mockCollectionQueryOptions: vi.fn(),
  mockCollectionTokensQueryOptions: vi.fn(),
  mockCollectionOrdersQueryOptions: vi.fn(),
  mockCollectionListingsQueryOptions: vi.fn(),
  mockTokenDetailQueryOptions: vi.fn(),
  mockTraitNamesSummaryQueryOptions: vi.fn(),
  mockTraitValuesQueryOptions: vi.fn(),
  mockTokenBalancesQueryOptions: vi.fn(),
}));

vi.mock("@cartridge/arcade/marketplace/react", () => ({
  useMarketplaceTokenBalances: mockUseMarketplaceTokenBalances,
}));

vi.mock("@/lib/marketplace/read-queries", () => ({
  collectionQueryOptions: mockCollectionQueryOptions,
  collectionTokensQueryOptions: mockCollectionTokensQueryOptions,
  collectionOrdersQueryOptions: mockCollectionOrdersQueryOptions,
  collectionListingsQueryOptions: mockCollectionListingsQueryOptions,
  tokenDetailQueryOptions: mockTokenDetailQueryOptions,
  traitNamesSummaryQueryOptions: mockTraitNamesSummaryQueryOptions,
  traitValuesQueryOptions: mockTraitValuesQueryOptions,
  tokenBalancesQueryOptions: mockTokenBalancesQueryOptions,
}));

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  function QueryWrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  }

  QueryWrapper.displayName = "QueryWrapper";
  return QueryWrapper;
}

function resolvedQueryOptions<TData>(queryKey: readonly unknown[], data: TData) {
  return {
    queryKey,
    queryFn: vi.fn().mockResolvedValue(data),
  };
}

describe("marketplace hooks", () => {
  beforeEach(() => {
    vi.resetModules();
    mockUseMarketplaceTokenBalances.mockReset();
    mockCollectionQueryOptions.mockReset();
    mockCollectionTokensQueryOptions.mockReset();
    mockCollectionOrdersQueryOptions.mockReset();
    mockCollectionListingsQueryOptions.mockReset();
    mockTokenDetailQueryOptions.mockReset();
    mockTraitNamesSummaryQueryOptions.mockReset();
    mockTraitValuesQueryOptions.mockReset();
    mockTokenBalancesQueryOptions.mockReset();
  });

  it("useCollectionQuery_uses_shared_read_query_options", async () => {
    mockCollectionQueryOptions.mockReturnValue(
      resolvedQueryOptions(["collection", "0xabc"], { address: "0xabc" }),
    );

    const { useCollectionQuery } = await import("@/lib/marketplace/hooks");
    const { result } = renderHook(
      () => useCollectionQuery({ address: "0xabc", fetchImages: true }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockCollectionQueryOptions).toHaveBeenCalledWith({
      address: "0xabc",
      fetchImages: true,
    });
    expect(result.current.data).toEqual({ address: "0xabc" });
  });

  it("useCollectionTokensQuery_uses_shared_read_query_options", async () => {
    mockCollectionTokensQueryOptions.mockReturnValue(
      resolvedQueryOptions(
        ["collection-tokens", "0xabc"],
        { page: { tokens: [], nextCursor: null }, error: null },
      ),
    );

    const { useCollectionTokensQuery } = await import("@/lib/marketplace/hooks");
    const { result } = renderHook(
      () => useCollectionTokensQuery({ address: "0xabc", limit: 12, fetchImages: true }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockCollectionTokensQueryOptions).toHaveBeenCalledWith({
      address: "0xabc",
      limit: 12,
      fetchImages: true,
    });
    expect(result.current.data).toEqual({ page: { tokens: [], nextCursor: null }, error: null });
  });

  it("useCollectionOrdersQuery_uses_shared_read_query_options", async () => {
    mockCollectionOrdersQueryOptions.mockReturnValue(
      resolvedQueryOptions(["collection-orders", "0xabc"], []),
    );

    const { useCollectionOrdersQuery } = await import("@/lib/marketplace/hooks");
    const { result } = renderHook(
      () =>
        useCollectionOrdersQuery({
          collection: "0xabc",
          status: "Placed" as CollectionOrdersOptions["status"],
        }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockCollectionOrdersQueryOptions).toHaveBeenCalledWith({
      collection: "0xabc",
      status: "Placed",
    });
    expect(result.current.data).toEqual([]);
  });

  it("useCollectionListingsQuery_uses_shared_read_query_options", async () => {
    mockCollectionListingsQueryOptions.mockReturnValue(
      resolvedQueryOptions(["collection-listings", "0xabc"], []),
    );

    const { useCollectionListingsQuery } = await import("@/lib/marketplace/hooks");
    const { result } = renderHook(
      () => useCollectionListingsQuery({ collection: "0xabc", projectId: "project-a" }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockCollectionListingsQueryOptions).toHaveBeenCalledWith({
      collection: "0xabc",
      projectId: "project-a",
    });
    expect(result.current.data).toEqual([]);
  });

  it("useTokenDetailQuery_uses_shared_read_query_options", async () => {
    mockTokenDetailQueryOptions.mockReturnValue(
      resolvedQueryOptions(
        ["token-detail", "0xabc", "42"],
        { token: { token_id: "42", metadata: { name: "Token #42" } } },
      ),
    );

    const { useTokenDetailQuery } = await import("@/lib/marketplace/hooks");
    const { result } = renderHook(
      () => useTokenDetailQuery({ collection: "0xabc", tokenId: "42", fetchImages: true }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockTokenDetailQueryOptions).toHaveBeenCalledWith({
      collection: "0xabc",
      tokenId: "42",
      fetchImages: true,
    });
    expect(result.current.data).toEqual({
      token: { token_id: "42", metadata: { name: "Token #42" } },
    });
  });

  it("useTokenOwnershipQuery_passes_alt_token_ids", async () => {
    mockUseMarketplaceTokenBalances.mockReturnValue({ status: "success", data: { page: { balances: [] } } });

    const { useTokenOwnershipQuery } = await import("@/lib/marketplace/hooks");
    renderHook(
      () => useTokenOwnershipQuery({ collection: "0xcol", tokenId: "2648", accountAddress: "0xabc" }),
    );

    expect(mockUseMarketplaceTokenBalances).toHaveBeenCalledWith(
      expect.objectContaining({
        contractAddresses: ["0xcol"],
        accountAddresses: ["0xabc"],
        tokenIds: expect.arrayContaining(["2648", "0xa58"]),
      }),
      expect.objectContaining({ enabled: true }),
    );
  });

  it("useTokenHolderQuery_passes_alt_token_ids", async () => {
    mockUseMarketplaceTokenBalances.mockReturnValue({ status: "success", data: { page: { balances: [] } } });

    const { useTokenHolderQuery } = await import("@/lib/marketplace/hooks");
    renderHook(
      () => useTokenHolderQuery({ collection: "0xcol", tokenId: "0xa58" }),
    );

    expect(mockUseMarketplaceTokenBalances).toHaveBeenCalledWith(
      expect.objectContaining({
        contractAddresses: ["0xcol"],
        tokenIds: expect.arrayContaining(["0xa58", "2648"]),
      }),
      expect.objectContaining({ enabled: true }),
    );
  });

  it("useWalletPortfolioQuery_uses_shared_read_query_options", async () => {
    mockTokenBalancesQueryOptions.mockReturnValue(
      resolvedQueryOptions(
        ["token-balances", "0xwallet"],
        { page: { balances: [] }, error: null },
      ),
    );

    const { useWalletPortfolioQuery } = await import("@/lib/marketplace/hooks");
    const { result } = renderHook(() => useWalletPortfolioQuery("0xwallet"), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockTokenBalancesQueryOptions).toHaveBeenCalledWith({
      accountAddresses: ["0xwallet"],
      limit: 200,
    });
    expect(result.current.data).toEqual({ page: { balances: [] }, error: null });
  });

  it("useTraitNamesSummaryQuery_uses_shared_read_query_options", async () => {
    mockTraitNamesSummaryQueryOptions.mockReturnValue(
      resolvedQueryOptions(
        ["trait-names", "0xabc"],
        [{ traitName: "Background", valueCount: 2 }],
      ),
    );

    const { useTraitNamesSummaryQuery } = await import("@/lib/marketplace/hooks");
    const { result } = renderHook(
      () => useTraitNamesSummaryQuery({ address: "0xabc", projectId: "project-a" }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockTraitNamesSummaryQueryOptions).toHaveBeenCalledWith({
      address: "0xabc",
      projectId: "project-a",
    });
    expect(result.current.data).toEqual([{ traitName: "Background", valueCount: 2 }]);
  });

  it("useTraitValuesQuery_uses_shared_read_query_options", async () => {
    mockTraitValuesQueryOptions.mockReturnValue(
      resolvedQueryOptions(
        ["trait-values", "0xabc", "Eyes"],
        [{ traitValue: "Blue", count: 3 }],
      ),
    );

    const { useTraitValuesQuery } = await import("@/lib/marketplace/hooks");
    const { result } = renderHook(
      () =>
        useTraitValuesQuery({
          address: "0xabc",
          traitName: "Eyes",
          otherTraitFilters: [{ name: "Background", value: "Blue" }],
          projectId: "project-a",
        }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockTraitValuesQueryOptions).toHaveBeenCalledWith({
      address: "0xabc",
      traitName: "Eyes",
      otherTraitFilters: [{ name: "Background", value: "Blue" }],
      projectId: "project-a",
    });
    expect(result.current.data).toEqual([{ traitValue: "Blue", count: 3 }]);
  });

  it("useTraitValuesQuery_is_idle_when_trait_name_is_null", async () => {
    mockTraitValuesQueryOptions.mockReturnValue(
      resolvedQueryOptions(["trait-values", "0xabc", null], []),
    );

    const { useTraitValuesQuery } = await import("@/lib/marketplace/hooks");
    const { result } = renderHook(
      () => useTraitValuesQuery({ address: "0xabc", traitName: null }),
      { wrapper: makeWrapper() },
    );

    expect(result.current.fetchStatus).toBe("idle");
  });
});
