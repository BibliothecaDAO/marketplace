export type MarketplaceOrderIdentity = {
  orderId: string;
  collection: string;
  tokenId: string;
};

function canonicalDecimal(value: string): string {
  try {
    return BigInt(value).toString(10);
  } catch {
    return value.trim().toLowerCase();
  }
}

function canonicalFelt(value: string): string {
  try {
    return `0x${BigInt(value).toString(16)}`;
  } catch {
    return value.trim().toLowerCase();
  }
}

/**
 * Stable client-side identity for an Arcade order model row. Order ids are not
 * globally unique across every collection/token key in the retained contract.
 */
export function marketplaceOrderIdentityKey(
  identity: MarketplaceOrderIdentity,
): string {
  return [
    canonicalDecimal(identity.orderId),
    canonicalFelt(identity.collection),
    canonicalDecimal(identity.tokenId),
  ].join(":");
}
