import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import type { CollectionOrdersOptions } from "@cartridge/arcade/marketplace";
import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockUseMarketplaceClient } = vi.hoisted(() => ({
  mockUseMarketplaceClient: vi.fn(),
}));

vi.mock("@cartridge/arcade/marketplace/react", () => ({
  useMarketplaceClient: mockUseMarketplaceClient,
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
});
