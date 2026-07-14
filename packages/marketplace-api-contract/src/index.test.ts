import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import {
  MarketplaceOrderResponseSchema,
  MarketplaceTokenSchema,
  OrderLookupRequestSchema,
} from "./index.js";

describe("marketplace API contract", () => {
  it("accepts lossless canonical order responses and rejects numeric atomic values", () => {
    const response = {
      data: {
        id: "2312",
        collection: `0x${"a".padStart(64, "0")}`,
        tokenId: "42",
        category: "sell",
        categoryRaw: 1,
        status: "placed",
        statusRaw: 1,
        owner: `0x${"b".padStart(64, "0")}`,
        currency: `0x${"c".padStart(64, "0")}`,
        unitPriceAtomic: "1000000000000000000",
        quantity: "0",
        remainingQuantity: "0",
        expiration: "2000000000",
        royaltiesEnabled: true,
        royaltyTerms: {
          enabled: true,
          receiver: null,
          amountAtomic: null,
          source: "order",
        },
        createdAt: {
          blockNumber: 2407082,
          transactionHash: `0x${"d".padStart(64, "0")}`,
          transactionIndex: 1,
          eventIndex: 2,
          caller: `0x${"b".padStart(64, "0")}`,
        },
        updatedAt: {
          blockNumber: 2407082,
          transactionHash: `0x${"d".padStart(64, "0")}`,
          transactionIndex: 1,
          eventIndex: 2,
          caller: `0x${"b".padStart(64, "0")}`,
        },
      },
      meta: {
        schemaVersion: "1.0.0",
        chain: "SN_MAIN",
        chainId: "0x534e5f4d41494e",
        worldAddress: `0x${"e".padStart(64, "0")}`,
        marketplaceAddress: `0x${"f".padStart(64, "0")}`,
        indexedBlock: 500,
        indexedBlockHash: `0x${"1".padStart(64, "0")}`,
        chainHead: 501,
        lagBlocks: 1,
        finality: "accepted_l2",
        observedAt: "2026-07-14T00:00:00.000Z",
      },
    };

    expect(Value.Check(MarketplaceOrderResponseSchema, response)).toBe(true);
    expect(Value.Check(MarketplaceOrderResponseSchema, {
      ...response,
      data: { ...response.data, royaltyTerms: undefined },
    })).toBe(false);
    expect(
      Value.Check(MarketplaceOrderResponseSchema, {
        ...response,
        data: {
          ...response.data,
          createdAt: { ...response.data.createdAt, caller: undefined },
        },
      }),
    ).toBe(false);
    expect(
      Value.Check(MarketplaceOrderResponseSchema, {
        ...response,
        data: { ...response.data, unitPriceAtomic: 1_000_000_000_000_000_000 },
      }),
    ).toBe(false);
  });

  it("limits cart order lookup to 25 full order keys", () => {
    const key = { id: "1", collection: "0xabc", tokenId: "42" };

    expect(
      Value.Check(OrderLookupRequestSchema, { orders: Array.from({ length: 25 }, () => key) }),
    ).toBe(true);
    expect(
      Value.Check(OrderLookupRequestSchema, { orders: Array.from({ length: 26 }, () => key) }),
    ).toBe(false);
  });

  it("carries the full selected-currency listing identity on token rows", () => {
    const token = {
      collection: `0x${"a".padStart(64, "0")}`,
      tokenId: "42",
      name: "Token #42",
      description: null,
      image: null,
      owner: null,
      balance: "0",
      firstSeenBlock: 1,
      attributes: [],
      floorByCurrency: [],
      bestListing: null,
    };

    expect(Value.Check(MarketplaceTokenSchema, token)).toBe(true);
    expect(Value.Check(MarketplaceTokenSchema, {
      ...token,
      bestListing: undefined,
    })).toBe(false);
  });
});
