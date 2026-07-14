import type {
  ApiMeta,
  MarketplaceBook,
  MarketplaceIndexerStatus,
  OrderLookupResult,
} from "@biblio/marketplace-api-contract";

export type CheckoutPreflightItem = {
  orderId: string;
  collection: string;
  tokenId: string;
  price: string;
  currency: string;
  quantity: string;
};

type CheckoutPreflightInput = {
  items: CheckoutPreflightItem[];
  lookup: OrderLookupResult[];
  lookupMeta: ApiMeta;
  book: MarketplaceBook;
  indexer: MarketplaceIndexerStatus;
  expectedWorldAddress: string;
  expectedMarketplaceAddress: string;
  accountAddress: string;
  nowEpochSeconds?: number;
};

export type CheckoutPreflightResult = {
  safe: boolean;
  globalError: string | null;
  rowErrors: Record<string, string>;
};

function feltEqual(left: string, right: string): boolean {
  try {
    return BigInt(left) === BigInt(right);
  } catch {
    return left.toLowerCase() === right.toLowerCase();
  }
}

function key(item: CheckoutPreflightItem): string {
  return `${BigInt(item.orderId)}:${BigInt(item.collection)}:${BigInt(item.tokenId)}`;
}

function lookupKey(result: OrderLookupResult): string {
  return `${BigInt(result.key.id)}:${BigInt(result.key.collection)}:${BigInt(result.key.tokenId)}`;
}

export function evaluateCheckoutPreflight(
  input: CheckoutPreflightInput,
): CheckoutPreflightResult {
  const globalError = (() => {
    if (
      !feltEqual(input.lookupMeta.worldAddress, input.expectedWorldAddress) ||
      !feltEqual(input.lookupMeta.marketplaceAddress, input.expectedMarketplaceAddress)
    ) {
      return "Marketplace contract identity does not match the checked-in registry.";
    }
    if (input.lookupMeta.finality !== "accepted_l2" || input.indexer.finality !== "accepted_l2") {
      return "Marketplace reads do not have accepted L2 finality.";
    }
    if (input.lookupMeta.lagBlocks > 2 || input.indexer.lagBlocks > 2) {
      return "Marketplace indexer is behind the two-block checkout safety window.";
    }
    if (!input.indexer.safeForCheckout) {
      return "Marketplace indexer reports checkout as unsafe.";
    }
    if (input.book.paused) {
      return "Marketplace Book is paused.";
    }
    return null;
  })();
  if (globalError) return { safe: false, globalError, rowErrors: {} };

  const byKey = new Map(input.lookup.map((result) => [lookupKey(result), result]));
  const now = input.nowEpochSeconds ?? Math.floor(Date.now() / 1000);
  const rowErrors: Record<string, string> = {};
  for (const item of input.items) {
    const result = byKey.get(key(item));
    const order = result?.order;
    if (!order) {
      rowErrors[item.orderId] = "Listing is stale or unavailable.";
      continue;
    }
    if (
      order.id !== BigInt(item.orderId).toString() ||
      !feltEqual(order.collection, item.collection) ||
      order.tokenId !== BigInt(item.tokenId).toString()
    ) {
      rowErrors[item.orderId] = "Listing identity changed.";
      continue;
    }
    if (order.status !== "placed" || order.category !== "sell") {
      rowErrors[item.orderId] = "Listing is not placed.";
      continue;
    }
    if (BigInt(order.expiration) <= BigInt(now)) {
      rowErrors[item.orderId] = "Listing has expired.";
      continue;
    }
    if (feltEqual(order.owner, input.accountAddress)) {
      rowErrors[item.orderId] = "Cannot buy your own listing.";
      continue;
    }
    if (
      order.unitPriceAtomic !== BigInt(item.price).toString() ||
      order.remainingQuantity !== BigInt(item.quantity).toString() ||
      !feltEqual(order.currency, item.currency)
    ) {
      rowErrors[item.orderId] = "Listing terms changed after it was added to the cart.";
    }
  }
  return {
    safe: Object.keys(rowErrors).length === 0,
    globalError: null,
    rowErrors,
  };
}
