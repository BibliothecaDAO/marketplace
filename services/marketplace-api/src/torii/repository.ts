import type {
  CollectionSummary,
  MarketplaceActivity,
  MarketplaceBook,
  MarketplaceHolding,
  MarketplaceIndexerStatus,
  MarketplaceToken,
  MarketplaceOrder,
  OrderKey,
  OrderLookupResult,
  TraitFacet,
} from "@biblio/marketplace-api-contract";
import {
  canonicalFelt,
  type MarketplaceChainAlias,
  type MarketplaceRegistry,
} from "@biblio/marketplace-registry";
import type {
  CollectionSortMode,
  IndexerStatus,
  OrderListOptions,
  PageOptions,
  TokenListOptions,
} from "../app.js";
import { decodeCursor, encodeCursor } from "../cursor.js";

export type ToriiQueryClient = {
  query(chain: MarketplaceChainAlias, sql: string): Promise<unknown[]>;
};

export type ToriiMarketplaceRepositoryOptions = {
  currencies?: Partial<
    Record<MarketplaceChainAlias, Array<{ address: string; symbol: string }>>
  >;
  nowEpochSeconds?: () => number;
  now?: () => Date;
  registry?: MarketplaceRegistry;
  rpc?: {
    getHead(chain: MarketplaceChainAlias): Promise<{ blockNumber: number; blockHash: string }>;
    getBlockHash(chain: MarketplaceChainAlias, blockNumber: number): Promise<string>;
  };
  buildVersion?: string;
  replayVersion?: string;
  databaseSchemaVersion?: string;
  checkoutLagLimit?: number;
};

type OrderRow = Record<string, unknown>;

function decimal(value: unknown): string {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return String(value);
  }
  if (typeof value === "string" && (/^0x[0-9a-f]+$/i.test(value) || /^\d+$/.test(value))) {
    return BigInt(value).toString();
  }
  throw new Error(`Torii returned an invalid unsigned integer: ${String(value)}`);
}

function integer(value: unknown): number {
  const parsed = Number(decimal(value));
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`Torii integer exceeds the safe API range: ${String(value)}`);
  }
  return parsed;
}

function boolean(value: unknown): boolean {
  return decimal(value) !== "0";
}

function category(raw: number): MarketplaceOrder["category"] {
  if (raw === 1) return "buy";
  if (raw === 2) return "sell";
  if (raw === 3) return "buy_any";
  return "unknown";
}

function status(raw: number): MarketplaceOrder["status"] {
  if (raw === 0) return "none";
  if (raw === 1) return "placed";
  if (raw === 2) return "cancelled";
  if (raw === 3) return "executed";
  return "unknown";
}

function categoryCode(value: OrderListOptions["category"]): number | null {
  if (value === "buy") return 1;
  if (value === "sell") return 2;
  if (value === "buy_any") return 3;
  return null;
}

function statusCode(value: OrderListOptions["status"]): number | null {
  if (value === "none") return 0;
  if (value === "placed") return 1;
  if (value === "cancelled") return 2;
  if (value === "executed") return 3;
  return null;
}

function eventIndex(eventId: unknown): number {
  if (typeof eventId !== "string") return 0;
  const part = eventId.slice(eventId.lastIndexOf(":") + 1);
  try {
    return Number(BigInt(part));
  } catch {
    return 0;
  }
}

function provenance(row: OrderRow, prefix: "created" | "updated") {
  const transactionHash = row[`${prefix}_transaction_hash`];
  const caller = row[`${prefix}_caller`];
  if (typeof transactionHash !== "string" || typeof caller !== "string") {
    throw new Error(`Torii did not return complete ${prefix} provenance.`);
  }
  return {
    blockNumber: integer(row[`${prefix}_block_number`] ?? 0),
    transactionHash: canonicalFelt(transactionHash),
    transactionIndex: integer(row[`${prefix}_transaction_index`] ?? 0),
    eventIndex: integer(
      row[`${prefix}_event_index`] ?? eventIndex(row[`${prefix}_event_id`]),
    ),
    caller: canonicalFelt(caller),
  };
}

function orderFromRow(row: OrderRow): MarketplaceOrder {
  const categoryRaw = integer(row.category);
  const statusRaw = integer(row.status);
  const quantity = decimal(row.original_quantity ?? row.quantity);
  return {
    id: decimal(row.id),
    collection: canonicalFelt(String(row.collection)),
    tokenId: decimal(row.token_id),
    royaltiesEnabled: boolean(row.royalties),
    royaltyTerms: {
      enabled: boolean(row.royalties),
      receiver: null,
      amountAtomic: null,
      source: "order",
    },
    category: category(categoryRaw),
    categoryRaw,
    status: status(statusRaw),
    statusRaw,
    expiration: decimal(row.expiration),
    quantity,
    remainingQuantity: decimal(row.quantity),
    unitPriceAtomic: decimal(row.price),
    currency: canonicalFelt(String(row.currency)),
    owner: canonicalFelt(String(row.owner)),
    createdAt: provenance(row, "created"),
    updatedAt: provenance(row, "updated"),
  };
}

function prefixedOrderFromRow(
  row: Record<string, unknown>,
  prefix: string,
): MarketplaceOrder | null {
  if (row[`${prefix}_id`] == null) return null;
  const value = (name: string) => row[`${prefix}_${name}`];
  return orderFromRow({
    id: value("id"),
    collection: value("collection"),
    token_id: value("token_id"),
    royalties: value("royalties"),
    category: value("category"),
    status: value("status"),
    expiration: value("expiration"),
    quantity: value("quantity"),
    original_quantity: value("original_quantity"),
    price: value("price"),
    currency: value("currency"),
    owner: value("owner"),
    created_event_id: value("created_event_id"),
    created_block_number: value("created_block_number"),
    created_transaction_hash: value("created_transaction_hash"),
    created_transaction_index: value("created_transaction_index"),
    created_event_index: value("created_event_index"),
    created_caller: value("created_caller"),
    updated_event_id: value("updated_event_id"),
    updated_block_number: value("updated_block_number"),
    updated_transaction_hash: value("updated_transaction_hash"),
    updated_transaction_index: value("updated_transaction_index"),
    updated_event_index: value("updated_event_index"),
    updated_caller: value("updated_caller"),
  });
}

