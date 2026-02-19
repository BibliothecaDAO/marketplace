import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import type { CollectionOrdersOptions } from "@cartridge/arcade/marketplace";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const { mockUseMarketplaceTokenBalances } = vi.hoisted(() => ({
  mockUseMarketplaceTokenBalances: vi.fn(),
}));

vi.mock("@cartridge/arcade/marketplace/react", () => ({
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

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}

describe("marketplace cached hooks", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockUseMarketplaceTokenBalances.mockReset();
    mockUseMarketplaceTokenBalances.mockReturnValue({ data: [], isLoading: false });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("useCollectionQuery", () => {
    it("fetches_collection_from_internal_api", async () => {
      const collection = { address: "0xabc", contractType: "erc721" };
      fetchMock.mockImplementation(() => jsonResponse(collection));

      const { useCollectionQuery } = await import("@/lib/marketplace/hooks");
      const { result } = renderHook(
        () =>
          useCollectionQuery({
            address: "0xabc",
            projectId: "project-a",
            fetchImages: true,
          }),
        { wrapper: makeWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(collection);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const requestUrl = String(fetchMock.mock.calls[0][0]);
      expect(requestUrl).toContain("/api/marketplace/collection?");
      expect(requestUrl).toContain("address=0xabc");
      expect(requestUrl).toContain("projectId=project-a");
      expect(requestUrl).toContain("fetchImages=true");
    });

    it("stays_disabled_when_address_missing", async () => {
      const { useCollectionQuery } = await import("@/lib/marketplace/hooks");
      const { result } = renderHook(() => useCollectionQuery({ address: "" }), {
        wrapper: makeWrapper(),
      });

      expect(result.current.fetchStatus).toBe("idle");
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("useCollectionTokensQuery", () => {
    it("fetches_tokens_and_returns_page", async () => {
      const page = {
        page: { tokens: [{ token_id: "1" }], nextCursor: "abc" },
        error: null,
      };
      fetchMock.mockImplementation(() => jsonResponse(page));

      const { useCollectionTokensQuery } = await import(
        "@/lib/marketplace/hooks"
      );
      const { result } = renderHook(
        () =>
          useCollectionTokensQuery({
            address: "0xabc",
            limit: 12,
            fetchImages: true,
            tokenIds: ["7", "2"],
            attributeFilters: {
              Background: new Set(["Blue", "Red"]),
            },
          }),
        { wrapper: makeWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.page?.tokens).toHaveLength(1);
      const requestUrl = String(fetchMock.mock.calls[0][0]);
      expect(requestUrl).toContain("/api/marketplace/collection-tokens?");
      expect(requestUrl).toContain("address=0xabc");
      expect(requestUrl).toContain("limit=12");
      expect(requestUrl).toContain("fetchImages=true");
      expect(requestUrl).toContain("tokenIds=2%2C7");
      expect(requestUrl).toContain("attributeFilters=");
    });

    it("retries_transient_timeout_errors", async () => {
      const page = {
        page: { tokens: [{ token_id: "2" }], nextCursor: null },
        error: null,
      };
      fetchMock
        .mockRejectedValueOnce(new Error("deadline exceeded"))
        .mockRejectedValueOnce(new Error("request timeout"))
        .mockImplementationOnce(() => jsonResponse(page));

      const { useCollectionTokensQuery } = await import(
        "@/lib/marketplace/hooks"
      );
      const { result } = renderHook(
        () =>
          useCollectionTokensQuery({
            address: "0xabc",
            limit: 12,
            fetchImages: false,
          }),
        { wrapper: makeWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(result.current.data).toEqual(page);
    });
  });

  describe("useCollectionOrdersQuery", () => {
    it("fetches_orders_for_collection", async () => {
      const orders = [{ id: 1, tokenId: 5 }];
      fetchMock.mockImplementation(() => jsonResponse(orders));

      const { useCollectionOrdersQuery } = await import(
        "@/lib/marketplace/hooks"
      );
      const { result } = renderHook(
        () =>
          useCollectionOrdersQuery({
            collection: "0xabc",
            status: "Placed" as CollectionOrdersOptions["status"],
          }),
        { wrapper: makeWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(orders);
      const requestUrl = String(fetchMock.mock.calls[0][0]);
      expect(requestUrl).toContain("/api/marketplace/collection-orders?");
      expect(requestUrl).toContain("collection=0xabc");
      expect(requestUrl).toContain("status=Placed");
    });
  });

  describe("useCollectionListingsQuery", () => {
    it("fetches_listings_for_collection", async () => {
      const listings = [{ id: 2, tokenId: 3 }];
      fetchMock.mockImplementation(() => jsonResponse(listings));

      const { useCollectionListingsQuery } = await import(
        "@/lib/marketplace/hooks"
      );
      const { result } = renderHook(
        () =>
          useCollectionListingsQuery({
            collection: "0xabc",
            tokenId: "5",
            projectId: "proj-a",
          }),
        { wrapper: makeWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(listings);
      const requestUrl = String(fetchMock.mock.calls[0][0]);
      expect(requestUrl).toContain("/api/marketplace/collection-listings?");
      expect(requestUrl).toContain("collection=0xabc");
      expect(requestUrl).toContain("tokenId=5");
      expect(requestUrl).toContain("projectId=proj-a");
    });
  });

  describe("useTokenDetailQuery", () => {
    it("fetches_token_detail_from_internal_api", async () => {
      const detail = {
        token: { token_id: "42", metadata: { name: "Dragon" } },
        orders: [],
        listings: [],
      };
      fetchMock.mockImplementation(() => jsonResponse(detail));

      const { useTokenDetailQuery } = await import("@/lib/marketplace/hooks");
      const { result } = renderHook(
        () =>
          useTokenDetailQuery({
            collection: "0xabc",
            tokenId: "42",
            fetchImages: true,
          }),
        { wrapper: makeWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(detail);
      const requestUrl = String(fetchMock.mock.calls[0][0]);
      expect(requestUrl).toContain("/api/marketplace/token-detail?");
      expect(requestUrl).toContain("collection=0xabc");
      expect(requestUrl).toContain("tokenId=42");
      expect(requestUrl).toContain("fetchImages=true");
    });

    it("stays_disabled_when_no_token_id", async () => {
      const { useTokenDetailQuery } = await import("@/lib/marketplace/hooks");
      const { result } = renderHook(
        () => useTokenDetailQuery({ collection: "0xabc", tokenId: "" }),
        { wrapper: makeWrapper() },
      );

      expect(result.current.fetchStatus).toBe("idle");
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("useCollectionTraitMetadataQuery", () => {
    it("fetches_trait_metadata_from_internal_api", async () => {
      const data = [{ traitName: "Background", traitValue: "Blue", count: 8 }];
      fetchMock.mockImplementation(() => jsonResponse(data));

      const { useCollectionTraitMetadataQuery } = await import(
        "@/lib/marketplace/hooks"
      );
      const { result } = renderHook(
        () =>
          useCollectionTraitMetadataQuery({
            address: "0xabc",
            projectId: "project-a",
          }),
        { wrapper: makeWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(data);
      const requestUrl = String(fetchMock.mock.calls[0][0]);
      expect(requestUrl).toContain("/api/marketplace/collection-trait-metadata?");
      expect(requestUrl).toContain("address=0xabc");
      expect(requestUrl).toContain("projectId=project-a");
    });
  });

  describe("useTokenOwnershipQuery", () => {
    it("passes_both_decimal_and_hex_token_ids_when_given_decimal", async () => {
      const { useTokenOwnershipQuery } = await import("@/lib/marketplace/hooks");
      renderHook(
        () =>
          useTokenOwnershipQuery({
            collection: "0xcol",
            tokenId: "2648",
            accountAddress: "0xabc",
          }),
        { wrapper: makeWrapper() },
      );

      expect(mockUseMarketplaceTokenBalances).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenIds: expect.arrayContaining(["2648", "0xa58"]),
        }),
        true,
      );
    });
  });

  describe("useTokenHolderQuery", () => {
    it("passes_both_hex_and_decimal_token_ids_when_given_hex", async () => {
      const { useTokenHolderQuery } = await import("@/lib/marketplace/hooks");
      renderHook(
        () =>
          useTokenHolderQuery({
            collection: "0xcol",
            tokenId: "0xa58",
          }),
        { wrapper: makeWrapper() },
      );

      expect(mockUseMarketplaceTokenBalances).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenIds: expect.arrayContaining(["0xa58", "2648"]),
        }),
        true,
      );
    });
  });

  describe("useWalletPortfolioQuery", () => {
    it("keeps_wallet_portfolio_reads_on_token_balances", async () => {
      const { useWalletPortfolioQuery } = await import("@/lib/marketplace/hooks");
      renderHook(() => useWalletPortfolioQuery("0xwallet"), {
        wrapper: makeWrapper(),
      });

      expect(mockUseMarketplaceTokenBalances).toHaveBeenCalledWith(
        expect.objectContaining({
          accountAddresses: ["0xwallet"],
          limit: 200,
        }),
        true,
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
