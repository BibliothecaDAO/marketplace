import type { Static, TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import {
  ActivityResponseSchema,
  ApiErrorSchema,
  BookResponseSchema,
  CollectionResponseSchema,
  CollectionsResponseSchema,
  HoldingsResponseSchema,
  IndexerStatusResponseSchema,
  OrderLookupRequestSchema,
  OrderLookupResponseSchema,
  OrdersResponseSchema,
  TokenResponseSchema,
  TokensResponseSchema,
  TraitsResponseSchema,
  type MarketplaceChainAlias,
  type OrderKey,
} from "@biblio/marketplace-api-contract";
import type { CollectionSortMode } from "@/features/collections/collection-query-params";
import { getMarketplaceRuntimeConfig } from "@/lib/marketplace/config";

type TokensResponse = Static<typeof TokensResponseSchema>;
type OrdersResponse = Static<typeof OrdersResponseSchema>;

export class MarketplaceApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly requestId: string,
    readonly retryable: boolean,
    readonly status: number | null,
    readonly details?: unknown,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "MarketplaceApiError";
  }
}

export type TokenQuery = {
  cursor?: string | null;
  limit?: number;
  sort?: CollectionSortMode;
  currency?: string;
  tokenIds?: string[];
  traits?: Array<{ name: string; values: Array<string | number | boolean> }>;
  ranges?: Array<{ name: string; min: number; max: number }>;
};

export type OrderQuery = {
  cursor?: string | null;
  limit?: number;
  currency?: string;
  tokenId?: string;
  category?: "buy" | "sell" | "buy_any";
  status?: "none" | "placed" | "cancelled" | "executed";
};

export type MarketplaceApiClientOptions = {
  baseUrl: string;
  chain: MarketplaceChainAlias;
  fetchImpl?: typeof fetch;
};

function appendIfPresent(
  search: URLSearchParams,
  key: string,
  value: string | number | null | undefined,
) {
  if (value !== undefined && value !== null && value !== "") {
    search.append(key, String(value));
  }
}

