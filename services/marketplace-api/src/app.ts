import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import {
  ApiErrorSchema,
  BookResponseSchema,
  ChainAliasSchema,
  CollectionResponseSchema,
  CollectionsResponseSchema,
  ActivityResponseSchema,
  HoldingsResponseSchema,
  IndexerStatusResponseSchema,
  OrderLookupRequestSchema,
  OrderLookupResponseSchema,
  FeltSchema,
  OrdersResponseSchema,
  TokenResponseSchema,
  TraitsResponseSchema,
  TokensResponseSchema,
  type CollectionSummary,
  type MarketplaceOrder,
  type MarketplaceBook,
  type MarketplaceActivity,
  type MarketplaceHolding,
  type MarketplaceIndexerStatus,
  type MarketplaceToken,
  type TraitFacet,
  type OrderKey,
  type OrderLookupResult,
} from "@biblio/marketplace-api-contract";
import type {
  MarketplaceChainAlias,
  MarketplaceRegistry,
} from "@biblio/marketplace-registry";
import { canonicalFelt } from "@biblio/marketplace-registry";
import { Type } from "@sinclair/typebox";
import { trace } from "@opentelemetry/api";
import Fastify, { type FastifyError, type FastifyInstance } from "fastify";

export type IndexerStatus = {
  chain: "SN_MAIN" | "SN_SEPOLIA";
  indexedBlock: number;
  indexedBlockHash: string;
  chainHead: number;
  observedAt: string;
};

export type MarketplaceRepository = {
  getIndexerStatus(chain: "SN_MAIN" | "SN_SEPOLIA"): Promise<IndexerStatus>;
  listCollections?(chain: "SN_MAIN" | "SN_SEPOLIA"): Promise<CollectionSummary[]>;
  lookupOrders?(
    chain: "SN_MAIN" | "SN_SEPOLIA",
    keys: OrderKey[],
  ): Promise<OrderLookupResult[]>;
  listTokens?(
    chain: "SN_MAIN" | "SN_SEPOLIA",
    collection: string,
    options: TokenListOptions,
  ): Promise<{ items: MarketplaceToken[]; nextCursor: string | null }>;
  listOrders?(
    chain: "SN_MAIN" | "SN_SEPOLIA",
    collection: string,
    options: OrderListOptions,
  ): Promise<{ items: MarketplaceOrder[]; nextCursor: string | null }>;
  listTraits?(
    chain: "SN_MAIN" | "SN_SEPOLIA",
    collection: string,
    traitName: string | null,
    otherTraits: string[],
  ): Promise<TraitFacet[]>;
  getBook?(chain: "SN_MAIN" | "SN_SEPOLIA"): Promise<MarketplaceBook>;
  getToken?(
    chain: "SN_MAIN" | "SN_SEPOLIA",
    collection: string,
    tokenId: string,
    currency: string,
  ): Promise<MarketplaceToken | null>;
  listActivity?(
    chain: "SN_MAIN" | "SN_SEPOLIA",
    collection: string,
    tokenId: string,
    options: PageOptions,
  ): Promise<{ items: MarketplaceActivity[]; nextCursor: string | null }>;
  listHoldings?(
    chain: "SN_MAIN" | "SN_SEPOLIA",
    account: string,
    collection: string | null,
    options: PageOptions,
  ): Promise<{ items: MarketplaceHolding[]; nextCursor: string | null }>;
  getDetailedIndexerStatus?(
    chain: "SN_MAIN" | "SN_SEPOLIA",
  ): Promise<MarketplaceIndexerStatus>;
};

export const COLLECTION_SORT_MODES = [
  "recent",
  "price-asc",
  "price-desc",
  "power-asc",
  "power-desc",
  "level-asc",
  "level-desc",
  "health-asc",
  "health-desc",
  "resource-count-asc",
  "resource-count-desc",
] as const;

export type CollectionSortMode = (typeof COLLECTION_SORT_MODES)[number];

export type TokenListOptions = {
  cursor: string | null;
  limit: number;
  sort: CollectionSortMode;
  currency: string;
  traits: string[];
  tokenIds: string[];
};

export type OrderListOptions = {
  cursor: string | null;
  limit: number;
  currency: string;
  tokenId: string | null;
  category: "buy" | "sell" | "buy_any" | null;
  status: "none" | "placed" | "cancelled" | "executed" | null;
  activeSellOnly: boolean;
};