function normalizedKey(key: OrderKey): OrderKey {
  if (!/^(0|[1-9][0-9]*)$/.test(key.id) || !/^(0|[1-9][0-9]*)$/.test(key.tokenId)) {
    throw new Error("Order keys must use unsigned decimal IDs.");
  }
  return {
    id: BigInt(key.id).toString(),
    collection: canonicalFelt(key.collection),
    tokenId: BigInt(key.tokenId).toString(),
  };
}

function tokenIdForSql(tokenId: string): string {
  return `0x${BigInt(tokenId).toString(16).padStart(64, "0")}`;
}

function orderKeyId(key: OrderKey): string {
  return `${key.id}:${key.collection}:${key.tokenId}`;
}

function sqlText(value: string): string {
  if (value.length > 512) throw new Error("SQL filter value is too long.");
  return `'${value.replaceAll("'", "''")}'`;
}

function bestListingProjection(): string {
  return `best_order.id AS best_id,
  best_order.collection AS best_collection,
  best_order.token_id AS best_token_id,
  best_order.royalties AS best_royalties,
  best_order.category AS best_category,
  best_order.status AS best_status,
  best_order.expiration AS best_expiration,
  best_order.quantity AS best_quantity,
  COALESCE(best_first_state.quantity, best_order.quantity) AS best_original_quantity,
  best_order.price AS best_price,
  best_order.currency AS best_currency,
  best_order.owner AS best_owner,
  best_created_event.id AS best_created_event_id,
  best_created_tx.block_number AS best_created_block_number,
  best_created_event.transaction_hash AS best_created_transaction_hash,
  COALESCE((SELECT COUNT(*) FROM transactions preceding WHERE preceding.block_number = best_created_tx.block_number AND preceding.rowid < best_created_tx.rowid), 0) AS best_created_transaction_index,
  best_created_event.event_index AS best_created_event_index,
  best_created_tx.sender_address AS best_created_caller,
  best_updated_event.id AS best_updated_event_id,
  best_updated_tx.block_number AS best_updated_block_number,
  best_updated_event.transaction_hash AS best_updated_transaction_hash,
  COALESCE((SELECT COUNT(*) FROM transactions preceding WHERE preceding.block_number = best_updated_tx.block_number AND preceding.rowid < best_updated_tx.rowid), 0) AS best_updated_transaction_index,
  best_updated_event.event_index AS best_updated_event_index,
  best_updated_tx.sender_address AS best_updated_caller`;
}

function bestListingJoins(currency: string, nowHex: string): string {
  return `LEFT JOIN "ARCADE-Order" best_order
  ON best_order.internal_entity_id = (
    SELECT candidate.internal_entity_id
    FROM "ARCADE-Order" candidate
    WHERE candidate.collection = t.contract_address
      AND candidate.token_id = t.token_id
      AND candidate.currency = '${currency}'
      AND candidate.category = 2
      AND candidate.status = 1
      AND candidate.expiration > '${nowHex}'
    ORDER BY candidate.price ASC, candidate.id DESC, candidate.internal_entity_id DESC
    LIMIT 1
  )
LEFT JOIN events best_updated_event ON best_updated_event.id = best_order.internal_event_id
LEFT JOIN transactions best_updated_tx ON best_updated_tx.transaction_hash = best_updated_event.transaction_hash
LEFT JOIN marketplace_order_audit best_first_state
  ON best_first_state.entity_id = best_order.internal_entity_id
  AND best_first_state.sequence = (
    SELECT MIN(first_sequence.sequence)
    FROM marketplace_order_audit first_sequence
    WHERE first_sequence.entity_id = best_order.internal_entity_id
  )
LEFT JOIN events best_created_event
  ON best_created_event.id = COALESCE(best_first_state.event_id, best_order.internal_event_id)
LEFT JOIN transactions best_created_tx
  ON best_created_tx.transaction_hash = best_created_event.transaction_hash`;
}

function parseJsonRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== "string" || value.trim() === "") return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function parseJsonArray(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) {
    return value.filter(
      (entry): entry is Record<string, unknown> =>
        !!entry && typeof entry === "object" && !Array.isArray(entry),
    );
  }
  if (typeof value !== "string" || value.trim() === "") return [];
  try {
    return parseJsonArray(JSON.parse(value));
  } catch {
    return [];
  }
}

function traitValue(value: unknown): string | number | boolean {
  const normalized = String(value ?? "");
  if (/^-?(?:\d+|\d*\.\d+)$/.test(normalized)) {
    const number = Number(normalized);
    if (Number.isFinite(number)) return number;
  }
  if (normalized.toLowerCase() === "true") return true;
  if (normalized.toLowerCase() === "false") return false;
  return normalized;
}

function firstSeenBlock(eventId: unknown): number {
  if (typeof eventId !== "string") return 0;
  const rawBlock = eventId.slice(0, eventId.indexOf(":"));
  try {
    return Number(BigInt(rawBlock));
  } catch {
    return 0;
  }
}

function sortDefinition(sort: CollectionSortMode): {
  expression: string;
  direction: "ASC" | "DESC";
  join: string;
  cursorKind: "text" | "number";
} {
  if (sort === "recent") {
    return {
      expression: "first_event_id",
      direction: "DESC",
      join: "",
      cursorKind: "text",
    };
  }
  if (sort === "price-asc" || sort === "price-desc") {
    return {
      expression: "f.floor_price",
      direction: sort.endsWith("asc") ? "ASC" : "DESC",
      join: "",
      cursorKind: "text",
    };
  }
  if (sort.startsWith("resource-count")) {
    return {
      expression: `(SELECT COUNT(*) FROM token_attributes resource_trait
        WHERE resource_trait.token_id = t.id
          AND lower(resource_trait.trait_name) IN ('wood','stone','coal','copper','iron','silver','gold','mithral','adamantine','cold iron','obsidian','ruby','sapphire','diamond','dragonhide','true ice','ignium')
          AND CAST(resource_trait.trait_value AS REAL) > 0)`,
      direction: sort.endsWith("asc") ? "ASC" : "DESC",
      join: "",
      cursorKind: "number",
    };
  }
  const traitName = sort.startsWith("power")
    ? "Power"
    : sort.startsWith("level")
      ? "Level"
      : "Health";
  return {
    expression: "CAST(sort_trait.trait_value AS REAL)",
    direction: sort.endsWith("asc") ? "ASC" : "DESC",
    join: `LEFT JOIN token_attributes sort_trait ON sort_trait.token_id = t.id AND lower(sort_trait.trait_name) = lower(${sqlText(traitName)})`,
    cursorKind: "number",
  };
}

