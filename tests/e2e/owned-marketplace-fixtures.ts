import type {
  ApiMeta,
  CollectionSummary,
  MarketplaceActivity,
  MarketplaceBook,
  MarketplaceHolding,
  MarketplaceIndexerStatus,
  MarketplaceOrder,
  MarketplaceToken,
  TraitFacet,
} from "@biblio/marketplace-api-contract";

export const E2E_API_BASE_URL = "http://127.0.0.1:3401";
export const E2E_COLLECTION =
  "0x07ae27a31bb6526e3de9cf02f081f6ce0615ac12a6d7b85ee58b8ad7947a2809";
export const E2E_WORLD =
  "0x07a079295990e43441a7389fdc3b9ba063c6cd6aee16fb846f598c42a9f04ff7";
export const E2E_MARKETPLACE =
  "0x06bbf16b6c67b1bef27a187b499b2f3a14af31646c2c90d64f11b9087c3f527c";
export const E2E_STRK =
  "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";
export const E2E_LORDS =
  "0x0124aeb495b947201f5fac96fd1138e326ad86195b98df6dec9009158a533b49";

function felt(value: string): string {
  return `0x${value.replace(/^0x/, "").toLowerCase().padStart(64, "0")}`;
}

const provenance = {
  blockNumber: 11_819_899,
  transactionHash: felt("abc"),
  transactionIndex: 2,
  eventIndex: 3,
  caller: felt("123"),
};

export const e2eListing: MarketplaceOrder = {
  id: "42",
  collection: E2E_COLLECTION,
  tokenId: "1",
  category: "sell",
  categoryRaw: 2,
  status: "placed",
  statusRaw: 1,
  owner: felt("456"),
  currency: E2E_STRK,
  unitPriceAtomic: "1000000000000000000",
  quantity: "1",
  remainingQuantity: "1",
  expiration: "4102444800",
  royaltiesEnabled: false,
  royaltyTerms: {
    enabled: false,
    receiver: null,
    amountAtomic: null,
    source: "order",
  },
  createdAt: provenance,
  updatedAt: provenance,
};

const token: MarketplaceToken = {
  collection: E2E_COLLECTION,
  tokenId: "1",
  name: "Realm #1",
  description: "A deterministic owned-indexer fixture.",
  image: null,
  owner: felt("456"),
  balance: "1",
  firstSeenBlock: 664_200,
  attributes: [
    { traitName: "Region", value: "North" },
    { traitName: "Level", value: 12 },
  ],
  floorByCurrency: [
    {
      currency: E2E_STRK,
      symbol: "STRK",
      unitPriceAtomic: e2eListing.unitPriceAtomic,
    },
  ],
  bestListing: e2eListing,
  rawMetadata: { name: "Realm #1" },
};

const collection: CollectionSummary = {
  address: E2E_COLLECTION,
  name: "Realms",
  description: "Deterministic collection fixture.",
  image: null,
  bannerImage: null,
  rawMetadata: { name: "Realms" },
  standard: "ERC721",
  deploymentBlock: 664_162,
  verified: true,
  tokenCount: "1",
  listingCount: "1",
  floorByCurrency: token.floorByCurrency,
};

const traits: TraitFacet[] = [
  {
    name: "Region",
    kind: "string",
    values: [
      { value: "North", count: "1" },
      { value: "South", count: "0" },
    ],
  },
  {
    name: "Level",
    kind: "number",
    values: [{ value: 12, count: "1" }],
    min: 1,
    max: 20,
  },
];

const activity: MarketplaceActivity = {
  type: "listing_created",
  typeRaw: "ARCADE-Listing",
  collection: E2E_COLLECTION,
  tokenId: "1",
  orderId: "42",
  from: e2eListing.owner,
  to: null,
  currency: E2E_STRK,
  unitPriceAtomic: e2eListing.unitPriceAtomic,
  quantity: "1",
  provenance,
  rawSource: null,
};

const book: MarketplaceBook = {
  id: "0",
  version: "1",
  paused: false,
  royaltiesEnabled: true,
  counter: "43",
  feeNumerator: "0",
  feeDenominator: "10000",
  feeReceiver: felt("789"),
  updatedAt: provenance,
};

