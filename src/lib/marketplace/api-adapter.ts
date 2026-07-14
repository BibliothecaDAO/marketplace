import type {
  CollectionSummary,
  MarketplaceHolding,
  MarketplaceOrder,
  MarketplaceToken,
} from "@biblio/marketplace-api-contract";
import type {
  MarketplaceCollection,
  MarketplaceOrderCompat,
  NormalizedToken,
  TokenBalanceCompat,
} from "@/lib/marketplace/types";

function titleCase(value: string): string {
  if (!value) return value;
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

export function tokenFromApi(token: MarketplaceToken): NormalizedToken {
  const rawMetadata =
    token.rawMetadata && typeof token.rawMetadata === "object" && !Array.isArray(token.rawMetadata)
      ? token.rawMetadata as Record<string, unknown>
      : {};
  const selectedFloor = token.floorByCurrency[0];
  return {
    contract_address: token.collection,
    token_id: token.tokenId,
    metadata: {
      ...rawMetadata,
      name: token.name,
      ...(token.description === null ? {} : { description: token.description }),
      ...(token.image === null ? {} : { image: token.image }),
      attributes: token.attributes.map((attribute) => ({
        trait_type: attribute.traitName,
        value: attribute.value,
        ...(attribute.displayType ? { display_type: attribute.displayType } : {}),
      })),
    },
    total_supply: token.balance,
    ...(token.image === null ? {} : { image: token.image }),
    owner: token.owner,
    first_seen_block: token.firstSeenBlock,
    best_listing: token.bestListing ? orderFromApi(token.bestListing) : null,
    ...(selectedFloor
      ? { price: selectedFloor.unitPriceAtomic, currency: selectedFloor.currency }
      : {}),
  };
}

export function orderFromApi(order: MarketplaceOrder): MarketplaceOrderCompat {
  return {
    id: order.id,
    collection: order.collection,
    tokenId: order.tokenId,
    token_id: order.tokenId,
    category: titleCase(order.category),
    categoryRaw: order.categoryRaw,
    status: titleCase(order.status),
    statusRaw: order.statusRaw,
    owner: order.owner,
    currency: order.currency,
    price: order.unitPriceAtomic,
    unitPriceAtomic: order.unitPriceAtomic,
    quantity: order.remainingQuantity,
    originalQuantity: order.quantity,
    remainingQuantity: order.remainingQuantity,
    expiration: order.expiration,
    royalties: order.royaltiesEnabled,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

export function collectionFromApi(collection: CollectionSummary): MarketplaceCollection {
  return {
    address: collection.address,
    metadata: {
      ...(collection.rawMetadata && typeof collection.rawMetadata === "object"
        ? collection.rawMetadata as Record<string, unknown>
        : {}),
      name: collection.name,
      ...(collection.description == null ? {} : { description: collection.description }),
      ...(collection.image == null ? {} : { image: collection.image }),
      ...(collection.bannerImage == null ? {} : { banner_image: collection.bannerImage }),
    },
    totalSupply: collection.tokenCount,
    listingCount: collection.listingCount,
    floorByCurrency: collection.floorByCurrency,
  };
}

export function holdingBalanceFromApi(holding: MarketplaceHolding): TokenBalanceCompat {
  return {
    account_address: holding.account,
    contract_address: holding.collection,
    token_id: holding.tokenId,
    balance: holding.balance,
    token: tokenFromApi(holding.token),
  };
}