function sortCursorLiteral(
  definition: ReturnType<typeof sortDefinition>,
  value: string,
): string {
  if (definition.cursorKind === "text") return sqlText(value);
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error("Token cursor contains an invalid numeric sort value.");
  }
  return numeric.toString();
}

function traitPredicates(traits: string[]): string[] {
  const grouped = new Map<string, string[]>();
  for (const entry of traits) {
    const separator = entry.indexOf(":");
    if (separator <= 0 || separator === entry.length - 1) {
      throw new Error(`Invalid trait filter ${entry}.`);
    }
    const name = entry.slice(0, separator);
    const value = entry.slice(separator + 1);
    const values = grouped.get(name) ?? [];
    values.push(value);
    grouped.set(name, values);
  }

  return [...grouped.entries()].map(([name, values], index) => {
    const exact = values.filter((value) => !value.startsWith("__range__:"));
    const ranges = values.flatMap((value) => {
      if (!value.startsWith("__range__:")) return [];
      const [minimum, maximum] = value.slice("__range__:".length).split(":").map(Number);
      if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) {
        throw new Error(`Invalid numeric range for ${name}.`);
      }
      return [`CAST(ta${index}.trait_value AS REAL) BETWEEN ${Math.min(minimum, maximum)} AND ${Math.max(minimum, maximum)}`];
    });
    const alternatives = [
      exact.length > 0
        ? `ta${index}.trait_value IN (${exact.map(sqlText).join(", ")})`
        : null,
      ...ranges,
    ].filter((value): value is string => value !== null);
    return `EXISTS (SELECT 1 FROM token_attributes ta${index}
      WHERE ta${index}.token_id = t.id
        AND ta${index}.trait_name = ${sqlText(name)}
        AND (${alternatives.join(" OR ")}))`;
  });
}

type TokenRow = Record<string, unknown>;

function tokenFromRow(
  row: TokenRow,
  configuredCurrencies: Array<{ address: string; symbol: string }>,
  selectedCurrency?: { address: string; symbol: string },
): MarketplaceToken {
  const metadata = parseJsonRecord(row.metadata);
  const tokenId = decimal(row.token_id);
  const attributes = parseJsonArray(row.attributes_json).flatMap((attribute) => {
    const name = attribute.trait_name ?? attribute.traitName ?? attribute.trait_type;
    const value = attribute.trait_value ?? attribute.value;
    if (typeof name !== "string" || value === undefined || value === null) return [];
    return [{ traitName: name, value: traitValue(value) }];
  });
  const configuredByAddress = new Map(
    configuredCurrencies.map((currency) => [canonicalFelt(currency.address), currency]),
  );
  const allFloors = parseJsonArray(row.floors_json).flatMap((entry) => {
    if (typeof entry.currency !== "string" || entry.price == null) return [];
    const currency = canonicalFelt(entry.currency);
    return [{
      currency,
      symbol: configuredByAddress.get(currency)?.symbol ?? "UNKNOWN",
      unitPriceAtomic: decimal(entry.price),
    }];
  });
  const floor = allFloors.length > 0
    ? allFloors
    : row.floor_price == null || !selectedCurrency
      ? []
      : [{
          currency: canonicalFelt(selectedCurrency.address),
          symbol: selectedCurrency.symbol,
          unitPriceAtomic: decimal(row.floor_price),
        }];
  const owner = typeof row.owner === "string" ? canonicalFelt(row.owner) : null;
  const name =
    typeof metadata.name === "string" && metadata.name.trim()
      ? metadata.name.trim()
      : typeof row.name === "string" && row.name.trim()
        ? row.name.trim()
        : `Token #${tokenId}`;
  return {
    collection: canonicalFelt(String(row.contract_address)),
    tokenId,
    name,
    description: typeof metadata.description === "string" ? metadata.description : null,
    image:
      typeof metadata.image === "string"
        ? metadata.image
        : typeof metadata.image_url === "string"
          ? metadata.image_url
          : null,
    owner,
    balance: decimal(row.balance ?? (owner ? 1 : 0)),
    firstSeenBlock: firstSeenBlock(row.first_event_id),
    attributes,
    floorByCurrency: floor,
    bestListing: prefixedOrderFromRow(row, "best"),
  };
}

const CANCEL_SELECTOR = canonicalFelt(
  "0x2979287743fc9323bd8e3f513f06468849cf4695b9599f9e20e9704e0077523",
);
const REMOVE_SELECTOR = canonicalFelt(
  "0x1d27a19ebb249760a6490a8d33442a54b5c3c8504068964b74388bfe83458be",
);

function calldataFelts(value: unknown): string[] {
  const values: unknown[] = (() => {
    if (Array.isArray(value)) return value;
    if (typeof value !== "string") return [];
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Some Torii releases serialize calldata as a debug string rather than JSON.
    }
    return value.match(/0x[0-9a-f]+/gi) ?? [];
  })();
  return values.flatMap((entry) => {
    if (typeof entry !== "string" || !/^0x[0-9a-f]+$/i.test(entry)) return [];
    try {
      return [canonicalFelt(entry)];
    } catch {
      return [];
    }
  });
}

function activityType(
  rawType: unknown,
  calldata: string[],
  entrypoints: string[],
): MarketplaceActivity["type"] {
  const normalized = String(rawType ?? "unknown");
  if (normalized === "order_status_changed") {
    const cancel =
      calldata.includes(CANCEL_SELECTOR) || entrypoints.includes("cancel");
    const remove =
      calldata.includes(REMOVE_SELECTOR) || entrypoints.includes("remove");
    if (cancel && !remove) return "order_cancelled";
    if (remove && !cancel) return "order_removed";
    return "order_status_changed";
  }
  const known: MarketplaceActivity["type"][] = [
    "listing_created",
    "offer_created",
    "sale",
    "order_cancelled",
    "order_removed",
    "order_partially_filled",
    "book_updated",
    "transfer",
    "unknown",
  ];
  return known.includes(normalized as MarketplaceActivity["type"])
    ? (normalized as MarketplaceActivity["type"])
    : "unknown";
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string");
  }
  if (typeof value !== "string" || value === "") return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return stringArray(parsed);
  } catch {
    return value.split(",").map((entry) => entry.trim()).filter(Boolean);
  }
}