const indexer: MarketplaceIndexerStatus = {
  buildVersion: "e2e-owned-api",
  replayVersion: "e2e-replay",
  databaseSchemaVersion: "20260714010000",
  indexedBlock: 11_819_900,
  indexedBlockHash: felt("beef"),
  chainHead: 11_819_901,
  lagBlocks: 1,
  finality: "accepted_l2",
  metadataFailures: 0,
  safeForCheckout: true,
};

const meta: ApiMeta = {
  schemaVersion: "1.0.0",
  chain: "SN_MAIN",
  chainId: "0x534e5f4d41494e",
  worldAddress: E2E_WORLD,
  marketplaceAddress: E2E_MARKETPLACE,
  indexedBlock: indexer.indexedBlock,
  indexedBlockHash: indexer.indexedBlockHash,
  chainHead: indexer.chainHead,
  lagBlocks: indexer.lagBlocks,
  finality: "accepted_l2",
  observedAt: "2026-07-14T00:00:00.000Z",
};

export type OwnedApiOptions = {
  staleOrderLookup?: boolean;
};

export type OwnedApiResponse = {
  status: number;
  payload: unknown;
};

function envelope(data: unknown): OwnedApiResponse {
  return { status: 200, payload: { data, meta } };
}

export function ownedMarketplaceApiResponse(
  request: { method: string; url: string; body?: unknown },
  options: OwnedApiOptions = {},
): OwnedApiResponse {
  const url = new URL(request.url, E2E_API_BASE_URL);
  const path = url.pathname;

  if (path === "/health") {
    return { status: 200, payload: { status: "ok" } };
  }
  if (path.endsWith("/orders/lookup") && request.method === "POST") {
    const body = request.body as {
      orders?: Array<{ id: string; collection: string; tokenId: string }>;
    } | undefined;
    const orders = body?.orders ?? [];
    return envelope({
      orders: orders.map((key) => ({
        key,
        order: options.staleOrderLookup ? null : e2eListing,
      })),
    });
  }
  if (path.endsWith("/indexer/status")) return envelope(indexer);
  if (path.endsWith("/marketplace/book")) return envelope(book);
  if (path.endsWith("/collections")) return envelope([collection]);
  if (path.includes("/traits")) return envelope(traits);
  if (path.includes("/accounts/") && path.endsWith("/holdings")) {
    const holding: MarketplaceHolding = {
      account: felt("1"),
      collection: E2E_COLLECTION,
      tokenId: "1",
      balance: "1",
      token,
    };
    return envelope({ items: [holding], nextCursor: null });
  }
  if (path.endsWith("/activity")) {
    return envelope({ items: [activity], nextCursor: null });
  }
  if (path.includes("/tokens/") && !path.endsWith("/tokens")) {
    if (url.searchParams.get("currency")?.toLowerCase() === E2E_LORDS.toLowerCase()) {
      const lordsListing: MarketplaceOrder = {
        ...e2eListing,
        currency: E2E_LORDS,
        unitPriceAtomic: "2000000000000000000",
      };
      return envelope({
        ...token,
        floorByCurrency: [{
          currency: E2E_LORDS,
          symbol: "LORDS",
          unitPriceAtomic: lordsListing.unitPriceAtomic,
        }],
        bestListing: lordsListing,
      });
    }
    return envelope(token);
  }
  if (path.endsWith("/tokens")) {
    return envelope({ items: [token], nextCursor: null });
  }
  if (path.endsWith("/orders") || path.endsWith("/listings")) {
    return envelope({ items: [e2eListing], nextCursor: null });
  }
  if (path.includes("/collections/")) return envelope(collection);

  return {
    status: 404,
    payload: {
      error: {
        code: "NOT_FOUND",
        message: `No e2e fixture for ${path}`,
        requestId: "owned-e2e-request",
        retryable: false,
      },
    },
  };
}

export function ownedApiResponseHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "accept,content-type,x-request-id",
    "content-type": "application/json",
    "x-request-id": "owned-e2e-request",
  };
}
