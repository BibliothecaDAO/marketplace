import { Type, type Static, type TSchema } from "@sinclair/typebox";

export const CanonicalFeltSchema = Type.String({
  pattern: "^0x[0-9a-f]{64}$",
  description: "Lowercase, left-padded Starknet felt.",
});

export const FeltSchema = Type.String({
  pattern: "^0x[0-9a-f]{1,64}$",
});

export const DecimalStringSchema = Type.String({
  pattern: "^(0|[1-9][0-9]*)$",
  description: "Lossless unsigned integer encoded in base 10.",
});

export const ChainAliasSchema = Type.Union([
  Type.Literal("SN_MAIN"),
  Type.Literal("SN_SEPOLIA"),
]);

export const ApiMetaSchema = Type.Object(
  {
    schemaVersion: Type.String({ pattern: "^[0-9]+\\.[0-9]+\\.[0-9]+$" }),
    chain: ChainAliasSchema,
    chainId: FeltSchema,
    worldAddress: CanonicalFeltSchema,
    marketplaceAddress: CanonicalFeltSchema,
    indexedBlock: Type.Integer({ minimum: 0 }),
    indexedBlockHash: CanonicalFeltSchema,
    chainHead: Type.Integer({ minimum: 0 }),
    lagBlocks: Type.Integer({ minimum: 0 }),
    finality: Type.Literal("accepted_l2"),
    observedAt: Type.String({
      pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}Z$",
    }),
  },
  { additionalProperties: false },
);