function nullableFelt(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? canonicalFelt(value) : null;
}

function nullableDecimal(value: unknown): string | null {
  return value == null || value === "" ? null : decimal(value);
}

function activityFromRow(row: OrderRow): MarketplaceActivity {
  const calldata = calldataFelts(row.calldata);
  const entrypoints = stringArray(row.entrypoints).map((entrypoint) =>
    entrypoint.toLowerCase(),
  );
  const type = activityType(row.raw_type, calldata, entrypoints);
  const activityCaller = canonicalFelt(String(row.caller));
  const owner = nullableFelt(row.owner);
  const rawCategory = row.category == null ? null : integer(row.category);
  const from = type === "transfer"
    ? nullableFelt(row.from_address)
    : type === "sale" && rawCategory === 2
      ? owner
      : type === "sale" && rawCategory !== null
        ? activityCaller
        : owner;
  const to = type === "transfer"
    ? nullableFelt(row.to_address)
    : type === "sale" && rawCategory === 2
      ? activityCaller
      : type === "sale" && rawCategory !== null
        ? owner
        : null;
  const transactionHash = row.transaction_hash;
  if (typeof transactionHash !== "string") {
    throw new Error("Torii activity row is missing its transaction hash.");
  }
  return {
    type,
    typeRaw: String(row.type_raw ?? row.raw_type ?? "unknown"),
    collection: nullableFelt(row.collection),
    tokenId: nullableDecimal(row.token_id),
    orderId: nullableDecimal(row.order_id),
    from,
    to,
    currency: nullableFelt(row.currency),
    unitPriceAtomic: nullableDecimal(row.price),
    quantity: nullableDecimal(row.activity_quantity),
    provenance: {
      blockNumber: integer(row.block_number),
      transactionHash: canonicalFelt(transactionHash),
      transactionIndex: integer(row.transaction_index ?? 0),
      eventIndex: integer(row.event_index ?? eventIndex(row.event_id)),
      caller: activityCaller,
    },
    rawSource: {
      eventId: typeof row.event_id === "string" ? row.event_id : null,
      calldata,
      entrypoints,
      rawCalldata: row.calldata ?? null,
      rawType: String(row.type_raw ?? row.raw_type ?? "unknown"),
    },
  };
}

export class ToriiMarketplaceRepository {
  private readonly nowEpochSeconds: () => number;
  private readonly now: () => Date;

  constructor(
    private readonly client: ToriiQueryClient,
    private readonly options: ToriiMarketplaceRepositoryOptions = {},
  ) {
    this.nowEpochSeconds = options.nowEpochSeconds ?? (() => Math.floor(Date.now() / 1_000));
    this.now = options.now ?? (() => new Date());
  }

  async getIndexerStatus(chain: MarketplaceChainAlias): Promise<IndexerStatus> {
    if (!this.options.registry || !this.options.rpc) {
      throw new Error("Registry and RPC client are required for indexer status.");
    }
    const chainConfig = this.options.registry.chains[chain];
    if (!chainConfig) throw new Error(`Chain ${chain} is not configured.`);
    const rows = (await this.client.query(
      chain,
      `SELECT head FROM contracts WHERE id = '${chainConfig.world.address}' LIMIT 1`,
    )) as Array<{ head?: unknown }>;
    const indexedBlock = integer(rows[0]?.head ?? 0);
    const [head, indexedBlockHash] = await Promise.all([
      this.options.rpc.getHead(chain),
      this.options.rpc.getBlockHash(chain, indexedBlock),
    ]);
    return {
      chain,
      indexedBlock,
      indexedBlockHash,
      chainHead: head.blockNumber,
      observedAt: this.now().toISOString(),
    };
  }

  async listCollections(chain: MarketplaceChainAlias): Promise<CollectionSummary[]> {
    if (!this.options.registry) {
      throw new Error("Registry is required for collection summaries.");
    }
    const chainConfig = this.options.registry.chains[chain];
    if (!chainConfig) throw new Error(`Chain ${chain} is not configured.`);
    const nowHex = `0x${BigInt(this.nowEpochSeconds()).toString(16).padStart(16, "0")}`;
    const [tokenRows, listingRows, metadataRows] = (await Promise.all([
      this.client.query(
        chain,
        `SELECT contract_address, COUNT(*) AS token_count FROM tokens WHERE token_id IS NOT NULL GROUP BY contract_address`,
      ),
      this.client.query(
        chain,
        `SELECT collection, currency, COUNT(*) AS listing_count, MIN(price) AS floor_price
FROM "ARCADE-Order"
WHERE category = 2 AND status = 1 AND expiration > '${nowHex}'
GROUP BY collection, currency`,
      ),
      this.client.query(
        chain,
        `SELECT contract_address, metadata FROM tokens WHERE token_id IS NULL OR token_id = ''`,
      ),
    ])) as [
      Array<Record<string, unknown>>,
      Array<Record<string, unknown>>,
      Array<Record<string, unknown>>,
    ];
    const tokenCounts = new Map(
      tokenRows.map((row) => [canonicalFelt(String(row.contract_address)), decimal(row.token_count)]),
    );
    const listingCounts = new Map<string, bigint>();
    const floors = new Map<string, CollectionSummary["floorByCurrency"]>();
    const metadataByCollection = new Map(
      metadataRows.map((row) => [
        canonicalFelt(String(row.contract_address)),
        parseJsonRecord(row.metadata),
      ]),
    );
    for (const row of listingRows) {
      const collection = canonicalFelt(String(row.collection));
      const currency = canonicalFelt(String(row.currency));
      listingCounts.set(
        collection,
        (listingCounts.get(collection) ?? 0n) + BigInt(decimal(row.listing_count)),
      );
      const configuredCurrency = chainConfig.currencies.find(
        (candidate) => canonicalFelt(candidate.address) === currency,
      );
      const collectionFloors = floors.get(collection) ?? [];
      collectionFloors.push({
        currency,
        symbol: configuredCurrency?.symbol ?? "UNKNOWN",
        unitPriceAtomic: decimal(row.floor_price),
      });
      floors.set(collection, collectionFloors);
    }
    return chainConfig.collections.map((collection) => {
      const metadata = metadataByCollection.get(collection.address) ?? {};
      const image = typeof metadata.image === "string"
        ? metadata.image
        : typeof metadata.image_url === "string" ? metadata.image_url : null;
      const bannerImage = typeof metadata.banner_image === "string"
        ? metadata.banner_image
        : typeof metadata.bannerImage === "string" ? metadata.bannerImage : null;
      return {
        address: collection.address,
        name: typeof metadata.name === "string" && metadata.name.trim()
          ? metadata.name.trim()
          : collection.name,
        description: typeof metadata.description === "string" ? metadata.description : null,
        image,
        bannerImage,
        rawMetadata: metadata,
        standard: collection.standard,
        deploymentBlock: collection.startBlock,
        verified: true,
        tokenCount: tokenCounts.get(collection.address) ?? "0",
        listingCount: (listingCounts.get(collection.address) ?? 0n).toString(),
        floorByCurrency: (floors.get(collection.address) ?? []).sort((left, right) =>
          left.symbol.localeCompare(right.symbol),
        ),
      };
    });
  }