export type PageOptions = {
  cursor: string | null;
  limit: number;
};

export type BuildAppOptions = {
  allowedOrigins: string[];
  repository: MarketplaceRepository;
  registry?: MarketplaceRegistry;
  logger?: boolean;
};

class MarketplaceHttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly retryable = false,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

const HealthSchema = Type.Object(
  {
    status: Type.Literal("ok"),
    service: Type.Literal("marketplace-api"),
  },
  { additionalProperties: false },
);

const ReadinessChainSchema = Type.Object(
  {
    chain: Type.Union([Type.Literal("SN_MAIN"), Type.Literal("SN_SEPOLIA")]),
    indexedBlock: Type.Integer({ minimum: 0 }),
    chainHead: Type.Integer({ minimum: 0 }),
    lagBlocks: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

const ReadinessSchema = Type.Object(
  {
    status: Type.Literal("ready"),
    chains: Type.Array(ReadinessChainSchema),
  },
  { additionalProperties: false },
);

const ChainParamsSchema = Type.Object({ chain: ChainAliasSchema });
const CollectionParamsSchema = Type.Object({
  chain: ChainAliasSchema,
  collection: FeltSchema,
});
const TraitParamsSchema = Type.Object({
  chain: ChainAliasSchema,
  collection: FeltSchema,
  traitName: Type.String({ minLength: 1, maxLength: 256 }),
});
const TokenParamsSchema = Type.Object({
  chain: ChainAliasSchema,
  collection: FeltSchema,
  tokenId: Type.String({ pattern: "^(0|[1-9][0-9]*)$" }),
});
const AccountParamsSchema = Type.Object({
  chain: ChainAliasSchema,
  account: FeltSchema,
});
const PageQuerySchema = Type.Object(
  {
    cursor: Type.Optional(Type.String({ minLength: 1, maxLength: 4096 })),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 24 })),
  },
  { additionalProperties: false },
);
const HoldingsQuerySchema = Type.Object(
  {
    cursor: Type.Optional(Type.String({ minLength: 1, maxLength: 4096 })),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200, default: 100 })),
    collection: Type.Optional(FeltSchema),
  },
  { additionalProperties: false },
);
const TokenQuerySchema = Type.Object(
  { currency: Type.Optional(FeltSchema) },
  { additionalProperties: false },
);
const TraitQuerySchema = Type.Object(
  {
    trait: Type.Optional(
      Type.Array(Type.String({ minLength: 3, maxLength: 512 }), { maxItems: 64 }),
    ),
  },
  { additionalProperties: false },
);
const TokenListQuerySchema = Type.Object(
  {
    cursor: Type.Optional(Type.String({ minLength: 1, maxLength: 4096 })),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 24 })),
    sort: Type.Optional(
      Type.Union(COLLECTION_SORT_MODES.map((mode) => Type.Literal(mode)), {
        default: "recent",
      }),
    ),
    currency: Type.Optional(FeltSchema),
    tokenId: Type.Optional(
      Type.Array(Type.String({ pattern: "^(0|[1-9][0-9]*)$" }), { maxItems: 100 }),
    ),
    trait: Type.Optional(Type.Array(Type.String({ minLength: 3, maxLength: 512 }), { maxItems: 64 })),
  },
  { additionalProperties: false },
);
const OrderListQuerySchema = Type.Object(
  {
    cursor: Type.Optional(Type.String({ minLength: 1, maxLength: 4096 })),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 24 })),
    currency: Type.Optional(FeltSchema),
    tokenId: Type.Optional(Type.String({ pattern: "^(0|[1-9][0-9]*)$" })),
    category: Type.Optional(
      Type.Union([Type.Literal("buy"), Type.Literal("sell"), Type.Literal("buy_any")]),
    ),
    status: Type.Optional(
      Type.Union([
        Type.Literal("none"),
        Type.Literal("placed"),
        Type.Literal("cancelled"),
        Type.Literal("executed"),
      ]),
    ),
  },
  { additionalProperties: false },
);

