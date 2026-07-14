import { describe, expect, it } from "vitest";
import { buildApp } from "./app.js";

const felt = (value: string) => `0x${value.padStart(64, "0")}`;

describe("marketplace read routes", () => {
  it("serves versioned owned assets through the API with restrictive SVG headers", async () => {
    const calls: unknown[] = [];
    const app = await buildApp({
      allowedOrigins: [],
      repository: {
        getIndexerStatus: async (chain) => ({
          chain,
          indexedBlock: 500,
          indexedBlockHash: felt("e"),
          chainHead: 501,
          observedAt: "2026-07-14T00:00:00.000Z",
        }),
      },
      assetSource: {
        getImage: async (...args) => {
          calls.push(args);
          return {
            status: 200 as const,
            body: new TextEncoder().encode("<svg xmlns=\"http://www.w3.org/2000/svg\"/>"),
            contentType: "image/svg+xml",
            etag: "\"content-hash\"",
            lastModified: "Tue, 14 Jul 2026 00:00:00 GMT",
          };
        },
      },
    });

    const response = await app.inject({
      method: "GET",
      url: "/v1/chains/SN_MAIN/assets/0x2/42/image?v=abc123abc123abcd",
      headers: { "if-none-match": "\"old\"" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("image/svg+xml");
    expect(response.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
    expect(response.headers["content-security-policy"]).toContain("default-src 'none'");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.payload).toContain("<svg");
    expect(calls).toEqual([[
      "SN_MAIN",
      felt("2"),
      "42",
      { etag: "\"old\"", modifiedSince: undefined },
    ]]);
    await app.close();
  });

  it("applies global token sorting, currency, traits, and keyset pagination", async () => {
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
        listTokens: async (_chain, collection, options) => {
          if (
            collection !== felt("2") ||
            options.currency !== felt("1") ||
            options.sort !== "price-desc" ||
            options.limit !== 2 ||
            options.traits.join(",") !== "Power:10,Class:Mage"
          ) {
            return { items: [], nextCursor: null };
          }
          return {
            items: [
              {
                collection,
                tokenId: "42",
                name: "Mage #42",
                description: null,
                image: null,
                owner: felt("3"),
                balance: "1",
                firstSeenBlock: 100,
                attributes: [{ traitName: "Power", value: 10 }],
                floorByCurrency: [
                  { currency: felt("1"), symbol: "STRK", unitPriceAtomic: "100" },
                ],
                bestListing: null,
              },
            ],
            nextCursor: "opaque-next-page",
          };
        },
      },
    });

    const response = await app.inject({
      method: "GET",
      url: "/v1/chains/SN_MAIN/collections/0x2/tokens?sort=price-desc&currency=0x1&limit=2&trait=Power%3A10&trait=Class%3AMage",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual({
      items: [expect.objectContaining({ tokenId: "42", name: "Mage #42" })],
      nextCursor: "opaque-next-page",
    });
    expect(response.headers["cache-control"]).toBe(
      "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
    );
    await app.close();
  });

  it("serves only selected-currency active listings with a short safety cache", async () => {
    const order = {
      id: "7",
      collection: felt("2"),
      tokenId: "42",
      royaltiesEnabled: true,
      royaltyTerms: { enabled: true, receiver: null, amountAtomic: null, source: "order" as const },
      category: "sell" as const,
      categoryRaw: 2,
      status: "placed" as const,
      statusRaw: 1,
      expiration: "2000000000",
      quantity: "0",
      remainingQuantity: "0",
      unitPriceAtomic: "100",
      currency: felt("1"),
      owner: felt("3"),
      createdAt: { blockNumber: 100, transactionHash: felt("4"), transactionIndex: 0, eventIndex: 0, caller: felt("3") },
      updatedAt: { blockNumber: 100, transactionHash: felt("4"), transactionIndex: 0, eventIndex: 0, caller: felt("3") },
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
        listOrders: async (_chain, collection, options) => ({
          items:
            collection === felt("2") &&
            options.activeSellOnly &&
            options.currency === felt("1")
              ? [order]
              : [],
          nextCursor: null,
        }),
      },
    });

    const response = await app.inject({
      method: "GET",
      url: "/v1/chains/SN_MAIN/collections/0x2/listings?currency=0x1&limit=2",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.items).toEqual([order]);
    expect(response.headers["cache-control"]).toBe(
      "public, max-age=2, s-maxage=2, must-revalidate",
    );
    await app.close();
  });

  it("serves collection trait facets through the owned read plane", async () => {
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
        listTraits: async (_chain, collection, traitName) =>
          collection === felt("2") && traitName === null
            ? [
                {
                  name: "Power",
                  kind: "number" as const,
                  values: [{ value: 10, count: "12" }],
                  min: 10,
                  max: 10,
                },
              ]
            : [],
      },
    });

    const response = await app.inject({
      method: "GET",
      url: "/v1/chains/SN_MAIN/collections/0x2/traits",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual([
      { name: "Power", kind: "number", values: [{ value: 10, count: "12" }], min: 10, max: 10 },
    ]);
    await app.close();
  });

  it("serves current Book state for checkout safety", async () => {
    const book = {
      id: "1",
      version: "1",
      paused: false,
      royaltiesEnabled: true,
      counter: "2312",
      feeNumerator: "100",
      feeDenominator: "10000",
      feeReceiver: felt("9"),
      updatedAt: {
        blockNumber: 500,
        transactionHash: felt("8"),
        transactionIndex: 1,
        eventIndex: 2,
        caller: felt("9"),
      },
      history: [],
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
        getBook: async () => book,
      },
    });

    const response = await app.inject({
      method: "GET",
      url: "/v1/chains/SN_MAIN/marketplace/book",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual(book);
    expect(response.headers["cache-control"]).toBe(
      "public, max-age=2, s-maxage=2, must-revalidate",
    );
    await app.close();
  });

  it("serves token detail and token activity with route-specific cache policy", async () => {
    const token = {
      collection: felt("2"),
      tokenId: "42",
      name: "Mage #42",
      description: null,
      image: "https://assets.example/mage-42.webp",
      owner: felt("3"),
      balance: "1",
      firstSeenBlock: 100,
      attributes: [{ traitName: "Power", value: 10 }],
      floorByCurrency: [
        { currency: felt("1"), symbol: "STRK", unitPriceAtomic: "100" },
      ],
      bestListing: null,
    };
    const activity = {
      type: "sale" as const,
      typeRaw: "order_executed",
      collection: felt("2"),
      tokenId: "42",
      orderId: "7",
      from: felt("3"),
      to: felt("4"),
      currency: felt("1"),
      unitPriceAtomic: "100",
      quantity: "1",
      provenance: {
        blockNumber: 499,
        transactionHash: felt("8"),
        transactionIndex: 1,
        eventIndex: 2,
        caller: felt("3"),
      },
      rawSource: { eventId: "499:8:2", calldata: [felt("7")] },
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
        getToken: async (_chain, collection, tokenId, currency) =>
          collection === felt("2") && tokenId === "42" && currency === felt("1")
            ? token
            : null,
        listActivity: async (_chain, collection, tokenId, options) => ({
          items:
            collection === felt("2") && tokenId === "42" && options.limit === 24
              ? [activity]
              : [],
          nextCursor: null,
        }),
      },
    });

    const tokenResponse = await app.inject({
      method: "GET",
      url: "/v1/chains/SN_MAIN/tokens/0x2/42?currency=0x1",
    });
    const activityResponse = await app.inject({
      method: "GET",
      url: "/v1/chains/SN_MAIN/tokens/0x2/42/activity",
    });

    expect(tokenResponse.statusCode).toBe(200);
    expect(tokenResponse.json().data).toEqual(token);
    expect(tokenResponse.headers["cache-control"]).toBe(
      "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
    );
    expect(activityResponse.statusCode).toBe(200);
    expect(activityResponse.json().data.items).toEqual([activity]);
    expect(activityResponse.headers["cache-control"]).toBe(
      "public, max-age=10, s-maxage=10, must-revalidate",
    );
    await app.close();
  });

  it("serves account holdings with a 200-row maximum", async () => {
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
        listHoldings: async (_chain, account, collection, options) => ({
          items: [
            {
              account,
              collection: collection ?? felt("2"),
              tokenId: "42",
              balance: "1",
              token: {
                collection: collection ?? felt("2"),
                tokenId: "42",
                name: "Mage #42",
                description: null,
                image: null,
                owner: account,
                balance: "1",
                firstSeenBlock: 100,
                attributes: [],
                floorByCurrency: [],
                bestListing: null,
              },
            },
          ],
          nextCursor: options.limit === 200 ? "next" : null,
        }),
      },
    });

    const response = await app.inject({
      method: "GET",
      url: "/v1/chains/SN_MAIN/accounts/0x9/holdings?collection=0x2&limit=200",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual({
      items: [expect.objectContaining({ account: felt("9"), tokenId: "42" })],
      nextCursor: "next",
    });
    expect(response.headers["cache-control"]).toBe(
      "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
    );
    await app.close();
  });

  it("reports owned indexer diagnostics in the standard response envelope", async () => {
    const app = await buildApp({
      allowedOrigins: [],
      registry: {
        schemaVersion: "1.0.0",
        chains: {
          SN_MAIN: {
            chainId: "0x534e5f4d41494e",
            world: { address: felt("a"), classHash: felt("b"), startBlock: 10 },
            marketplace: { address: felt("c"), classHash: felt("d"), startBlock: 12 },
            currencies: [],
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
        getDetailedIndexerStatus: async () => ({
          buildVersion: "torii-fe3ed0f",
          replayVersion: "replay-2026-07-14",
          databaseSchemaVersion: "torii-1.8.16+marketplace.1",
          indexedBlock: 500,
          indexedBlockHash: felt("e"),
          chainHead: 501,
          lagBlocks: 1,
          finality: "accepted_l2" as const,
          metadataFailures: 3,
          safeForCheckout: true,
        }),
      },
    });

    const response = await app.inject({
      method: "GET",
      url: "/v1/chains/SN_MAIN/indexer/status",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual(
      expect.objectContaining({ lagBlocks: 1, metadataFailures: 3, safeForCheckout: true }),
    );
    expect(response.headers["cache-control"]).toBe("no-store");
    await app.close();
  });
});