  async getBook(chain: MarketplaceChainAlias): Promise<MarketplaceBook> {
    const rows = (await this.client.query(
      chain,
      `SELECT
  b.*,
  e.id AS updated_event_id,
  tx.block_number AS updated_block_number,
  e.transaction_hash AS updated_transaction_hash,
  tx.sender_address AS updated_caller,
  COALESCE((SELECT COUNT(*) FROM transactions tx2 WHERE tx2.block_number = tx.block_number AND tx2.rowid < tx.rowid), 0) AS updated_transaction_index
FROM "ARCADE-Book" b
LEFT JOIN events e ON e.id = b.internal_event_id
LEFT JOIN transactions tx ON tx.transaction_hash = e.transaction_hash
ORDER BY b.id ASC
LIMIT 1`,
    )) as OrderRow[];
    const row = rows[0];
    if (!row) throw new Error("Marketplace Book has not been indexed.");
    return {
      id: decimal(row.id),
      version: decimal(row.version),
      paused: boolean(row.paused),
      royaltiesEnabled: boolean(row.royalties),
      counter: decimal(row.counter),
      feeNumerator: decimal(row.fee_num),
      feeDenominator: "10000",
      feeReceiver: canonicalFelt(String(row.fee_receiver)),
      updatedAt: provenance(row, "updated"),
    };
  }

  async lookupOrders(
    chain: MarketplaceChainAlias,
    requestedKeys: OrderKey[],
  ): Promise<OrderLookupResult[]> {
    const keys = requestedKeys.map(normalizedKey);
    if (keys.length === 0) return [];

    const predicates = keys.map(
      (key) =>
        `(o.id = ${key.id} AND o.collection = '${key.collection}' AND o.token_id = '${tokenIdForSql(key.tokenId)}')`,
    );
    const sql = `SELECT
  o.*,
  COALESCE(first_state.quantity, o.quantity) AS original_quantity,
  ce.id AS created_event_id,
  ct.block_number AS created_block_number,
  ce.transaction_hash AS created_transaction_hash,
  ct.sender_address AS created_caller,
  COALESCE((SELECT COUNT(*) FROM transactions ct2 WHERE ct2.block_number = ct.block_number AND ct2.rowid < ct.rowid), 0) AS created_transaction_index,
  ue.id AS updated_event_id,
  ut.block_number AS updated_block_number,
  ue.transaction_hash AS updated_transaction_hash,
  ut.sender_address AS updated_caller,
  COALESCE((SELECT COUNT(*) FROM transactions ut2 WHERE ut2.block_number = ut.block_number AND ut2.rowid < ut.rowid), 0) AS updated_transaction_index
FROM "ARCADE-Order" o
LEFT JOIN events ue ON ue.id = o.internal_event_id
LEFT JOIN transactions ut ON ut.transaction_hash = ue.transaction_hash
LEFT JOIN marketplace_order_audit first_state
  ON first_state.entity_id = o.internal_entity_id
  AND first_state.sequence = (
    SELECT MIN(first_sequence.sequence)
    FROM marketplace_order_audit first_sequence
    WHERE first_sequence.entity_id = o.internal_entity_id
  )
LEFT JOIN events ce ON ce.id = COALESCE(first_state.event_id, o.internal_event_id)
LEFT JOIN transactions ct ON ct.transaction_hash = ce.transaction_hash
WHERE ${predicates.join(" OR ")}`;

    const rows = (await this.client.query(chain, sql)) as OrderRow[];
    const byKey = new Map<string, MarketplaceOrder>();
    for (const row of rows) {
      const order = orderFromRow(row);
      byKey.set(
        orderKeyId({ id: order.id, collection: order.collection, tokenId: order.tokenId }),
        order,
      );
    }

    return keys.map((key) => ({ key, order: byKey.get(orderKeyId(key)) ?? null }));
  }