function responseMeta(
  registry: MarketplaceRegistry,
  chain: MarketplaceChainAlias,
  status: IndexerStatus,
) {
  const config = registry.chains[chain];
  if (!config) {
    throw new Error(`Chain ${chain} is not configured.`);
  }
  return {
    schemaVersion: registry.schemaVersion,
    chain,
    chainId: config.chainId,
    worldAddress: config.world.address,
    marketplaceAddress: config.marketplace.address,
    indexedBlock: status.indexedBlock,
    indexedBlockHash: status.indexedBlockHash,
    chainHead: status.chainHead,
    lagBlocks: Math.max(0, status.chainHead - status.indexedBlock),
    finality: "accepted_l2" as const,
    observedAt: status.observedAt,
  };
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger
      ? {
          level: process.env.LOG_LEVEL ?? "info",
          redact: {
            paths: [
              "req.headers.authorization",
              "req.headers.cookie",
              "res.headers.set-cookie",
            ],
            censor: "[REDACTED]",
          },
        }
      : false,
    bodyLimit: 32 * 1024,
    requestIdHeader: "x-request-id",
  });

  await app.register(cors, {
    origin: options.allowedOrigins,
    methods: ["GET", "POST", "OPTIONS"],
  });
  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: "1 minute",
  });
  await app.register(swagger, {
    openapi: {
      info: {
        title: "Biblio Marketplace API",
        version: "1.0.0",
      },
    },
  });

  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-request-id", request.id);
    trace.getActiveSpan()?.setAttribute("marketplace.request_id", request.id);
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error.validation) {
      return reply.code(400).send({
        error: {
          code: "INVALID_REQUEST",
          message: "Request validation failed.",
          requestId: request.id,
          retryable: false,
          details: error.validation,
        },
      });
    }
    if (error instanceof MarketplaceHttpError) {
      return reply.code(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          requestId: request.id,
          retryable: error.retryable,
          ...(error.details === undefined ? {} : { details: error.details }),
        },
      });
    }
    request.log.error({ err: error }, "Unhandled marketplace API error");
    return reply.code(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: "The marketplace read service could not complete the request.",
        requestId: request.id,
        retryable: true,
      },
    });
  });

  app.setNotFoundHandler((request, reply) =>
    reply.code(404).send({
      error: {
        code: "ROUTE_NOT_FOUND",
        message: "Marketplace API route was not found.",
        requestId: request.id,
        retryable: false,
      },
    }),
  );

  app.get(
    "/health",
    {
      schema: {
        response: { 200: HealthSchema },
      },
      config: { rateLimit: false },
    },
    async () => ({ status: "ok" as const, service: "marketplace-api" as const }),
  );

  app.get(
    "/ready",
    {
      schema: {
        response: { 200: ReadinessSchema, 503: ApiErrorSchema },
      },
      config: { rateLimit: false },
    },
    async (request, reply) => {
      const chains = await Promise.all(
        (["SN_MAIN", "SN_SEPOLIA"] as const).map(async (chain) => {
          const status = await options.repository.getIndexerStatus(chain);
          return {
            chain,
            indexedBlock: status.indexedBlock,
            chainHead: status.chainHead,
            lagBlocks: Math.max(0, status.chainHead - status.indexedBlock),
          };
        }),
      );
      if (chains.some((chain) => chain.lagBlocks > 2)) {
        return reply.code(503).send({
          error: {
            code: "INDEXER_LAGGING",
            message: "Marketplace indexer is outside the two-block safety window.",
            requestId: request.id,
            retryable: true,
            details: { chains },
          },
        });
      }
      return { status: "ready" as const, chains };
    },
  );

  app.get<{ Params: { chain: MarketplaceChainAlias } }>(
    "/v1/chains/:chain/collections",
    {
      schema: {
        params: ChainParamsSchema,
        response: { 200: CollectionsResponseSchema },
      },
    },
    async (request, reply) => {
      if (!options.registry || !options.repository.listCollections) {
        throw new Error("Marketplace registry or collection repository is unavailable.");
      }
      const [data, status] = await Promise.all([
        options.repository.listCollections(request.params.chain),
        options.repository.getIndexerStatus(request.params.chain),
      ]);
      reply.header(
        "cache-control",
        "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
      );
      return {
        data,
        meta: responseMeta(options.registry, request.params.chain, status),
      };
    },
  );

  app.get<{ Params: { chain: MarketplaceChainAlias; collection: string } }>(
    "/v1/chains/:chain/collections/:collection",
    {
      schema: {
        params: CollectionParamsSchema,
        response: { 200: CollectionResponseSchema },
      },
    },
    async (request, reply) => {
      if (!options.registry || !options.repository.listCollections) {
        throw new Error("Marketplace registry or collection repository is unavailable.");
      }
      const collection = canonicalFelt(request.params.collection);
      const [collections, status] = await Promise.all([
        options.repository.listCollections(request.params.chain),
        options.repository.getIndexerStatus(request.params.chain),
      ]);
      const data = collections.find((candidate) => candidate.address === collection);
      if (!data) {
        throw new MarketplaceHttpError(
          404,
          "COLLECTION_NOT_FOUND",
          "Marketplace collection was not found.",
        );
      }
      reply.header(
        "cache-control",
        "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
      );
      return {
        data,
        meta: responseMeta(options.registry, request.params.chain, status),
      };
    },
  );

  app.post<{
    Params: { chain: MarketplaceChainAlias };
    Body: { orders: OrderKey[] };
  }>(
    "/v1/chains/:chain/orders/lookup",
    {
      schema: {
        params: ChainParamsSchema,
        body: OrderLookupRequestSchema,
        response: { 200: OrderLookupResponseSchema, 503: ApiErrorSchema },
      },
      config: {
        rateLimit: { max: 60, timeWindow: "1 minute" },
      },
    },
    async (request, reply) => {
      if (!options.registry || !options.repository.lookupOrders) {
        throw new Error("Marketplace registry or order repository is unavailable.");
      }
      const keys = request.body.orders.map((key) => ({
        ...key,
        collection: canonicalFelt(key.collection),
      }));
      const [orders, status] = await Promise.all([
        options.repository.lookupOrders(request.params.chain, keys),
        options.repository.getIndexerStatus(request.params.chain),
      ]);
      reply.header("cache-control", "no-store");
      const meta = responseMeta(options.registry, request.params.chain, status);
      if (meta.lagBlocks > 2) {
        return reply.code(503).send({
          error: {
            code: "INDEXER_LAGGING",
            message: "Marketplace indexer is outside the two-block safety window.",
            requestId: request.id,
            retryable: true,
            details: {
              chain: request.params.chain,
              indexedBlock: meta.indexedBlock,
              chainHead: meta.chainHead,
              lagBlocks: meta.lagBlocks,
            },
          },
        });
      }
      return {
        data: { orders },
        meta,
      };
    },
  );

  app.get<{
    Params: { chain: MarketplaceChainAlias; collection: string };
    Querystring: {
      cursor?: string;
      limit?: number;
      sort?: CollectionSortMode;
      currency?: string;
      trait?: string[];
      tokenId?: string[];
    };
  }>(
    "/v1/chains/:chain/collections/:collection/tokens",
    {
      schema: {
        params: CollectionParamsSchema,
        querystring: TokenListQuerySchema,
        response: { 200: TokensResponseSchema },
      },
    },
    async (request, reply) => {
      if (!options.registry || !options.repository.listTokens) {
        throw new Error("Marketplace registry or token repository is unavailable.");
      }
      const chain = options.registry.chains[request.params.chain];
      if (!chain) throw new Error(`Chain ${request.params.chain} is not configured.`);
      const collection = canonicalFelt(request.params.collection);
      const defaultCurrency =
        chain.currencies.find((currency) => currency.symbol === "STRK")?.address ??
        chain.currencies[0]?.address;
      if (!defaultCurrency) throw new Error("No marketplace currency is configured.");
      const data = await options.repository.listTokens(
        request.params.chain,
        collection,
        {
          cursor: request.query.cursor ?? null,
          limit: request.query.limit ?? 24,
          sort: request.query.sort ?? "recent",
          currency: canonicalFelt(request.query.currency ?? defaultCurrency),
          traits: request.query.trait ?? [],
          tokenIds: request.query.tokenId ?? [],
        },
      );
      const status = await options.repository.getIndexerStatus(request.params.chain);
      reply.header(
        "cache-control",
        "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
      );
      return {
        data,
        meta: responseMeta(options.registry, request.params.chain, status),
      };
    },
  );

  const registerTraitRoute = (path: string, hasTraitName: boolean) => {
    app.get<{
      Params: {
        chain: MarketplaceChainAlias;
        collection: string;
        traitName?: string;
      };
      Querystring: { trait?: string[] };
    }>(
      path,
      {
        schema: {
          params: hasTraitName ? TraitParamsSchema : CollectionParamsSchema,
          querystring: TraitQuerySchema,
          response: { 200: TraitsResponseSchema },
        },
      },
      async (request, reply) => {
        if (!options.registry || !options.repository.listTraits) {
          throw new Error("Marketplace registry or trait repository is unavailable.");
        }
        const data = await options.repository.listTraits(
          request.params.chain,
          canonicalFelt(request.params.collection),
          hasTraitName ? request.params.traitName ?? null : null,
          request.query.trait ?? [],
        );
        const status = await options.repository.getIndexerStatus(request.params.chain);
        reply.header(
          "cache-control",
          "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
        );
        return {
          data,
          meta: responseMeta(options.registry, request.params.chain, status),
        };
      },
    );
  };

  registerTraitRoute("/v1/chains/:chain/collections/:collection/traits", false);
  registerTraitRoute(
    "/v1/chains/:chain/collections/:collection/traits/:traitName",
    true,
  );

  const registerOrderRoute = (path: string, activeSellOnly: boolean) => {
    app.get<{
      Params: { chain: MarketplaceChainAlias; collection: string };
      Querystring: {
        cursor?: string;
        limit?: number;
        currency?: string;
        tokenId?: string;
        category?: "buy" | "sell" | "buy_any";
        status?: "none" | "placed" | "cancelled" | "executed";
      };
    }>(
      path,
      {
        schema: {
          params: CollectionParamsSchema,
          querystring: OrderListQuerySchema,
          response: { 200: OrdersResponseSchema },
        },
      },
      async (request, reply) => {
        if (!options.registry || !options.repository.listOrders) {
          throw new Error("Marketplace registry or order repository is unavailable.");
        }
        const chain = options.registry.chains[request.params.chain];
        if (!chain) throw new Error(`Chain ${request.params.chain} is not configured.`);
        const defaultCurrency =
          chain.currencies.find((currency) => currency.symbol === "STRK")?.address ??
          chain.currencies[0]?.address;
        if (!defaultCurrency) throw new Error("No marketplace currency is configured.");
        const data = await options.repository.listOrders(
          request.params.chain,
          canonicalFelt(request.params.collection),
          {
            cursor: request.query.cursor ?? null,
            limit: request.query.limit ?? 24,
            currency: canonicalFelt(request.query.currency ?? defaultCurrency),
            tokenId: request.query.tokenId ?? null,
            category: activeSellOnly ? "sell" : request.query.category ?? null,
            status: activeSellOnly ? "placed" : request.query.status ?? null,
            activeSellOnly,
          },
        );
        const status = await options.repository.getIndexerStatus(request.params.chain);
        reply.header(
          "cache-control",
          "public, max-age=2, s-maxage=2, must-revalidate",
        );
        return {
          data,
          meta: responseMeta(options.registry, request.params.chain, status),
        };
      },
    );
  };

  registerOrderRoute("/v1/chains/:chain/collections/:collection/orders", false);
  registerOrderRoute("/v1/chains/:chain/collections/:collection/listings", true);

  app.get<{
    Params: { chain: MarketplaceChainAlias; collection: string; tokenId: string };
    Querystring: { currency?: string };
  }>(
    "/v1/chains/:chain/tokens/:collection/:tokenId",
    {
      schema: {
        params: TokenParamsSchema,
        querystring: TokenQuerySchema,
        response: { 200: TokenResponseSchema },
      },
    },
    async (request, reply) => {
      if (!options.registry || !options.repository.getToken) {
        throw new Error("Marketplace registry or token repository is unavailable.");
      }
      const chainConfig = options.registry.chains[request.params.chain];
      if (!chainConfig) throw new Error(`Chain ${request.params.chain} is not configured.`);
      const defaultCurrency =
        chainConfig.currencies.find((currency) => currency.symbol === "STRK")?.address ??
        chainConfig.currencies[0]?.address;
      if (!defaultCurrency) throw new Error("No marketplace currency is configured.");
      const [data, status] = await Promise.all([
        options.repository.getToken(
          request.params.chain,
          canonicalFelt(request.params.collection),
          request.params.tokenId,
          canonicalFelt(request.query.currency ?? defaultCurrency),
        ),
        options.repository.getIndexerStatus(request.params.chain),
      ]);
      if (!data) {
        throw new MarketplaceHttpError(
          404,
          "TOKEN_NOT_FOUND",
          "Marketplace token was not found.",
        );
      }
      reply.header(
        "cache-control",
        "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
      );
      return {
        data,
        meta: responseMeta(options.registry, request.params.chain, status),
      };
    },
  );

  app.get<{
    Params: { chain: MarketplaceChainAlias; collection: string; tokenId: string };
    Querystring: { cursor?: string; limit?: number };
  }>(
    "/v1/chains/:chain/tokens/:collection/:tokenId/activity",
    {
      schema: {
        params: TokenParamsSchema,
        querystring: PageQuerySchema,
        response: { 200: ActivityResponseSchema },
      },
    },
    async (request, reply) => {
      if (!options.registry || !options.repository.listActivity) {
        throw new Error("Marketplace registry or activity repository is unavailable.");
      }
      const [data, status] = await Promise.all([
        options.repository.listActivity(
          request.params.chain,
          canonicalFelt(request.params.collection),
          request.params.tokenId,
          { cursor: request.query.cursor ?? null, limit: request.query.limit ?? 24 },
        ),
        options.repository.getIndexerStatus(request.params.chain),
      ]);
      reply.header(
        "cache-control",
        "public, max-age=10, s-maxage=10, must-revalidate",
      );
      return {
        data,
        meta: responseMeta(options.registry, request.params.chain, status),
      };
    },
  );

  app.get<{
    Params: { chain: MarketplaceChainAlias; account: string };
    Querystring: { cursor?: string; limit?: number; collection?: string };
  }>(
    "/v1/chains/:chain/accounts/:account/holdings",
    {
      schema: {
        params: AccountParamsSchema,
        querystring: HoldingsQuerySchema,
        response: { 200: HoldingsResponseSchema },
      },
    },
    async (request, reply) => {
      if (!options.registry || !options.repository.listHoldings) {
        throw new Error("Marketplace registry or holdings repository is unavailable.");
      }
      const [data, status] = await Promise.all([
        options.repository.listHoldings(
          request.params.chain,
          canonicalFelt(request.params.account),
          request.query.collection ? canonicalFelt(request.query.collection) : null,
          { cursor: request.query.cursor ?? null, limit: request.query.limit ?? 100 },
        ),
        options.repository.getIndexerStatus(request.params.chain),
      ]);
      reply.header(
        "cache-control",
        "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
      );
      return {
        data,
        meta: responseMeta(options.registry, request.params.chain, status),
      };
    },
  );

  app.get<{ Params: { chain: MarketplaceChainAlias } }>(
    "/v1/chains/:chain/indexer/status",
    {
      schema: {
        params: ChainParamsSchema,
        response: { 200: IndexerStatusResponseSchema },
      },
    },
    async (request, reply) => {
      if (!options.registry || !options.repository.getDetailedIndexerStatus) {
        throw new Error("Marketplace registry or indexer diagnostics are unavailable.");
      }
      const [data, status] = await Promise.all([
        options.repository.getDetailedIndexerStatus(request.params.chain),
        options.repository.getIndexerStatus(request.params.chain),
      ]);
      reply.header("cache-control", "no-store");
      return {
        data,
        meta: responseMeta(options.registry, request.params.chain, status),
      };
    },
  );

  app.get<{ Params: { chain: MarketplaceChainAlias } }>(
    "/v1/chains/:chain/marketplace/book",
    {
      schema: {
        params: ChainParamsSchema,
        response: { 200: BookResponseSchema },
      },
    },
    async (request, reply) => {
      if (!options.registry || !options.repository.getBook) {
        throw new Error("Marketplace registry or Book repository is unavailable.");
      }
      const [data, status] = await Promise.all([
        options.repository.getBook(request.params.chain),
        options.repository.getIndexerStatus(request.params.chain),
      ]);
      reply.header(
        "cache-control",
        "public, max-age=2, s-maxage=2, must-revalidate",
      );
      return {
        data,
        meta: responseMeta(options.registry, request.params.chain, status),
      };
    },
  );

  app.get(
    "/openapi.json",
    { config: { rateLimit: false } },
    async (_request, reply) => {
      reply.header("cache-control", "public, max-age=300");
      return app.swagger();
    },
  );

  return app;
}
