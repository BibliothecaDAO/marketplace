import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import type { CollectionOrdersOptions } from "@cartridge/arcade/marketplace";
import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockUseMarketplaceClient, mockUseMarketplaceTokenBalances } = vi.hoisted(() => ({
  mockUseMarketplaceClient: vi.fn(),
  mockUseMarketplaceTokenBalances: vi.fn(),
}));

vi.mock("@cartridge/arcade/marketplace/react", () => ({
  useMarketplaceClient: mockUseMarketplaceClient,
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

function mockClient(overrides: Record<string, unknown> = {}) {
  return {
    getCollection: vi.fn().mockResolvedValue(null),
    listCollectionTokens: vi.fn().mockResolvedValue({ page: null, error: null }),
    getCollectionOrders: vi.fn().mockResolvedValue([]),
    listCollectionListings: vi.fn().mockResolvedValue([]),
    getToken: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe("marketplace cached hooks", () => {
  beforeEach(() => {
    mockUseMarketplaceClient.mockReset();
    mockUseMarketplaceTokenBalances.mockReset();
    mockUseMarketplaceTokenBalances.mockReturnValue({ data: [], isLoading: false });
    vi.unstubAllGlobals();
  });

  describe("useCollectionQuery", () => {
    it("fetches_collection_via_client", async () => {
      const collection = { address: "0xabc", contractType: "erc721" };
      const client = mockClient({
        getCollection: vi.fn().mockResolvedValue(collection),
      });
      mockUseMarketplaceClient.mockReturnValue({ client, status: "ready" });

      const { useCollectionQuery } = await import("@/lib/marketplace/hooks");
      const { result } = renderHook(
        () => useCollectionQuery({ address: "0xabc", fetchImages: true }),
        { wrapper: makeWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(collection);
      expect(client.getCollection).toHaveBeenCalledWith({
        address: "0xabc",
        fetchImages: true,
      });
    });

    it("stays_disabled_when_client_not_ready", async () => {
      mockUseMarketplaceClient.mockReturnValue({ client: null, status: "idle" });

      const { useCollectionQuery } = await import("@/lib/marketplace/hooks");
      const { result } = renderHook(
        () => useCollectionQuery({ address: "0xabc" }),
        { wrapper: makeWrapper() },
      );

      expect(result.current.fetchStatus).toBe("idle");
    });
  });

  describe("useCollectionTokensQuery", () => {
    it("fetches_tokens_and_returns_page", async () => {
      const page = {
        page: { tokens: [{ token_id: "1" }], nextCursor: "abc" },
        error: null,
      };
      const client = mockClient({
        listCollectionTokens: vi.fn().mockResolvedValue(page),
      });
      mockUseMarketplaceClient.mockReturnValue({ client, status: "ready" });

      const { useCollectionTokensQuery } = await import(
        "@/lib/marketplace/hooks"
      );
      const { result } = renderHook(
        () =>
          useCollectionTokensQuery({
            address: "0xabc",
            limit: 12,
            fetchImages: true,
          }),
        { wrapper: makeWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.page?.tokens).toHaveLength(1);
      expect(client.listCollectionTokens).toHaveBeenCalledWith({
        address: "0xabc",
        limit: 12,
        fetchImages: true,
      });
    });

    it("retries_without_images_on_invalid_content_type_error", async () => {
      const page = {
        page: { tokens: [{ token_id: "1" }], nextCursor: null },
        error: null,
      };
      const listCollectionTokens = vi
        .fn()
        .mockRejectedValueOnce(
          new Error(
            'failed to get tokens: status: Unknown, message: "invalid content type: application/json; charset=utf-8"',
          ),
        )
        .mockResolvedValueOnce(page);
      const client = mockClient({ listCollectionTokens });
      mockUseMarketplaceClient.mockReturnValue({ client, status: "ready" });

      const { useCollectionTokensQuery } = await import(
        "@/lib/marketplace/hooks"
      );
      const { result } = renderHook(
        () =>
          useCollectionTokensQuery({
            address: "0xabc",
            limit: 12,
            fetchImages: true,
          }),
        { wrapper: makeWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(listCollectionTokens).toHaveBeenNthCalledWith(1, {
        address: "0xabc",
        limit: 12,
        fetchImages: true,
      });
      expect(listCollectionTokens).toHaveBeenNthCalledWith(2, {
        address: "0xabc",
        limit: 12,
        fetchImages: false,
      });
      expect(result.current.data).toEqual(page);
    });

    it("retries_transient_timeout_errors", async () => {
      const page = {
        page: { tokens: [{ token_id: "2" }], nextCursor: null },
        error: null,
      };
      const listCollectionTokens = vi
        .fn()
        .mockRejectedValueOnce(new Error("deadline exceeded"))
        .mockRejectedValueOnce(new Error("request timeout"))
        .mockResolvedValueOnce(page);
      const client = mockClient({ listCollectionTokens });
      mockUseMarketplaceClient.mockReturnValue({ client, status: "ready" });

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
      expect(listCollectionTokens).toHaveBeenCalledTimes(3);
      expect(result.current.data).toEqual(page);
    });
  });

  describe("useCollectionOrdersQuery", () => {
    it("fetches_orders_for_collection", async () => {
      const orders = [{ id: 1, tokenId: 5 }];
      const client = mockClient({
        getCollectionOrders: vi.fn().mockResolvedValue(orders),
      });
      mockUseMarketplaceClient.mockReturnValue({ client, status: "ready" });

      const { useCollectionOrdersQuery } = await import(
        "@/lib/marketplace/hooks"
      );
      const { result } = renderHook(
        () =>
          useCollectionOrdersQuery({ collection: "0xabc", status: "Placed" as CollectionOrdersOptions["status"] }),
        { wrapper: makeWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(orders);
      expect(client.getCollectionOrders).toHaveBeenCalledWith({
        collection: "0xabc",
        status: "Placed",
      });
    });
  });

  describe("useCollectionListingsQuery", () => {
    it("fetches_listings_for_collection", async () => {
      const listings = [{ id: 2, tokenId: 3 }];
      const client = mockClient({
        listCollectionListings: vi.fn().mockResolvedValue(listings),
      });
      mockUseMarketplaceClient.mockReturnValue({ client, status: "ready" });

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
      expect(client.listCollectionListings).toHaveBeenCalledWith({
        collection: "0xabc",
        tokenId: "5",
        projectId: "proj-a",
      });
    });
  });

  describe("useTokenDetailQuery", () => {
    it("fetches_token_detail_via_get_token", async () => {
      const detail = {
        token: { token_id: "42", metadata: { name: "Dragon" } },
        orders: [],
        listings: [],
      };
      const client = mockClient({
        getToken: vi.fn().mockResolvedValue(detail),
      });
      mockUseMarketplaceClient.mockReturnValue({ client, status: "ready" });

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
      expect(client.getToken).toHaveBeenCalledWith({
        collection: "0xabc",
        tokenId: "42",
        fetchImages: true,
      });
    });

    it("stays_disabled_when_no_token_id", async () => {
      const client = mockClient();
      mockUseMarketplaceClient.mockReturnValue({ client, status: "ready" });

      const { useTokenDetailQuery } = await import("@/lib/marketplace/hooks");
      const { result } = renderHook(
        () => useTokenDetailQuery({ collection: "0xabc", tokenId: "" }),
        { wrapper: makeWrapper() },
      );

      expect(result.current.fetchStatus).toBe("idle");
      expect(client.getToken).not.toHaveBeenCalled();
    });

    it("retries_with_hex_token_id_when_decimal_lookup_returns_null", async () => {
      const detail = {
        token: { token_id: "0x935", metadata: { name: "Loot Chest #2357" } },
        orders: [],
        listings: [],
      };
      const getToken = vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(detail);
      const client = mockClient({ getToken });
      mockUseMarketplaceClient.mockReturnValue({ client, status: "ready" });

      const { useTokenDetailQuery } = await import("@/lib/marketplace/hooks");
      const { result } = renderHook(
        () =>
          useTokenDetailQuery({
            collection: "0xloot",
            tokenId: "2357",
            fetchImages: true,
          }),
        { wrapper: makeWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(detail);
      expect(getToken).toHaveBeenNthCalledWith(1, {
        collection: "0xloot",
        tokenId: "2357",
        fetchImages: true,
      });
      expect(getToken).toHaveBeenNthCalledWith(2, {
        collection: "0xloot",
        tokenId: "0x935",
        fetchImages: true,
      });
    });

    it("retries_with_decimal_token_id_when_hex_lookup_returns_null", async () => {
      const detail = {
        token: { token_id: "2357", metadata: { name: "Loot Chest #2357" } },
        orders: [],
        listings: [],
      };
      const getToken = vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(detail);
      const client = mockClient({ getToken });
      mockUseMarketplaceClient.mockReturnValue({ client, status: "ready" });

      const { useTokenDetailQuery } = await import("@/lib/marketplace/hooks");
      const { result } = renderHook(
        () =>
          useTokenDetailQuery({
            collection: "0xloot",
            tokenId: "0x935",
            fetchImages: true,
          }),
        { wrapper: makeWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(detail);
      expect(getToken).toHaveBeenNthCalledWith(1, {
        collection: "0xloot",
        tokenId: "0x935",
        fetchImages: true,
      });
      expect(getToken).toHaveBeenNthCalledWith(2, {
        collection: "0xloot",
        tokenId: "2357",
        fetchImages: true,
      });
    });

    it("retries_with_alternate_token_id_when_first_lookup_throws", async () => {
      const detail = {
        token: { token_id: "0x935", metadata: { name: "Loot Chest #2357" } },
        orders: [],
        listings: [],
      };
      const getToken = vi
        .fn()
        .mockRejectedValueOnce(new Error("invalid token format"))
        .mockResolvedValueOnce(detail);
      const client = mockClient({ getToken });
      mockUseMarketplaceClient.mockReturnValue({ client, status: "ready" });

      const { useTokenDetailQuery } = await import("@/lib/marketplace/hooks");
      const { result } = renderHook(
        () =>
          useTokenDetailQuery({
            collection: "0xloot",
            tokenId: "2357",
            fetchImages: true,
          }),
        { wrapper: makeWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(detail);
      expect(getToken).toHaveBeenNthCalledWith(1, {
        collection: "0xloot",
        tokenId: "2357",
        fetchImages: true,
      });
      expect(getToken).toHaveBeenNthCalledWith(2, {
        collection: "0xloot",
        tokenId: "0x935",
        fetchImages: true,
      });
    });
  });

  describe("useTokenOwnershipQuery", () => {
    it("passes_both_decimal_and_hex_token_ids_when_given_decimal", async () => {
      mockUseMarketplaceClient.mockReturnValue({ client: {}, status: "ready" });

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
        expect.objectContaining({ enabled: true }),
      );
    });

    it("passes_both_hex_and_decimal_token_ids_when_given_hex", async () => {
      mockUseMarketplaceClient.mockReturnValue({ client: {}, status: "ready" });

      const { useTokenOwnershipQuery } = await import("@/lib/marketplace/hooks");
      renderHook(
        () =>
          useTokenOwnershipQuery({
            collection: "0xcol",
            tokenId: "0xa58",
            accountAddress: "0xabc",
          }),
        { wrapper: makeWrapper() },
      );

      expect(mockUseMarketplaceTokenBalances).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenIds: expect.arrayContaining(["0xa58", "2648"]),
        }),
        expect.objectContaining({ enabled: true }),
      );
    });

    it("stays_disabled_when_no_account_address", async () => {
      mockUseMarketplaceClient.mockReturnValue({ client: {}, status: "ready" });

      const { useTokenOwnershipQuery } = await import("@/lib/marketplace/hooks");
      renderHook(
        () =>
          useTokenOwnershipQuery({
            collection: "0xcol",
            tokenId: "2648",
          }),
        { wrapper: makeWrapper() },
      );

      expect(mockUseMarketplaceTokenBalances).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ enabled: false }),
      );
    });
  });

  describe("useTokenHolderQuery", () => {
    it("passes_both_decimal_and_hex_token_ids_when_given_decimal", async () => {
      mockUseMarketplaceClient.mockReturnValue({ client: {}, status: "ready" });

      const { useTokenHolderQuery } = await import("@/lib/marketplace/hooks");
      renderHook(
        () =>
          useTokenHolderQuery({
            collection: "0xcol",
            tokenId: "2648",
          }),
        { wrapper: makeWrapper() },
      );

      expect(mockUseMarketplaceTokenBalances).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenIds: expect.arrayContaining(["2648", "0xa58"]),
        }),
        expect.objectContaining({ enabled: true }),
      );
    });

    it("passes_both_hex_and_decimal_token_ids_when_given_hex", async () => {
      mockUseMarketplaceClient.mockReturnValue({ client: {}, status: "ready" });

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
        expect.objectContaining({ enabled: true }),
      );
    });

    it("stays_disabled_when_collection_missing", async () => {
      mockUseMarketplaceClient.mockReturnValue({ client: {}, status: "ready" });

      const { useTokenHolderQuery } = await import("@/lib/marketplace/hooks");
      renderHook(
        () =>
          useTokenHolderQuery({
            collection: "",
            tokenId: "2648",
          }),
        { wrapper: makeWrapper() },
      );

      expect(mockUseMarketplaceTokenBalances).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ enabled: false }),
      );
    });
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