  async listOrders(
    chain: MarketplaceChainAlias,
    rawCollection: string,
    options: OrderListOptions,
  ): Promise<{ items: MarketplaceOrder[]; nextCursor: string | null }> {
    const collection = canonicalFelt(rawCollection);
    const currency = canonicalFelt(options.currency);
    const conditions = [
      `o.collection = '${collection}'`,
      `o.currency = '${currency}'`,
    ];
    if (options.tokenId !== null) {
      conditions.push(`o.token_id = '${tokenIdForSql(options.tokenId)}'`);
    }
    const requestedCategory = categoryCode(options.category);
    if (requestedCategory !== null) conditions.push(`o.category = ${requestedCategory}`);
    const requestedStatus = statusCode(options.status);
    if (requestedStatus !== null) conditions.push(`o.status = ${requestedStatus}`);
    if (options.activeSellOnly) {
      const nowHex = `0x${BigInt(this.nowEpochSeconds()).toString(16).padStart(16, "0")}`;
      conditions.push("o.category = 2", "o.status = 1", `o.expiration > '${nowHex}'`);
    }

    const cursor = options.cursor
      ? decodeCursor<{ orderId: string; collection: string; tokenId: string }>(
          options.cursor,
          "orders",
        )
      : null;
    if (cursor) {
      const cursorCollection = canonicalFelt(cursor.collection);
      conditions.push(`(
        o.id < ${decimal(cursor.orderId)} OR
        (o.id = ${decimal(cursor.orderId)} AND o.collection < '${cursorCollection}') OR
        (o.id = ${decimal(cursor.orderId)} AND o.collection = '${cursorCollection}' AND o.token_id < '${tokenIdForSql(cursor.tokenId)}')
      )`);
    }

    const sql = `SELECT
  o.*,
  COALESCE(first_state.quantity, o.quantity) AS original_quantity,
  ce.id AS created_event_id,
  ct.block_number AS created_block_number,
  ce.transaction_hash AS created_transaction_hash,
  ct.sender_address AS created_caller,
  COALESCE((SELECT COUNT(*) FROM transactions ct2 WHERE ct2.block_number = ct.block_number AND ct2.rowid < ct.rowid), 0) AS created_transaction_index,
  ue.id AS updated_event_id,
  ut.block_number AS updated_block_number,
  ue.transaction_hash AS updated_transaction_hash,
  ut.sender_address AS updated_caller,
  COALESCE((SELECT COUNT(*) FROM transactions ut2 WHERE ut2.block_number = ut.block_number AND ut2.rowid < ut.rowid), 0) AS updated_transaction_index
FROM "ARCADE-Order" o
LEFT JOIN events ue ON ue.id = o.internal_event_id
LEFT JOIN transactions ut ON ut.transaction_hash = ue.transaction_hash
LEFT JOIN marketplace_order_audit first_state
  ON first_state.entity_id = o.internal_entity_id
  AND first_state.sequence = (
    SELECT MIN(first_sequence.sequence)
    FROM marketplace_order_audit first_sequence
    WHERE first_sequence.entity_id = o.internal_entity_id
  )
LEFT JOIN events ce ON ce.id = COALESCE(first_state.event_id, o.internal_event_id)
LEFT JOIN transactions ct ON ct.transaction_hash = ce.transaction_hash
WHERE ${conditions.join(" AND ")}
ORDER BY o.id DESC, o.collection DESC, o.token_id DESC
LIMIT ${options.limit + 1}`;
    const rows = (await this.client.query(chain, sql)) as OrderRow[];
    const pageRows = rows.slice(0, options.limit);
    const items = pageRows.map(orderFromRow);
    const last = items.at(-1);
    const nextCursor = rows.length > options.limit && last
      ? encodeCursor("orders", {
          orderId: last.id,
          collection: last.collection,
          tokenId: last.tokenId,
        })
      : null;
    return { items, nextCursor };
  }

  async listTokens(
    chain: MarketplaceChainAlias,
    rawCollection: string,
    options: TokenListOptions,
  ): Promise<{ items: MarketplaceToken[]; nextCursor: string | null }> {
    const collection = canonicalFelt(rawCollection);
    const currency = canonicalFelt(options.currency);
    const selectedCurrency = this.options.currencies?.[chain]?.find(
      (candidate) => canonicalFelt(candidate.address) === currency,
    ) ?? { address: currency, symbol: "UNKNOWN" };
    const sort = sortDefinition(options.sort);
    const cursor = options.cursor
      ? decodeCursor<{ sortValue: string | null; tokenId: string }>(
          options.cursor,
          `tokens:${options.sort}:${currency}`,
        )
      : null;
    const predicates = [
      `t.contract_address = '${collection}'`,
      ...traitPredicates(options.traits),
    ];
    if (options.tokenIds.length > 0) {
      predicates.push(
        `t.token_id IN (${[...new Set(options.tokenIds)]
          .map((tokenId) => sqlText(tokenIdForSql(decimal(tokenId))))
          .join(", ")})`,
      );
    }
    if (cursor) {
      const comparison = sort.direction === "ASC" ? ">" : "<";
      const tokenComparison = `t.token_id ${comparison} '${tokenIdForSql(cursor.tokenId)}'`;
      if (cursor.sortValue === null) {
        predicates.push(`((${sort.expression}) IS NULL AND ${tokenComparison})`);
      } else {
        const cursorValue = sortCursorLiteral(sort, cursor.sortValue);
        predicates.push(
          `(((${sort.expression}) IS NULL) OR ((${sort.expression}) ${comparison} ${cursorValue}) OR ((${sort.expression}) = ${cursorValue} AND ${tokenComparison}))`,
        );
      }
    }
    const nowHex = `0x${BigInt(this.nowEpochSeconds()).toString(16).padStart(16, "0")}`;
    const sql = `SELECT
  t.contract_address,
  t.token_id,
  t.name,
  t.metadata,
  (SELECT b.account_address FROM token_balances b WHERE b.token_id = t.id AND b.balance NOT IN ('0', '0x0', '0x00000000000000000000000000000000') ORDER BY b.account_address LIMIT 1) AS owner,
  COALESCE((SELECT b.balance FROM token_balances b WHERE b.token_id = t.id AND b.balance NOT IN ('0', '0x0', '0x00000000000000000000000000000000') ORDER BY b.account_address LIMIT 1), '0') AS balance,
  (SELECT MIN(tt.event_id) FROM token_transfers tt WHERE tt.token_id = t.id) AS first_event_id,
  COALESCE((SELECT json_group_array(json_object('trait_name', ta.trait_name, 'trait_value', ta.trait_value)) FROM token_attributes ta WHERE ta.token_id = t.id), '[]') AS attributes_json,
  f.floor_price,
  ${sort.expression} AS sort_value,
  ${bestListingProjection()}
FROM tokens t
LEFT JOIN (
  SELECT collection, token_id, MIN(price) AS floor_price
  FROM "ARCADE-Order"
  WHERE category = 2 AND status = 1 AND currency = '${currency}' AND expiration > '${nowHex}'
  GROUP BY collection, token_id
) f ON f.collection = t.contract_address AND f.token_id = t.token_id
${bestListingJoins(currency, nowHex)}
${sort.join}
WHERE ${predicates.join(" AND ")}
ORDER BY (${sort.expression}) IS NULL ASC, (${sort.expression}) ${sort.direction}, t.token_id ${sort.direction}
LIMIT ${options.limit + 1}`;

    const rows = (await this.client.query(chain, sql)) as TokenRow[];
    const pageRows = rows.slice(0, options.limit);
    const items = pageRows.map((row) =>
      tokenFromRow(row, [selectedCurrency], selectedCurrency),
    );
    const lastRow = pageRows.at(-1);
    const nextCursor = rows.length > options.limit && lastRow
      ? encodeCursor(`tokens:${options.sort}:${currency}`, {
          sortValue: lastRow.sort_value == null ? null : String(lastRow.sort_value),
          tokenId: decimal(lastRow.token_id),
        })
      : null;
    return { items, nextCursor };
  }

