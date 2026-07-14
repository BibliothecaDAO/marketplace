import { afterEach, describe, expect, it, vi } from "vitest";
import { MarketplaceApiClient, MarketplaceApiError } from "@/lib/marketplace/api-client";

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

describe("owned marketplace API client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("invokes the native fetch implementation with its global receiver", async () => {
    const receivers: unknown[] = [];
    const browserFetch = function (this: unknown) {
      receivers.push(this);
      if (this !== globalThis) {
        throw new TypeError("Illegal invocation");
      }
      return Promise.resolve(Response.json({ data: [], meta }));
    } as typeof fetch;
    vi.stubGlobal("fetch", browserFetch);

    const client = new MarketplaceApiClient({
      baseUrl: "https://market.example",
      chain: "SN_MAIN",
    });

    await expect(client.collections()).resolves.toMatchObject({ data: [] });
    expect(receivers).toEqual([globalThis]);
  });

  it("normalizes query parameters and validates the shared response schema", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        data: { items: [], nextCursor: null },
        meta,
      }),
    );
    const client = new MarketplaceApiClient({
      baseUrl: "https://market.example/",
      chain: "SN_MAIN",
      fetchImpl,
    });

    const response = await client.tokens("0xabc", {
      currency: "0xdef",
      cursor: "cursor/value",
      limit: 24,
      sort: "price-asc",
      tokenIds: ["0x2a", "43"],
      traits: [{ name: "Resource", values: ["Gold", "Silver"] }],
    });

    expect(response.meta.lagBlocks).toBe(1);
    const url = new URL(String(fetchImpl.mock.calls[0]?.[0]));
    expect(url.pathname).toBe("/v1/chains/SN_MAIN/collections/0xabc/tokens");
    expect(url.searchParams.get("currency")).toBe("0xdef");
    expect(url.searchParams.get("cursor")).toBe("cursor/value");
    expect(url.searchParams.getAll("trait")).toEqual([
      "Resource:Gold",
      "Resource:Silver",
    ]);
    expect(url.searchParams.getAll("tokenId")).toEqual(["42", "43"]);
  });

  it("rejects malformed success payloads before UI code sees them", async () => {
    const client = new MarketplaceApiClient({
      baseUrl: "https://market.example",
      chain: "SN_MAIN",
      fetchImpl: async () => Response.json({ data: { items: [] }, meta }),
    });
    await expect(client.tokens("0xabc", {})).rejects.toMatchObject({
      code: "INVALID_API_RESPONSE",
      retryable: false,
    });
  });

  it("preserves the stable API error and request id", async () => {
    const client = new MarketplaceApiClient({
      baseUrl: "https://market.example",
      chain: "SN_MAIN",
      fetchImpl: async () =>
        Response.json(
          {
            error: {
              code: "INDEXER_BEHIND",
              message: "Indexer is behind.",
              requestId: "req-7",
              retryable: true,
            },
          },
          { status: 503 },
        ),
    });

    await expect(client.book()).rejects.toEqual(
      expect.objectContaining<Partial<MarketplaceApiError>>({
        code: "INDEXER_BEHIND",
        requestId: "req-7",
        retryable: true,
      }),
    );
  });

  it("posts the full tuple identity for at most 25 cart rows", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ data: { orders: [] }, meta }),
    );
    const client = new MarketplaceApiClient({
      baseUrl: "https://market.example",
      chain: "SN_MAIN",
      fetchImpl,
    });
    await client.lookupOrders([
      { id: "7", collection: "0xabc", tokenId: "9" },
    ]);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://market.example/v1/chains/SN_MAIN/orders/lookup",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          orders: [{ id: "7", collection: "0xabc", tokenId: "9" }],
        }),
      }),
    );
    await expect(
      client.lookupOrders(
        Array.from({ length: 26 }, (_, index) => ({
          id: String(index),
          collection: "0xabc",
          tokenId: String(index),
        })),
      ),
    ).rejects.toThrow(/25/);
  });
});
