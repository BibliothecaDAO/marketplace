import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NormalizedToken } from "@cartridge/arcade/marketplace";
import { useHomePageData } from "@/features/home/use-home-page-data";

const {
  mockGetConfig,
  mockUseCollectionQuery,
  mockUseCollectionTokensQuery,
  mockUseCollectionListingsQuery,
} = vi.hoisted(() => ({
  mockGetConfig: vi.fn(),
  mockUseCollectionQuery: vi.fn(),
  mockUseCollectionTokensQuery: vi.fn(),
  mockUseCollectionListingsQuery: vi.fn(),
}));

vi.mock("@/lib/marketplace/config", () => ({
  getMarketplaceRuntimeConfig: mockGetConfig,
}));

vi.mock("@/lib/marketplace/hooks", () => ({
  useCollectionQuery: mockUseCollectionQuery,
  useCollectionTokensQuery: mockUseCollectionTokensQuery,
  useCollectionListingsQuery: mockUseCollectionListingsQuery,
}));

function token(tokenId: string): NormalizedToken {
  return {
    token_id: tokenId,
    metadata: { name: `Token #${tokenId}` },
  } as NormalizedToken;
}

function successQuery<T>(data: T) {
  return {
    data,
    isLoading: false,
    isSuccess: true,
    isError: false,
    error: null,
    isFetching: false,
    refetch: vi.fn(),
  };
}

describe("useHomePageData", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockGetConfig.mockReset();
    mockUseCollectionQuery.mockReset();
    mockUseCollectionTokensQuery.mockReset();
    mockUseCollectionListingsQuery.mockReset();

    mockGetConfig.mockReturnValue({
      chainLabel: "SN_MAIN",
      sdkConfig: { chainId: "0x534e5f4d41494e" },
      collections: [
        { address: "0xabc", name: "Genesis", projectId: "genesis" },
        { address: "0xdef", name: "Artifacts", projectId: "artifacts" },
      ],
      warnings: [],
    });

    mockUseCollectionQuery.mockReturnValue(
      successQuery({
        metadata: {
          name: "Genesis",
          image: "https://cdn.example/genesis.png",
        },
        totalSupply: "120",
      }),
    );

    mockUseCollectionTokensQuery.mockReturnValue(
      successQuery({
        page: {
          tokens: [token("1"), token("2")],
        },
      }),
    );

    mockUseCollectionListingsQuery.mockReturnValue(
      successQuery([
        {
          id: "11",
          tokenId: "1",
          price: "100",
          currency: "0xfee",
          quantity: "1",
          status: "placed",
        },
        {
          id: "12",
          tokenId: "2",
          price: "250",
          currency: "0xfee",
          quantity: "1",
          status: "placed",
        },
      ]),
    );
  });

  it("returns_featured_collection_from_config", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.01);

    const { result } = renderHook(() => useHomePageData());

    expect(result.current.featuredCollection).toEqual(
      expect.objectContaining({
        address: "0xabc",
        name: "Genesis",
      }),
    );
  });

  it("returns_trending_tokens_from_listings", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.01);

    const { result } = renderHook(() => useHomePageData());

    expect(result.current.trendingTokens).toHaveLength(2);
    expect(result.current.trendingTokens[0]).toEqual(
      expect.objectContaining({
        href: "/collections/0xabc/1",
        price: "100",
      }),
    );
  });

  it("fetches_tokens_only_for_the_featured_collection_on_initial_load", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.01);

    renderHook(() => useHomePageData());

    expect(mockUseCollectionTokensQuery).toHaveBeenCalledTimes(1);
    expect(mockUseCollectionTokensQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        address: "0xabc",
        project: "genesis",
        limit: 12,
        fetchImages: true,
      }),
    );
  });

  it("preserves_raw_token_id_in_trending_href_for_hex_tokens", () => {
    mockUseCollectionTokensQuery.mockReturnValue(
      successQuery({
        page: {
          tokens: [token("0x000000000000000000000000000000000000000000000000000000000000000a")],
        },
      }),
    );
    mockUseCollectionListingsQuery.mockReturnValue(
      successQuery([
        {
          id: "11",
          tokenId: "10",
          price: "100",
          currency: "0xfee",
          quantity: "1",
          status: "placed",
        },
      ]),
    );
    vi.spyOn(Math, "random").mockReturnValue(0.01);

    const { result } = renderHook(() => useHomePageData());

    expect(result.current.trendingTokens[0]).toEqual(
      expect.objectContaining({
        href: "/collections/0xabc/0x000000000000000000000000000000000000000000000000000000000000000a",
      }),
    );
  });

  it("returns_isLoading_while_queries_pending", () => {
    mockUseCollectionTokensQuery.mockReturnValue(
      {
        ...successQuery({ page: { tokens: [] } }),
        isLoading: true,
      },
    );

    const { result } = renderHook(() => useHomePageData());

    expect(result.current.isLoading).toBe(true);
  });

  it("returns_sidebar_collections_from_config", () => {
    const { result } = renderHook(() => useHomePageData());

    expect(result.current.sidebarCollections).toEqual([
      expect.objectContaining({ address: "0xabc", name: "Genesis" }),
      expect.objectContaining({ address: "0xdef", name: "Artifacts" }),
    ]);
  });

  it("returns_collection_cards_from_config", () => {
    const { result } = renderHook(() => useHomePageData());

    expect(result.current.collectionCards).toEqual([
      expect.objectContaining({ address: "0xabc", name: "Genesis" }),
      expect.objectContaining({ address: "0xdef", name: "Artifacts" }),
    ]);
  });

  it("uses_unverified_listing_reads_for_browse_data", () => {
    renderHook(() => useHomePageData());

    expect(mockUseCollectionListingsQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: expect.any(String),
        limit: 100,
        verifyOwnership: false,
      }),
    );
  });

  it("handles_empty_config", () => {
    mockGetConfig.mockReturnValue({
      chainLabel: "SN_MAIN",
      sdkConfig: { chainId: "0x534e5f4d41494e" },
      collections: [],
      warnings: [],
    });

    const { result } = renderHook(() => useHomePageData());

    expect(result.current.featuredCollection).toBeNull();
    expect(result.current.trendingTokens).toEqual([]);
    expect(result.current.sidebarCollections).toEqual([]);
    expect(result.current.collectionCards).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it("selects_random_featured_collection", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);

    const { result } = renderHook(() => useHomePageData());

    expect(result.current.featuredCollection).toEqual(
      expect.objectContaining({
        address: "0xdef",
      }),
    );
    expect(mockUseCollectionQuery).toHaveBeenCalledWith(
      expect.objectContaining({ address: "0xdef" }),
    );
  });

  it("falls_back_to_featured_token_image_when_collection_metadata_image_is_missing", () => {
    mockUseCollectionQuery.mockReturnValue(
      successQuery({
        metadata: {
          name: "Genesis",
        },
        totalSupply: "120",
      }),
    );
    mockUseCollectionTokensQuery.mockReturnValue(
      successQuery({
        page: {
          tokens: [
            {
              token_id: "1",
              image: "https://cdn.example/featured-token.png",
              metadata: { name: "Token #1" },
            },
          ],
        },
      }),
    );
    vi.spyOn(Math, "random").mockReturnValue(0.01);

    const { result } = renderHook(() => useHomePageData());

    expect(result.current.featuredCollection?.imageUrl).toBe(
      "https://cdn.example/featured-token.png",
    );
  });
});