  async listTraits(
    chain: MarketplaceChainAlias,
    rawCollection: string,
    traitName: string | null,
    otherTraits: string[],
  ): Promise<TraitFacet[]> {
    const collection = canonicalFelt(rawCollection);
    const filters = traitPredicates(
      traitName
        ? otherTraits.filter((entry) => entry.slice(0, entry.indexOf(":")) !== traitName)
        : otherTraits,
    );
    const conditions = [
      `t.contract_address = '${collection}'`,
      ...(traitName ? [`a.trait_name = ${sqlText(traitName)}`] : []),
      ...filters,
    ];
    const sql = `SELECT a.trait_name, a.trait_value, COUNT(DISTINCT a.token_id) AS value_count
FROM token_attributes a
JOIN tokens t ON t.id = a.token_id
WHERE ${conditions.join(" AND ")}
GROUP BY a.trait_name, a.trait_value
ORDER BY a.trait_name ASC, value_count DESC, a.trait_value ASC`;
    const rows = (await this.client.query(chain, sql)) as Array<Record<string, unknown>>;
    const grouped = new Map<string, TraitFacet["values"]>();
    for (const row of rows) {
      const name = String(row.trait_name);
      const values = grouped.get(name) ?? [];
      values.push({
        value: traitValue(row.trait_value),
        count: decimal(row.value_count),
      });
      grouped.set(name, values);
    }
    return [...grouped.entries()].map(([name, values]) => {
      const allNumbers = values.every((entry) => typeof entry.value === "number");
      const allBooleans = values.every((entry) => typeof entry.value === "boolean");
      if (allNumbers) {
        const numericValues = values.map((entry) => entry.value as number);
        return {
          name,
          kind: "number" as const,
          values,
          min: Math.min(...numericValues),
          max: Math.max(...numericValues),
        };
      }
      return {
        name,
        kind: allBooleans ? ("boolean" as const) : ("string" as const),
        values,
      };
    });
  }

  async getToken(
    chain: MarketplaceChainAlias,
    rawCollection: string,
    rawTokenId: string,
    rawCurrency: string,
  ): Promise<MarketplaceToken | null> {
    const collection = canonicalFelt(rawCollection);
    const tokenId = decimal(rawTokenId);
    const currency = canonicalFelt(rawCurrency);
    const configuredCurrencies = this.options.currencies?.[chain] ?? [];
    const selectedCurrency = configuredCurrencies.find(
      (candidate) => canonicalFelt(candidate.address) === currency,
    ) ?? { address: currency, symbol: "UNKNOWN" };
    const nowHex = `0x${BigInt(this.nowEpochSeconds()).toString(16).padStart(16, "0")}`;
    const rows = (await this.client.query(
      chain,
      `SELECT
  t.contract_address,
  t.token_id,
  t.name,
  t.metadata,
  (SELECT b.account_address FROM token_balances b WHERE b.token_id = t.id AND ltrim(lower(replace(b.balance, '0x', '')), '0') <> '' ORDER BY b.account_address LIMIT 1) AS owner,
  COALESCE((SELECT b.balance FROM token_balances b WHERE b.token_id = t.id AND ltrim(lower(replace(b.balance, '0x', '')), '0') <> '' ORDER BY b.account_address LIMIT 1), '0') AS balance,
  (SELECT MIN(tt.event_id) FROM token_transfers tt WHERE tt.token_id = t.id) AS first_event_id,
  COALESCE((SELECT json_group_array(json_object('trait_name', ta.trait_name, 'trait_value', ta.trait_value)) FROM token_attributes ta WHERE ta.token_id = t.id), '[]') AS attributes_json,
  COALESCE((SELECT json_group_array(json_object('currency', floor.currency, 'price', floor.floor_price)) FROM (
    SELECT o.currency, MIN(o.price) AS floor_price
    FROM "ARCADE-Order" o
    WHERE o.collection = t.contract_address
      AND o.token_id = t.token_id
      AND o.category = 2
      AND o.status = 1
      AND o.expiration > '${nowHex}'
    GROUP BY o.currency
  ) floor), '[]') AS floors_json,
  (SELECT MIN(o.price) FROM "ARCADE-Order" o WHERE o.collection = t.contract_address AND o.token_id = t.token_id AND o.currency = '${currency}' AND o.category = 2 AND o.status = 1 AND o.expiration > '${nowHex}') AS floor_price,
  ${bestListingProjection()}
FROM tokens t
${bestListingJoins(currency, nowHex)}
WHERE t.contract_address = '${collection}' AND t.token_id = '${tokenIdForSql(tokenId)}'
LIMIT 1`,
    )) as TokenRow[];
    const row = rows[0];
    return row
      ? tokenFromRow(
          row,
          configuredCurrencies.length > 0 ? configuredCurrencies : [selectedCurrency],
          selectedCurrency,
        )
      : null;
  }

