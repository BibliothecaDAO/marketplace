import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import type { CollectionOrdersOptions } from "@cartridge/arcade/marketplace";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockUseMarketplaceCollection,
  mockUseMarketplaceCollectionTokens,
  mockUseMarketplaceCollectionOrders,
  mockUseMarketplaceCollectionListings,
  mockUseMarketplaceToken,
  mockUseMarketplaceTokenBalances,
} = vi.hoisted(() => ({
  mockUseMarketplaceCollection: vi.fn(),
  mockUseMarketplaceCollectionTokens: vi.fn(),
  mockUseMarketplaceCollectionOrders: vi.fn(),
  mockUseMarketplaceCollectionListings: vi.fn(),
  mockUseMarketplaceToken: vi.fn(),
  mockUseMarketplaceTokenBalances: vi.fn(),
}));

vi.mock("@cartridge/arcade/marketplace/react", () => ({
  useMarketplaceCollection: mockUseMarketplaceCollection,
  useMarketplaceCollectionTokens: mockUseMarketplaceCollectionTokens,
  useMarketplaceCollectionOrders: mockUseMarketplaceCollectionOrders,
  useMarketplaceCollectionListings: mockUseMarketplaceCollectionListings,
  useMarketplaceToken: mockUseMarketplaceToken,
  useMarketplaceTokenBalances: mockUseMarketplaceTokenBalances,
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

describe("marketplace hooks", () => {
  beforeEach(() => {
    mockUseMarketplaceCollection.mockReset();
    mockUseMarketplaceCollectionTokens.mockReset();
    mockUseMarketplaceCollectionOrders.mockReset();
    mockUseMarketplaceCollectionListings.mockReset();
    mockUseMarketplaceToken.mockReset();
    mockUseMarketplaceTokenBalances.mockReset();
    vi.unstubAllGlobals();
  });

  it("useCollectionQuery_delegates_to_sdk_hook", async () => {
    const expected = { status: "success", data: { address: "0xabc" } };
    mockUseMarketplaceCollection.mockReturnValue(expected);

    const { useCollectionQuery } = await import("@/lib/marketplace/hooks");
    const { result } = renderHook(
      () => useCollectionQuery({ address: "0xabc", fetchImages: true }),
    );

    expect(mockUseMarketplaceCollection).toHaveBeenCalledWith(
      { address: "0xabc", fetchImages: true },
      { enabled: true },
    );
    expect(result.current).toBe(expected);
  });

  it("useCollectionTokensQuery_delegates_to_sdk_hook", async () => {
    const expected = { status: "success", data: { page: { tokens: [] } } };
    mockUseMarketplaceCollectionTokens.mockReturnValue(expected);

    const { useCollectionTokensQuery } = await import("@/lib/marketplace/hooks");
    const { result } = renderHook(
      () => useCollectionTokensQuery({ address: "0xabc", limit: 12, fetchImages: true }),
    );

    expect(mockUseMarketplaceCollectionTokens).toHaveBeenCalledWith(
      { address: "0xabc", limit: 12, fetchImages: true },
      { enabled: true },
    );
    expect(result.current).toBe(expected);
  });

  it("useCollectionOrdersQuery_delegates_to_sdk_hook", async () => {
    const expected = { status: "success", data: [] };
    mockUseMarketplaceCollectionOrders.mockReturnValue(expected);

    const { useCollectionOrdersQuery } = await import("@/lib/marketplace/hooks");
    const { result } = renderHook(
      () =>
        useCollectionOrdersQuery({
          collection: "0xabc",
          status: "Placed" as CollectionOrdersOptions["status"],
        }),
    );

    expect(mockUseMarketplaceCollectionOrders).toHaveBeenCalledWith(
      { collection: "0xabc", status: "Placed" },
      { enabled: true },
    );
    expect(result.current).toBe(expected);
  });

  it("useCollectionListingsQuery_delegates_to_sdk_hook", async () => {
    const expected = { status: "success", data: [] };
    mockUseMarketplaceCollectionListings.mockReturnValue(expected);

    const { useCollectionListingsQuery } = await import("@/lib/marketplace/hooks");
    const { result } = renderHook(
      () => useCollectionListingsQuery({ collection: "0xabc", projectId: "project-a" }),
    );

    expect(mockUseMarketplaceCollectionListings).toHaveBeenCalledWith(
      { collection: "0xabc", projectId: "project-a" },
      { enabled: true },
    );
    expect(result.current).toBe(expected);
  });

  it("useTokenDetailQuery_delegates_to_sdk_hook", async () => {
    const expected = { status: "success", data: { token: { token_id: "42" } } };
    mockUseMarketplaceToken.mockReturnValue(expected);

    const { useTokenDetailQuery } = await import("@/lib/marketplace/hooks");
    const { result } = renderHook(
      () => useTokenDetailQuery({ collection: "0xabc", tokenId: "42", fetchImages: true }),
    );

    expect(mockUseMarketplaceToken).toHaveBeenNthCalledWith(
      1,
      { collection: "0xabc", tokenId: "42", fetchImages: true },
      { enabled: true },
    );
    expect(mockUseMarketplaceToken).toHaveBeenNthCalledWith(
      2,
      { collection: "0xabc", tokenId: "0x2a", fetchImages: true },
      { enabled: false },
    );
    expect(result.current).toBe(expected);
  });

  it("useTokenDetailQuery_uses_alternate_token_id_when_primary_has_no_token", async () => {
    const fallbackResult = {
      status: "success",
      data: { token: { token_id: "0x935", metadata: { name: "Loot Chest #2357" } } },
    };
    mockUseMarketplaceToken.mockImplementation((options: { tokenId: string }) => {
      if (options.tokenId === "2357") {
        return { status: "success", data: null };
      }
      if (options.tokenId === "0x935") {
        return fallbackResult;
      }
      return { status: "pending", data: null };
    });

    const { useTokenDetailQuery } = await import("@/lib/marketplace/hooks");
    const { result } = renderHook(
      () => useTokenDetailQuery({ collection: "0xloot", tokenId: "2357", fetchImages: true }),
    );

    expect(mockUseMarketplaceToken).toHaveBeenNthCalledWith(
      1,
      { collection: "0xloot", tokenId: "2357", fetchImages: true },
      { enabled: true },
    );
    expect(mockUseMarketplaceToken).toHaveBeenNthCalledWith(
      2,
      { collection: "0xloot", tokenId: "0x935", fetchImages: true },
      { enabled: true },
    );
    expect(result.current).toBe(fallbackResult);
  });

  it("useTokenDetailQuery_uses_scoped_token_id_when_unscoped_lookup_fails", async () => {
    const scopedResult = {
      status: "success",
      data: { token: { token_id: "1", metadata: { name: "Token #1" } } },
    };

    mockUseMarketplaceToken.mockImplementation((options: { tokenId: string }) => {
      if (options.tokenId === "1") {
        return { status: "success", data: null };
      }
      if (options.tokenId === "0x1") {
        return { status: "success", data: null };
      }
      if (options.tokenId === "0xabc:1") {
        return scopedResult;
      }
      if (options.tokenId === "0xabc:0x1") {
        return { status: "success", data: null };
      }
      return { status: "pending", data: null };
    });

    const { useTokenDetailQuery } = await import("@/lib/marketplace/hooks");
    const { result } = renderHook(
      () => useTokenDetailQuery({ collection: "0xabc", tokenId: "1", fetchImages: true }),
    );

    expect(mockUseMarketplaceToken).toHaveBeenCalledWith(
      expect.objectContaining({ tokenId: "0xabc:1" }),
      expect.objectContaining({ enabled: true }),
    );
    expect(result.current).toBe(scopedResult);
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

  it("useWalletPortfolioQuery_uses_sdk_balances_hook", async () => {
    const expected = { status: "success", data: { page: { balances: [] } } };
    mockUseMarketplaceTokenBalances.mockReturnValue(expected);

    const { useWalletPortfolioQuery } = await import("@/lib/marketplace/hooks");
    const { result } = renderHook(() => useWalletPortfolioQuery("0xwallet"));

    expect(mockUseMarketplaceTokenBalances).toHaveBeenCalledWith(
      { accountAddresses: ["0xwallet"], limit: 200 },
      { enabled: true },
    );
    expect(result.current).toBe(expected);
  });

  describe("useCollectionTraitMetadataQuery", () => {
    it("fetches_trait_metadata_via_edge_route", async () => {
      const traitMetadata = [{ traitName: "Background", traitValue: "Blue", count: 5 }];
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ traitMetadata }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const { useCollectionTraitMetadataQuery } = await import("@/lib/marketplace/hooks");
      const { result } = renderHook(
        () => useCollectionTraitMetadataQuery({ address: "0xabc", projectId: "project-a" }),
        { wrapper: makeWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/collections/0xabc/trait-metadata?projectId=project-a",
        expect.objectContaining({ method: "GET" }),
      );
      expect(result.current.data).toEqual(traitMetadata);
    });

    it("returns_error_when_trait_metadata_route_fails", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response("upstream failed", { status: 500 }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const { useCollectionTraitMetadataQuery } = await import("@/lib/marketplace/hooks");
      const { result } = renderHook(
        () => useCollectionTraitMetadataQuery({ address: "0xabc", projectId: "project-a" }),
        { wrapper: makeWrapper() },
      );

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect((result.current.error as Error).message).toContain("failed to load trait metadata");
    });
  });
});