export const ApiErrorSchema = Type.Object(
  {
    error: Type.Object(
      {
        code: Type.String({ minLength: 1 }),
        message: Type.String({ minLength: 1 }),
        requestId: Type.String({ minLength: 1 }),
        retryable: Type.Boolean(),
        details: Type.Optional(Type.Unknown()),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

export const ProvenanceSchema = Type.Object(
  {
    blockNumber: Type.Integer({ minimum: 0 }),
    transactionHash: CanonicalFeltSchema,
    transactionIndex: Type.Integer({ minimum: 0 }),
    eventIndex: Type.Integer({ minimum: 0 }),
    caller: CanonicalFeltSchema,
  },
  { additionalProperties: false },
);

export const OrderCategorySchema = Type.Union([
  Type.Literal("buy"),
  Type.Literal("sell"),
  Type.Literal("buy_any"),
  Type.Literal("unknown"),
]);

export const OrderStatusSchema = Type.Union([
  Type.Literal("none"),
  Type.Literal("placed"),
  Type.Literal("cancelled"),
  Type.Literal("executed"),
  Type.Literal("unknown"),
]);

export const RoyaltyTermsSchema = Type.Object(
  {
    enabled: Type.Boolean(),
    receiver: Type.Union([CanonicalFeltSchema, Type.Null()]),
    amountAtomic: Type.Union([DecimalStringSchema, Type.Null()]),
    source: Type.Union([
      Type.Literal("order"),
      Type.Literal("erc2981"),
      Type.Literal("unknown"),
    ]),
  },
  { additionalProperties: false },
);

export const MarketplaceOrderSchema = Type.Object(
  {
    id: DecimalStringSchema,
    collection: CanonicalFeltSchema,
    tokenId: DecimalStringSchema,
    category: OrderCategorySchema,
    categoryRaw: Type.Integer({ minimum: 0 }),
    status: OrderStatusSchema,
    statusRaw: Type.Integer({ minimum: 0 }),
    owner: CanonicalFeltSchema,
    currency: CanonicalFeltSchema,
    unitPriceAtomic: DecimalStringSchema,
    quantity: DecimalStringSchema,
    remainingQuantity: DecimalStringSchema,
    expiration: DecimalStringSchema,
    royaltiesEnabled: Type.Boolean(),
    royaltyTerms: RoyaltyTermsSchema,
    createdAt: ProvenanceSchema,
    updatedAt: ProvenanceSchema,
  },
  { additionalProperties: false },
);

export const FloorQuoteSchema = Type.Object(
  {
    currency: CanonicalFeltSchema,
    symbol: Type.String({ minLength: 1, maxLength: 16 }),
    unitPriceAtomic: DecimalStringSchema,
  },
  { additionalProperties: false },
);

export const CollectionSummarySchema = Type.Object(
  {
    address: CanonicalFeltSchema,
    name: Type.String({ minLength: 1 }),
    description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    image: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    bannerImage: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    rawMetadata: Type.Optional(Type.Unknown()),
    standard: Type.Union([Type.Literal("ERC721"), Type.Literal("ERC1155")]),
    deploymentBlock: Type.Integer({ minimum: 0 }),
    verified: Type.Boolean(),
    tokenCount: DecimalStringSchema,
    listingCount: DecimalStringSchema,
    floorByCurrency: Type.Array(FloorQuoteSchema),
  },
  { additionalProperties: false },
);

export const TokenAttributeSchema = Type.Object(
  {
    traitName: Type.String({ minLength: 1 }),
    value: Type.Union([Type.String(), Type.Number(), Type.Boolean()]),
    displayType: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const MarketplaceTokenSchema = Type.Object(
  {
    collection: CanonicalFeltSchema,
    tokenId: DecimalStringSchema,
    name: Type.String({ minLength: 1 }),
    description: Type.Union([Type.String(), Type.Null()]),
    image: Type.Union([Type.String(), Type.Null()]),
    owner: Type.Union([CanonicalFeltSchema, Type.Null()]),
    balance: DecimalStringSchema,
    firstSeenBlock: Type.Integer({ minimum: 0 }),
    attributes: Type.Array(TokenAttributeSchema),
    floorByCurrency: Type.Array(FloorQuoteSchema),
    bestListing: Type.Union([MarketplaceOrderSchema, Type.Null()]),
    rawMetadata: Type.Optional(Type.Unknown()),
  },
  { additionalProperties: false },
);

export const TraitValueSchema = Type.Object(
  {
    value: Type.Union([Type.String(), Type.Number(), Type.Boolean()]),
    count: DecimalStringSchema,
  },
  { additionalProperties: false },
);

export const TraitFacetSchema = Type.Object(
  {
    name: Type.String({ minLength: 1 }),
    kind: Type.Union([
      Type.Literal("string"),
      Type.Literal("number"),
      Type.Literal("boolean"),
      Type.Literal("unknown"),
    ]),
    values: Type.Array(TraitValueSchema),
    min: Type.Optional(Type.Number()),
    max: Type.Optional(Type.Number()),
  },
  { additionalProperties: false },
);

export const ActivityTypeSchema = Type.Union([
  Type.Literal("listing_created"),
  Type.Literal("offer_created"),
  Type.Literal("sale"),
  Type.Literal("order_cancelled"),
  Type.Literal("order_removed"),
  Type.Literal("order_partially_filled"),
  Type.Literal("book_updated"),
  Type.Literal("order_status_changed"),
  Type.Literal("transfer"),
  Type.Literal("unknown"),
]);

export const MarketplaceActivitySchema = Type.Object(
  {
    type: ActivityTypeSchema,
    typeRaw: Type.String(),
    collection: Type.Union([CanonicalFeltSchema, Type.Null()]),
    tokenId: Type.Union([DecimalStringSchema, Type.Null()]),
    orderId: Type.Union([DecimalStringSchema, Type.Null()]),
    from: Type.Union([CanonicalFeltSchema, Type.Null()]),
    to: Type.Union([CanonicalFeltSchema, Type.Null()]),
    currency: Type.Union([CanonicalFeltSchema, Type.Null()]),
    unitPriceAtomic: Type.Union([DecimalStringSchema, Type.Null()]),
    quantity: Type.Union([DecimalStringSchema, Type.Null()]),
    provenance: ProvenanceSchema,
    rawSource: Type.Union([Type.Unknown(), Type.Null()]),
  },
  { additionalProperties: false },
);

export const MarketplaceHoldingSchema = Type.Object(
  {
    account: CanonicalFeltSchema,
    collection: CanonicalFeltSchema,
    tokenId: DecimalStringSchema,
    balance: DecimalStringSchema,
    token: MarketplaceTokenSchema,
  },
  { additionalProperties: false },
);

export const MarketplaceBookSchema = Type.Object(
  {
    id: DecimalStringSchema,
    version: DecimalStringSchema,
    paused: Type.Boolean(),
    royaltiesEnabled: Type.Boolean(),
    counter: DecimalStringSchema,
    feeNumerator: DecimalStringSchema,
    feeDenominator: DecimalStringSchema,
    feeReceiver: CanonicalFeltSchema,
    updatedAt: ProvenanceSchema,
  },
  { additionalProperties: false },
);

export const IndexerStatusSchema = Type.Object(
  {
    buildVersion: Type.String({ minLength: 1 }),
    replayVersion: Type.String({ minLength: 1 }),
    databaseSchemaVersion: Type.String({ minLength: 1 }),
    indexedBlock: Type.Integer({ minimum: 0 }),
    indexedBlockHash: CanonicalFeltSchema,
    chainHead: Type.Integer({ minimum: 0 }),
    lagBlocks: Type.Integer({ minimum: 0 }),
    finality: Type.Literal("accepted_l2"),
    metadataFailures: Type.Integer({ minimum: 0 }),
    safeForCheckout: Type.Boolean(),
  },
  { additionalProperties: false },
);

export function PaginatedDataSchema<T extends TSchema>(item: T) {
  return Type.Object(
    {
      items: Type.Array(item),
      nextCursor: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
    },
    { additionalProperties: false },
  );
}

export function ResponseEnvelopeSchema<T extends TSchema>(data: T) {
  return Type.Object(
    {
      data,
      meta: ApiMetaSchema,
    },
    { additionalProperties: false },
  );
}

export const MarketplaceOrderResponseSchema = ResponseEnvelopeSchema(
  MarketplaceOrderSchema,
);
export const CollectionsResponseSchema = ResponseEnvelopeSchema(
  Type.Array(CollectionSummarySchema),
);
export const CollectionResponseSchema = ResponseEnvelopeSchema(
  CollectionSummarySchema,
);
export const TokensResponseSchema = ResponseEnvelopeSchema(
  PaginatedDataSchema(MarketplaceTokenSchema),
);
export const TokenResponseSchema = ResponseEnvelopeSchema(MarketplaceTokenSchema);
export const TraitsResponseSchema = ResponseEnvelopeSchema(
  Type.Array(TraitFacetSchema),
);
export const OrdersResponseSchema = ResponseEnvelopeSchema(
  PaginatedDataSchema(MarketplaceOrderSchema),
);
export const ActivityResponseSchema = ResponseEnvelopeSchema(
  PaginatedDataSchema(MarketplaceActivitySchema),
);
export const HoldingsResponseSchema = ResponseEnvelopeSchema(
  PaginatedDataSchema(MarketplaceHoldingSchema),
);
export const BookResponseSchema = ResponseEnvelopeSchema(MarketplaceBookSchema);
export const IndexerStatusResponseSchema = ResponseEnvelopeSchema(
  IndexerStatusSchema,
);

export const OrderKeySchema = Type.Object(
  {
    id: DecimalStringSchema,
    collection: FeltSchema,
    tokenId: DecimalStringSchema,
  },
  { additionalProperties: false },
);

export const OrderLookupRequestSchema = Type.Object(
  {
    orders: Type.Array(OrderKeySchema, { minItems: 1, maxItems: 25 }),
  },
  { additionalProperties: false },
);

export const OrderLookupResultSchema = Type.Object(
  {
    key: OrderKeySchema,
    order: Type.Union([MarketplaceOrderSchema, Type.Null()]),
  },
  { additionalProperties: false },
);

export const OrderLookupResponseSchema = ResponseEnvelopeSchema(
  Type.Object(
    { orders: Type.Array(OrderLookupResultSchema, { maxItems: 25 }) },
    { additionalProperties: false },
  ),
);

export type ApiMeta = Static<typeof ApiMetaSchema>;
export type MarketplaceChainAlias = Static<typeof ChainAliasSchema>;
export type ApiError = Static<typeof ApiErrorSchema>;
export type MarketplaceOrder = Static<typeof MarketplaceOrderSchema>;
export type CollectionSummary = Static<typeof CollectionSummarySchema>;
export type MarketplaceToken = Static<typeof MarketplaceTokenSchema>;
export type TraitFacet = Static<typeof TraitFacetSchema>;
export type MarketplaceActivity = Static<typeof MarketplaceActivitySchema>;
export type MarketplaceHolding = Static<typeof MarketplaceHoldingSchema>;
export type MarketplaceBook = Static<typeof MarketplaceBookSchema>;
export type MarketplaceIndexerStatus = Static<typeof IndexerStatusSchema>;
export type MarketplaceOrderResponse = Static<
  typeof MarketplaceOrderResponseSchema
>;
export type OrderKey = Static<typeof OrderKeySchema>;
export type OrderLookupRequest = Static<typeof OrderLookupRequestSchema>;
export type OrderLookupResult = Static<typeof OrderLookupResultSchema>;