  async listHoldings(
    chain: MarketplaceChainAlias,
    rawAccount: string,
    rawCollection: string | null,
    options: PageOptions,
  ): Promise<{ items: MarketplaceHolding[]; nextCursor: string | null }> {
    const account = canonicalFelt(rawAccount);
    const collection = rawCollection ? canonicalFelt(rawCollection) : null;
    const cursorKind = `holdings:${account}:${collection ?? "all"}`;
    const cursor = options.cursor
      ? decodeCursor<{ collection: string; tokenId: string }>(options.cursor, cursorKind)
      : null;
    const predicates = [
      `b.account_address = '${account}'`,
      `ltrim(lower(replace(b.balance, '0x', '')), '0') <> ''`,
      ...(collection ? [`b.contract_address = '${collection}'`] : []),
    ];
    if (cursor) {
      const cursorCollection = canonicalFelt(cursor.collection);
      predicates.push(`(
        b.contract_address > '${cursorCollection}' OR
        (b.contract_address = '${cursorCollection}' AND t.token_id > '${tokenIdForSql(cursor.tokenId)}')
      )`);
    }
    const nowHex = `0x${BigInt(this.nowEpochSeconds()).toString(16).padStart(16, "0")}`;
    const rows = (await this.client.query(
      chain,
      `SELECT
  b.account_address,
  b.contract_address,
  t.token_id,
  b.balance,
  t.name,
  t.metadata,
  b.account_address AS owner,
  (SELECT MIN(tt.event_id) FROM token_transfers tt WHERE tt.token_id = t.id) AS first_event_id,
  COALESCE((SELECT json_group_array(json_object('trait_name', ta.trait_name, 'trait_value', ta.trait_value)) FROM token_attributes ta WHERE ta.token_id = t.id), '[]') AS attributes_json,
  COALESCE((SELECT json_group_array(json_object('currency', floor.currency, 'price', floor.floor_price)) FROM (
    SELECT o.currency, MIN(o.price) AS floor_price
    FROM "ARCADE-Order" o
    WHERE o.collection = t.contract_address
      AND o.token_id = t.token_id
      AND o.category = 2
      AND o.status = 1
      AND o.expiration > '${nowHex}'
    GROUP BY o.currency
  ) floor), '[]') AS floors_json
FROM token_balances b
JOIN tokens t ON t.id = b.token_id
WHERE ${predicates.join(" AND ")}
ORDER BY b.contract_address ASC, t.token_id ASC
LIMIT ${options.limit + 1}`,
    )) as TokenRow[];
    const pageRows = rows.slice(0, options.limit);
    const configuredCurrencies = this.options.currencies?.[chain] ?? [];
    const items = pageRows.map((row) => {
      const token = tokenFromRow(row, configuredCurrencies);
      return {
        account,
        collection: token.collection,
        tokenId: token.tokenId,
        balance: decimal(row.balance),
        token,
      };
    });
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        rows.length > options.limit && last
          ? encodeCursor(cursorKind, {
              collection: last.collection,
              tokenId: last.tokenId,
            })
          : null,
    };
  }

  async listActivity(
    chain: MarketplaceChainAlias,
    rawCollection: string,
    rawTokenId: string,
    options: PageOptions,
  ): Promise<{ items: MarketplaceActivity[]; nextCursor: string | null }> {
    const collection = canonicalFelt(rawCollection);
    const tokenId = decimal(rawTokenId);
    const cursorKind = `activity:${collection}:${tokenId}`;
    const cursor = options.cursor
      ? decodeCursor<{
          blockNumber: number;
          transactionIndex: number;
          eventIndex: number;
        }>(options.cursor, cursorKind)
      : null;
    const predicates = [
      `collection = '${collection}'`,
      `token_id = '${tokenIdForSql(tokenId)}'`,
    ];
    if (cursor) {
      predicates.push(`(
        block_number < ${cursor.blockNumber} OR
        (block_number = ${cursor.blockNumber} AND transaction_index < ${cursor.transactionIndex}) OR
        (block_number = ${cursor.blockNumber} AND transaction_index = ${cursor.transactionIndex} AND event_index < ${cursor.eventIndex})
      )`);
    }
    const marketplaceAddress = this.options.registry?.chains[chain]?.marketplace.address;
    const marketplaceCallFilter = marketplaceAddress
      ? `AND call.contract_address = '${canonicalFelt(marketplaceAddress)}'`
      : "";
    const rows = (await this.client.query(
      chain,
      `SELECT
  activity.*,
  COALESCE((
    SELECT json_group_array(call.entrypoint)
    FROM transaction_calls call
    WHERE call.transaction_hash = activity.transaction_hash
      ${marketplaceCallFilter}
  ), '[]') AS entrypoints,
  COALESCE((
    SELECT group_concat(call.calldata, ' ')
    FROM transaction_calls call
    WHERE call.transaction_hash = activity.transaction_hash
      ${marketplaceCallFilter}
  ), '[]') AS calldata
FROM marketplace_token_activity_v1 activity
WHERE ${predicates.join(" AND ")}
ORDER BY block_number DESC, transaction_index DESC, event_index DESC
LIMIT ${options.limit + 1}`,
    )) as OrderRow[];
    const pageRows = rows.slice(0, options.limit);
    const items = pageRows.map(activityFromRow);
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        rows.length > options.limit && last
          ? encodeCursor(cursorKind, {
              blockNumber: last.provenance.blockNumber,
              transactionIndex: last.provenance.transactionIndex,
              eventIndex: last.provenance.eventIndex,
            })
          : null,
    };
  }

  async getDetailedIndexerStatus(
    chain: MarketplaceChainAlias,
  ): Promise<MarketplaceIndexerStatus> {
    const [status, failureRows] = await Promise.all([
      this.getIndexerStatus(chain),
      this.client.query(
        chain,
        "SELECT COUNT(*) AS failure_count FROM marketplace_metadata_failures WHERE resolved_at IS NULL",
      ) as Promise<Array<{ failure_count?: unknown }>>,
    ]);
    const lagBlocks = Math.max(0, status.chainHead - status.indexedBlock);
    return {
      buildVersion: this.options.buildVersion ?? "torii-fe3ed0ffa1b0",
      replayVersion: this.options.replayVersion ?? "unqualified",
      databaseSchemaVersion:
        this.options.databaseSchemaVersion ?? "torii-1.8.16+marketplace.1",
      indexedBlock: status.indexedBlock,
      indexedBlockHash: status.indexedBlockHash,
      chainHead: status.chainHead,
      lagBlocks,
      finality: "accepted_l2",
      metadataFailures: integer(failureRows[0]?.failure_count ?? 0),
      safeForCheckout: lagBlocks <= (this.options.checkoutLagLimit ?? 2),
    };
  }
}
