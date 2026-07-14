import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { api } = vi.hoisted(() => ({
  api: {
    collection: vi.fn(),
    tokens: vi.fn(),
    orders: vi.fn(),
    listings: vi.fn(),
    token: vi.fn(),
    activity: vi.fn(),
    holdings: vi.fn(),
    traits: vi.fn(),
  },
}));

vi.mock("@/lib/marketplace/api-client", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/marketplace/api-client")>(),
  getMarketplaceApiClient: () => api,
}));

const felt = (digit: string) => `0x${digit.repeat(64)}`;
const meta = {
  schemaVersion: "1.0.0",
  chain: "SN_MAIN",
  chainId: "0x534e5f4d41494e",
  worldAddress: felt("1"),
  marketplaceAddress: felt("2"),
  indexedBlock: 100,
  indexedBlockHash: felt("3"),
  chainHead: 101,
  lagBlocks: 1,
  finality: "accepted_l2",
  observedAt: "2026-07-14T00:00:00.000Z",
} as const;

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  function QueryWrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  }
  return QueryWrapper;
}

describe("owned marketplace hooks", () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
  });

  it("loads and adapts collection and globally-filtered token responses", async () => {
    api.collection.mockResolvedValue({
      data: {
        address: felt("4"), name: "Genesis", standard: "ERC721",
        deploymentBlock: 1, verified: true, tokenCount: "8", listingCount: "2",
        floorByCurrency: [],
      },
      meta,
    });
    api.tokens.mockResolvedValue({
      data: {
        items: [{
          collection: felt("4"), tokenId: "42", name: "Mage", description: null,
          image: null, owner: felt("5"), balance: "1", firstSeenBlock: 10,
          attributes: [], floorByCurrency: [],
        }],
        nextCursor: "next",
      },
      meta,
    });
    const { useCollectionQuery, useCollectionTokensQuery } = await import("./hooks");
    const collection = renderHook(
      () => useCollectionQuery({ address: felt("4") }),
      { wrapper: makeWrapper() },
    );
    const tokens = renderHook(
      () => useCollectionTokensQuery({
        address: felt("4"), cursor: null, limit: 24, tokenIds: ["0x2a"],
        sort: "price-desc", currency: felt("6"),
        attributeFilters: { Power: ["10"] },
      }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(collection.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(tokens.result.current.isSuccess).toBe(true));
    expect(collection.result.current.data?.metadata).toEqual({ name: "Genesis" });
    expect(api.tokens).toHaveBeenCalledWith(felt("4"), expect.objectContaining({
      tokenIds: ["0x2a"], sort: "price-desc", currency: felt("6"),
      traits: [{ name: "Power", values: ["10"] }],
    }));
    expect(tokens.result.current.data?.page?.tokens[0]?.token_id).toBe("42");
    expect(tokens.result.current.data?.page?.nextCursor).toBe("next");
  });

  it("loads token detail, orders, listings, and activity from owned routes", async () => {
    const token = {
      collection: felt("4"), tokenId: "42", name: "Mage", description: null,
      image: null, owner: felt("5"), balance: "1", firstSeenBlock: 10,
      attributes: [], floorByCurrency: [],
    };
    api.token.mockResolvedValue({ data: token, meta });
    api.orders.mockResolvedValue({ data: { items: [], nextCursor: null }, meta });
    api.listings.mockResolvedValue({ data: { items: [], nextCursor: null }, meta });
    api.activity.mockResolvedValue({ data: { items: [], nextCursor: null }, meta });
    const { useTokenDetailQuery } = await import("./hooks");
    const { result } = renderHook(
      () => useTokenDetailQuery({ collection: felt("4"), tokenId: "0x2a" }),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.token).toHaveBeenCalledWith(felt("4"), "42", undefined);
    expect(result.current.data).toEqual(expect.objectContaining({
      token: expect.objectContaining({ token_id: "42" }),
      orders: [], listings: [], activity: [],
    }));
  });

  it("paginates all holdings and exposes the existing balance boundary", async () => {
    const holding = {
      account: felt("7"), collection: felt("4"), tokenId: "42", balance: "1",
      token: {
        collection: felt("4"), tokenId: "42", name: "Mage", description: null,
        image: null, owner: felt("7"), balance: "1", firstSeenBlock: 10,
        attributes: [], floorByCurrency: [],
      },
    };
    api.holdings
      .mockResolvedValueOnce({ data: { items: [holding], nextCursor: "two" }, meta })
      .mockResolvedValueOnce({ data: { items: [], nextCursor: null }, meta });
    const { useWalletPortfolioQuery } = await import("./hooks");
    const { result } = renderHook(() => useWalletPortfolioQuery(felt("7")), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.holdings).toHaveBeenNthCalledWith(2, felt("7"), {
      cursor: "two", limit: 200,
    });
    expect(result.current.data?.page?.balances).toEqual([
      expect.objectContaining({ contract_address: felt("4"), token_id: "42" }),
    ]);
  });

  it("adapts trait facets and sends cross-trait filters", async () => {
    api.traits.mockResolvedValue({
      data: [{ name: "Background", kind: "string", values: [
        { value: "Blue", count: "5" }, { value: "Red", count: "3" },
      ] }],
      meta,
    });
    const { useTraitNamesSummaryQuery, useTraitValuesQuery } = await import("./hooks");
    const names = renderHook(
      () => useTraitNamesSummaryQuery({ address: felt("4") }),
      { wrapper: makeWrapper() },
    );
    const values = renderHook(
      () => useTraitValuesQuery({
        address: felt("4"), traitName: "Background",
        otherTraitFilters: [{ name: "Eyes", value: "Big" }],
      }),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(names.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(values.result.current.isSuccess).toBe(true));
    expect(names.result.current.data).toEqual([{ traitName: "Background", valueCount: 2 }]);
    expect(values.result.current.data).toEqual([
      { traitValue: "Blue", count: 5 }, { traitValue: "Red", count: 3 },
    ]);
    expect(api.traits).toHaveBeenCalledWith(felt("4"), {
      traitName: "Background",
      otherTraits: [{ name: "Eyes", values: ["Big"] }],
    });
  });
});
