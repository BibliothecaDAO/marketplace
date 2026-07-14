import { describe, expect, it } from "vitest";
import type {
  ApiMeta,
  MarketplaceBook,
  MarketplaceIndexerStatus,
  MarketplaceOrder,
  OrderLookupResult,
} from "@biblio/marketplace-api-contract";
import { evaluateCheckoutPreflight } from "./checkout-preflight";
import { marketplaceOrderIdentityKey } from "@/lib/marketplace/order-identity";

const felt = (digit: string) => `0x${digit.repeat(64)}`;
const provenance = {
  blockNumber: 10, transactionHash: felt("a"), transactionIndex: 0,
  eventIndex: 0, caller: felt("b"),
};
const order: MarketplaceOrder = {
  id: "7", collection: felt("1"), tokenId: "42", category: "sell", categoryRaw: 2,
  status: "placed", statusRaw: 1, owner: felt("2"), currency: felt("3"),
  unitPriceAtomic: "100", quantity: "1", remainingQuantity: "1",
  expiration: "2000000000", royaltiesEnabled: true,
  royaltyTerms: { enabled: true, receiver: null, amountAtomic: null, source: "order" },
  createdAt: provenance, updatedAt: provenance,
};
const meta: ApiMeta = {
  schemaVersion: "1.0.0", chain: "SN_MAIN", chainId: "0x00000000000000000000000000000000000000000000000000534e5f4d41494e",
  worldAddress: felt("4"), marketplaceAddress: felt("5"), indexedBlock: 100,
  indexedBlockHash: felt("6"), chainHead: 101, lagBlocks: 1,
  finality: "accepted_l2", observedAt: "2026-07-14T00:00:00.000Z",
};
const book: MarketplaceBook = {
  id: "0", version: "1", paused: false, royaltiesEnabled: true, counter: "8",
  feeNumerator: "250", feeDenominator: "10000", feeReceiver: felt("7"),
  updatedAt: provenance,
  history: [],
};
const indexer: MarketplaceIndexerStatus = {
  buildVersion: "1", replayVersion: "1", databaseSchemaVersion: "1",
  indexedBlock: 100, indexedBlockHash: felt("6"), chainHead: 101, lagBlocks: 1,
  finality: "accepted_l2", metadataFailures: 0, safeForCheckout: true,
};
const cart = [{
  orderId: "7", collection: felt("1"), tokenId: "42", price: "100",
  currency: felt("3"), quantity: "1",
}];
const lookup: OrderLookupResult[] = [{
  key: { id: "7", collection: felt("1"), tokenId: "42" }, order,
}];
const cartKey = marketplaceOrderIdentityKey(cart[0]!);

describe("owned checkout preflight", () => {
  it("accepts only exact tuple identity and unchanged placed terms", () => {
    expect(evaluateCheckoutPreflight({
      items: cart, lookup, lookupMeta: meta, book, indexer,
      expectedWorldAddress: felt("4"), expectedMarketplaceAddress: felt("5"),
      accountAddress: felt("8"), nowEpochSeconds: 1_900_000_000,
    })).toEqual({ safe: true, globalError: null, rowErrors: {} });
  });

  it.each([
    ["lag", { lookupMeta: { ...meta, lagBlocks: 3 } }, /behind/i],
    ["pause", { book: { ...book, paused: true } }, /paused/i],
    ["identity", { lookupMeta: { ...meta, marketplaceAddress: felt("9") } }, /identity/i],
    ["unsafe status", { indexer: { ...indexer, safeForCheckout: false } }, /unsafe/i],
  ])("fails closed on global %s safety gate", (_name, override, message) => {
    const result = evaluateCheckoutPreflight({
      items: cart, lookup, lookupMeta: meta, book, indexer,
      expectedWorldAddress: felt("4"), expectedMarketplaceAddress: felt("5"),
      accountAddress: felt("8"), nowEpochSeconds: 1_900_000_000,
      ...override,
    });
    expect(result.safe).toBe(false);
    expect(result.globalError).toMatch(message);
  });

  it("reports missing, changed, non-placed, expired, and own orders inline", () => {
    const cases: Array<[OrderLookupResult["order"], RegExp]> = [
      [null, /unavailable/i],
      [{ ...order, unitPriceAtomic: "101" }, /terms changed/i],
      [{ ...order, status: "cancelled", statusRaw: 2 }, /not placed/i],
      [{ ...order, expiration: "1800000000" }, /expired/i],
      [{ ...order, owner: felt("8") }, /own listing/i],
    ];
    for (const [candidate, message] of cases) {
      const result = evaluateCheckoutPreflight({
        items: cart,
        lookup: [{ ...lookup[0], order: candidate }],
        lookupMeta: meta, book, indexer,
        expectedWorldAddress: felt("4"), expectedMarketplaceAddress: felt("5"),
        accountAddress: felt("8"), nowEpochSeconds: 1_900_000_000,
      });
      expect(result.safe).toBe(false);
      expect(result.rowErrors[cartKey]).toMatch(message);
    }
  });
});