function requestId(): string {
  return globalThis.crypto?.randomUUID?.() ??
    `marketplace-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export class MarketplaceApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: MarketplaceApiClientOptions) {
    const baseUrl = options.baseUrl.trim().replace(/\/$/, "");
    if (!/^https?:\/\//.test(baseUrl)) {
      throw new Error("Marketplace API base URL must use http or https.");
    }
    this.baseUrl = baseUrl;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  private path(suffix: string): string {
    return `${this.baseUrl}/v1/chains/${this.options.chain}${suffix}`;
  }

  private async request<T extends TSchema>(
    url: string,
    schema: T,
    init?: RequestInit,
  ): Promise<Static<T>> {
    const localRequestId = requestId();
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        ...init,
        headers: {
          accept: "application/json",
          "x-request-id": localRequestId,
          ...(init?.body ? { "content-type": "application/json" } : {}),
          ...init?.headers,
        },
      });
    } catch (error) {
      throw new MarketplaceApiError(
        "Marketplace API is unreachable.",
        "API_UNREACHABLE",
        localRequestId,
        true,
        null,
        undefined,
        { cause: error },
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      throw new MarketplaceApiError(
        "Marketplace API returned invalid JSON.",
        "INVALID_API_RESPONSE",
        response.headers.get("x-request-id") ?? localRequestId,
        false,
        response.status,
        undefined,
        { cause: error },
      );
    }

    if (!response.ok) {
      if (Value.Check(ApiErrorSchema, payload)) {
        throw new MarketplaceApiError(
          payload.error.message,
          payload.error.code,
          payload.error.requestId,
          payload.error.retryable,
          response.status,
          payload.error.details,
        );
      }
      throw new MarketplaceApiError(
        `Marketplace API returned HTTP ${response.status}.`,
        `HTTP_${response.status}`,
        response.headers.get("x-request-id") ?? localRequestId,
        response.status >= 500 || response.status === 429,
        response.status,
      );
    }

    if (!Value.Check(schema, payload)) {
      const details = [...Value.Errors(schema, payload)].slice(0, 10).map((error) => ({
        path: error.path,
        message: error.message,
      }));
      throw new MarketplaceApiError(
        "Marketplace API response failed schema validation.",
        "INVALID_API_RESPONSE",
        response.headers.get("x-request-id") ?? localRequestId,
        false,
        response.status,
        details,
      );
    }
    return payload;
  }

  collections() {
    return this.request(this.path("/collections"), CollectionsResponseSchema);
  }

  collection(collection: string) {
    return this.request(
      this.path(`/collections/${encodeURIComponent(collection)}`),
      CollectionResponseSchema,
    );
  }

  tokens(collection: string, query: TokenQuery): Promise<TokensResponse> {
    const url = new URL(this.path(`/collections/${encodeURIComponent(collection)}/tokens`));
    appendIfPresent(url.searchParams, "cursor", query.cursor);
    appendIfPresent(url.searchParams, "limit", query.limit);
    appendIfPresent(url.searchParams, "sort", query.sort);
    appendIfPresent(url.searchParams, "currency", query.currency);
    for (const tokenId of new Set(query.tokenIds ?? [])) {
      url.searchParams.append("tokenId", BigInt(tokenId).toString());
    }
    for (const trait of query.traits ?? []) {
      for (const value of trait.values) {
        url.searchParams.append("trait", `${trait.name}:${String(value)}`);
      }
    }
    for (const range of query.ranges ?? []) {
      url.searchParams.append(
        "trait",
        `${range.name}:__range__:${range.min}:${range.max}`,
      );
    }
    return this.request(url.toString(), TokensResponseSchema);
  }

  traits(
    collection: string,
    options?: {
      traitName?: string;
      otherTraits?: Array<{ name: string; values: Array<string | number | boolean> }>;
    },
  ) {
    const suffix = options?.traitName
      ? `/collections/${encodeURIComponent(collection)}/traits/${encodeURIComponent(options.traitName)}`
      : `/collections/${encodeURIComponent(collection)}/traits`;
    const url = new URL(this.path(suffix));
    for (const trait of options?.otherTraits ?? []) {
      for (const value of trait.values) {
        url.searchParams.append("trait", `${trait.name}:${String(value)}`);
      }
    }
    return this.request(url.toString(), TraitsResponseSchema);
  }

  orders(collection: string, query: OrderQuery = {}): Promise<OrdersResponse> {
    return this.orderList(collection, "orders", query);
  }

  listings(collection: string, query: OrderQuery = {}): Promise<OrdersResponse> {
    return this.orderList(collection, "listings", query);
  }

  private orderList(
    collection: string,
    resource: "orders" | "listings",
    query: OrderQuery,
  ): Promise<OrdersResponse> {
    const url = new URL(
      this.path(`/collections/${encodeURIComponent(collection)}/${resource}`),
    );
    appendIfPresent(url.searchParams, "cursor", query.cursor);
    appendIfPresent(url.searchParams, "limit", query.limit);
    appendIfPresent(url.searchParams, "currency", query.currency);
    appendIfPresent(url.searchParams, "tokenId", query.tokenId);
    appendIfPresent(url.searchParams, "category", query.category);
    appendIfPresent(url.searchParams, "status", query.status);
    return this.request(url.toString(), OrdersResponseSchema);
  }

  token(collection: string, tokenId: string, currency?: string) {
    const url = new URL(
      this.path(`/tokens/${encodeURIComponent(collection)}/${encodeURIComponent(tokenId)}`),
    );
    appendIfPresent(url.searchParams, "currency", currency);
    return this.request(url.toString(), TokenResponseSchema);
  }

  activity(
    collection: string,
    tokenId: string,
    query: { cursor?: string | null; limit?: number } = {},
  ) {
    const url = new URL(
      this.path(
        `/tokens/${encodeURIComponent(collection)}/${encodeURIComponent(tokenId)}/activity`,
      ),
    );
    appendIfPresent(url.searchParams, "cursor", query.cursor);
    appendIfPresent(url.searchParams, "limit", query.limit);
    return this.request(url.toString(), ActivityResponseSchema);
  }

  holdings(
    account: string,
    query: { cursor?: string | null; limit?: number; collection?: string } = {},
  ) {
    const url = new URL(this.path(`/accounts/${encodeURIComponent(account)}/holdings`));
    appendIfPresent(url.searchParams, "cursor", query.cursor);
    appendIfPresent(url.searchParams, "limit", query.limit);
    appendIfPresent(url.searchParams, "collection", query.collection);
    return this.request(url.toString(), HoldingsResponseSchema);
  }

  book() {
    return this.request(this.path("/marketplace/book"), BookResponseSchema);
  }

  indexerStatus() {
    return this.request(this.path("/indexer/status"), IndexerStatusResponseSchema);
  }

  async lookupOrders(orders: OrderKey[]) {
    const body = { orders };
    if (!Value.Check(OrderLookupRequestSchema, body)) {
      throw new MarketplaceApiError(
        "Order lookup requires between 1 and 25 valid tuple identities.",
        "INVALID_ORDER_LOOKUP",
        requestId(),
        false,
        null,
        [...Value.Errors(OrderLookupRequestSchema, body)].map((error) => ({
          path: error.path,
          message: error.message,
        })),
      );
    }
    return await this.request(this.path("/orders/lookup"), OrderLookupResponseSchema, {
      method: "POST",
      body: JSON.stringify(body),
      cache: "no-store",
    });
  }
}

let runtimeClient: MarketplaceApiClient | null = null;

export function getMarketplaceApiClient(): MarketplaceApiClient {
  if (!runtimeClient) {
    const config = getMarketplaceRuntimeConfig();
    runtimeClient = new MarketplaceApiClient({
      baseUrl: config.apiBaseUrl,
      chain: config.chainLabel,
    });
  }
  return runtimeClient;
}

/** @internal — exposed for tests that replace runtime environment. */
export function _resetMarketplaceApiClient() {
  runtimeClient = null;
}
