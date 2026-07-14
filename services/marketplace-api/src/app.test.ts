import { describe, expect, it } from "vitest";
import { buildApp } from "./app.js";

describe("marketplace API", () => {
  it("exposes liveness without depending on Torii", async () => {
    const app = await buildApp({
      allowedOrigins: ["https://market.realms.world"],
      repository: {
        getIndexerStatus: async () => {
          throw new Error("Torii is unavailable");
        },
      },
    });

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok", service: "marketplace-api" });
    await app.close();
  });

  it("reports ready only when every configured chain is within the safety lag", async () => {
    const app = await buildApp({
      allowedOrigins: [],
      repository: {
        getIndexerStatus: async (chain) => ({
          chain,
          indexedBlock: chain === "SN_MAIN" ? 500 : 700,
          indexedBlockHash: `0x${"1".padStart(64, "0")}`,
          chainHead: chain === "SN_MAIN" ? 502 : 701,
          observedAt: "2026-07-14T00:00:00.000Z",
        }),
      },
    });

    const response = await app.inject({ method: "GET", url: "/ready" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "ready",
      chains: [
        { chain: "SN_MAIN", indexedBlock: 500, chainHead: 502, lagBlocks: 2 },
        { chain: "SN_SEPOLIA", indexedBlock: 700, chainHead: 701, lagBlocks: 1 },
      ],
    });
    await app.close();
  });

  it("fails readiness closed when an indexer is more than two blocks behind", async () => {
    const app = await buildApp({
      allowedOrigins: [],
      repository: {
        getIndexerStatus: async (chain) => ({
          chain,
          indexedBlock: 500,
          indexedBlockHash: `0x${"1".padStart(64, "0")}`,
          chainHead: chain === "SN_MAIN" ? 503 : 501,
          observedAt: "2026-07-14T00:00:00.000Z",
        }),
      },
    });

    const response = await app.inject({ method: "GET", url: "/ready" });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      error: {
        code: "INDEXER_LAGGING",
        message: "Marketplace indexer is outside the two-block safety window.",
        requestId: expect.any(String),
        retryable: true,
        details: {
          chains: [
            { chain: "SN_MAIN", indexedBlock: 500, chainHead: 503, lagBlocks: 3 },
            { chain: "SN_SEPOLIA", indexedBlock: 500, chainHead: 501, lagBlocks: 1 },
          ],
        },
      },
    });
    await app.close();
  });

  it("serves owned collection summaries with index freshness metadata", async () => {
    const collectionAddress = `0x${"2".padStart(64, "0")}`;
    const worldAddress = `0x${"a".padStart(64, "0")}`;
    const marketplaceAddress = `0x${"b".padStart(64, "0")}`;
    const app = await buildApp({
      allowedOrigins: [],
      registry: {
        schemaVersion: "1.0.0",
        chains: {
          SN_MAIN: {
            chainId: "0x534e5f4d41494e",
            world: { address: worldAddress, classHash: `0x${"c".padStart(64, "0")}`, startBlock: 10 },
            marketplace: {
              address: marketplaceAddress,
              classHash: `0x${"d".padStart(64, "0")}`,
              startBlock: 12,
            },
            currencies: [
              { address: `0x${"1".padStart(64, "0")}`, symbol: "STRK", decimals: 18, icon: "/strk.svg" },
            ],
            collections: [
              {
                address: collectionAddress,
                name: "Genesis",
                standard: "ERC721",
                startBlock: 1,
                metadata: { enabled: true },
              },
            ],
          },
        },
      },
      repository: {
        getIndexerStatus: async (chain) => ({
          chain,
          indexedBlock: 500,
          indexedBlockHash: `0x${"e".padStart(64, "0")}`,
          chainHead: 501,
          observedAt: "2026-07-14T00:00:00.000Z",
        }),
        listCollections: async () => [
          {
            address: collectionAddress,
            name: "Genesis",
            standard: "ERC721",
            deploymentBlock: 1,
            verified: true,
            tokenCount: "8000",
            listingCount: "42",
            floorByCurrency: [
              {
                currency: `0x${"1".padStart(64, "0")}`,
                symbol: "STRK",
                unitPriceAtomic: "1000000000000000000",
              },
            ],
          },
        ],
      },
    });

    const response = await app.inject({
      method: "GET",
      url: "/v1/chains/SN_MAIN/collections",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe(
      "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
    );
    expect(response.json()).toEqual({
      data: [
        expect.objectContaining({
          address: collectionAddress,
          name: "Genesis",
          tokenCount: "8000",
          listingCount: "42",
        }),
      ],
      meta: {
        schemaVersion: "1.0.0",
        chain: "SN_MAIN",
        chainId: "0x534e5f4d41494e",
        worldAddress,
        marketplaceAddress,
        indexedBlock: 500,
        indexedBlockHash: `0x${"e".padStart(64, "0")}`,
        chainHead: 501,
        lagBlocks: 1,
        finality: "accepted_l2",
        observedAt: "2026-07-14T00:00:00.000Z",
      },
    });
    await app.close();
  });

  it("batch-refreshes cart orders by canonical full key without caching", async () => {
    const felt = (value: string) => `0x${value.padStart(64, "0")}`;
    const order = {
      id: "2312",
      collection: felt("2"),
      tokenId: "42",
      category: "sell" as const,
      categoryRaw: 1,
      status: "placed" as const,
      statusRaw: 1,
      owner: felt("3"),
      currency: felt("1"),
      unitPriceAtomic: "100",
      quantity: "0",
      remainingQuantity: "0",
      expiration: "2000000000",
      royaltiesEnabled: true,
      royaltyTerms: { enabled: true, receiver: null, amountAtomic: null, source: "order" as const },
      createdAt: {
        blockNumber: 100,
        transactionHash: felt("4"),
        transactionIndex: 0,
        eventIndex: 0,
        caller: felt("3"),
      },
      updatedAt: {
        blockNumber: 100,
        transactionHash: felt("4"),
        transactionIndex: 0,
        eventIndex: 0,
        caller: felt("3"),
      },
    };
    const app = await buildApp({
      allowedOrigins: [],
      registry: {
        schemaVersion: "1.0.0",
        chains: {
          SN_MAIN: {
            chainId: "0x534e5f4d41494e",
            world: { address: felt("a"), classHash: felt("b"), startBlock: 10 },
            marketplace: { address: felt("c"), classHash: felt("d"), startBlock: 12 },
            currencies: [
              { address: felt("1"), symbol: "STRK", decimals: 18, icon: "/strk.svg" },
            ],
            collections: [],
          },
        },
      },
      repository: {
        getIndexerStatus: async (chain) => ({
          chain,
          indexedBlock: 500,
          indexedBlockHash: felt("e"),
          chainHead: 501,
          observedAt: "2026-07-14T00:00:00.000Z",
        }),
        lookupOrders: async (_chain, keys) =>
          keys.map((key) => ({
            key,
            order:
              key.id === order.id &&
              key.collection === order.collection &&
              key.tokenId === order.tokenId
                ? order
                : null,
          })),
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/chains/SN_MAIN/orders/lookup",
      payload: { orders: [{ id: "2312", collection: "0x2", tokenId: "42" }] },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.json().data).toEqual({
      orders: [{ key: { id: "2312", collection: felt("2"), tokenId: "42" }, order }],
    });
    await app.close();
  });

  it("blocks cart refresh when indexed order data is outside the safety window", async () => {
    const felt = (value: string) => `0x${value.padStart(64, "0")}`;
    const app = await buildApp({
      allowedOrigins: [],
      registry: {
        schemaVersion: "1.0.0",
        chains: {
          SN_MAIN: {
            chainId: "0x534e5f4d41494e",
            world: { address: felt("a"), classHash: felt("b"), startBlock: 10 },
            marketplace: { address: felt("c"), classHash: felt("d"), startBlock: 12 },
            currencies: [
              { address: felt("1"), symbol: "STRK", decimals: 18, icon: "/strk.svg" },
            ],
            collections: [],
          },
        },
      },
      repository: {
        getIndexerStatus: async (chain) => ({
          chain,
          indexedBlock: 500,
          indexedBlockHash: felt("e"),
          chainHead: 503,
          observedAt: "2026-07-14T00:00:00.000Z",
        }),
        lookupOrders: async () => [],
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/chains/SN_MAIN/orders/lookup",
      payload: { orders: [{ id: "1", collection: "0x2", tokenId: "42" }] },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json().error).toEqual(
      expect.objectContaining({ code: "INDEXER_LAGGING", retryable: true }),
    );
    await app.close();
  });

  it("returns validation and not-found failures in the stable API error shape", async () => {
    const felt = (value: string) => `0x${value.padStart(64, "0")}`;
    const app = await buildApp({
      allowedOrigins: [],
      registry: {
        schemaVersion: "1.0.0",
        chains: {
          SN_MAIN: {
            chainId: "0x534e5f4d41494e",
            world: { address: felt("a"), classHash: felt("b"), startBlock: 10 },
            marketplace: { address: felt("c"), classHash: felt("d"), startBlock: 12 },
            currencies: [
              { address: felt("1"), symbol: "STRK", decimals: 18, icon: "/strk.svg" },
            ],
            collections: [],
          },
        },
      },
      repository: {
        getIndexerStatus: async (chain) => ({
          chain,
          indexedBlock: 500,
          indexedBlockHash: felt("e"),
          chainHead: 501,
          observedAt: "2026-07-14T00:00:00.000Z",
        }),
        getToken: async () => null,
      },
    });

    const invalid = await app.inject({
      method: "GET",
      url: "/v1/chains/SN_MAIN/tokens/not-a-felt/42",
      headers: { "x-request-id": "validation-request" },
    });
    const missing = await app.inject({
      method: "GET",
      url: "/v1/chains/SN_MAIN/tokens/0x2/42",
      headers: { "x-request-id": "missing-request" },
    });

    expect(invalid.statusCode).toBe(400);
    expect(invalid.json()).toEqual({
      error: {
        code: "INVALID_REQUEST",
        message: "Request validation failed.",
        requestId: "validation-request",
        retryable: false,
        details: expect.any(Array),
      },
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toEqual({
      error: {
        code: "TOKEN_NOT_FOUND",
        message: "Marketplace token was not found.",
        requestId: "missing-request",
        retryable: false,
      },
    });
    expect(missing.headers["x-request-id"]).toBe("missing-request");
    await app.close();
  });

  it("generates OpenAPI from the runtime route schemas", async () => {
    const app = await buildApp({
      allowedOrigins: [],
      repository: {
        getIndexerStatus: async (chain) => ({
          chain,
          indexedBlock: 0,
          indexedBlockHash: `0x${"0".repeat(64)}`,
          chainHead: 0,
          observedAt: "2026-07-14T00:00:00.000Z",
        }),
      },
    });

    const response = await app.inject({ method: "GET", url: "/openapi.json" });

    expect(response.statusCode).toBe(200);
    expect(response.json().paths).toEqual(
      expect.objectContaining({
        "/v1/chains/{chain}/collections/{collection}/tokens": expect.any(Object),
        "/v1/chains/{chain}/orders/lookup": expect.any(Object),
      }),
    );
    expect(response.headers["cache-control"]).toBe("public, max-age=300");
    await app.close();
  });
});
