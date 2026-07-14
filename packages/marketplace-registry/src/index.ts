import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

const FeltSchema = Type.String({ pattern: "^0x[0-9a-fA-F]{1,64}$" });
const STARK_FIELD_PRIME = (1n << 251n) + 17n * (1n << 192n) + 1n;

const ContractSchema = Type.Object(
  {
    address: FeltSchema,
    classHash: FeltSchema,
    startBlock: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

const CurrencySchema = Type.Object(
  {
    address: FeltSchema,
    symbol: Type.String({ minLength: 1, maxLength: 16 }),
    decimals: Type.Integer({ minimum: 0, maximum: 255 }),
    icon: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

const CollectionSchema = Type.Object(
  {
    address: FeltSchema,
    name: Type.String({ minLength: 1 }),
    standard: Type.Union([Type.Literal("ERC721"), Type.Literal("ERC1155")]),
    startBlock: Type.Integer({ minimum: 0 }),
    metadata: Type.Object(
      {
        enabled: Type.Boolean(),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

const ChainSchema = Type.Object(
  {
    chainId: FeltSchema,
    world: ContractSchema,
    marketplace: ContractSchema,
    currencies: Type.Array(CurrencySchema, { minItems: 1 }),
    collections: Type.Array(CollectionSchema),
  },
  { additionalProperties: false },
);

export const MarketplaceRegistrySchema = Type.Object(
  {
    schemaVersion: Type.String({ pattern: "^[0-9]+\\.[0-9]+\\.[0-9]+$" }),
    chains: Type.Partial(
      Type.Object(
        {
          SN_MAIN: ChainSchema,
          SN_SEPOLIA: ChainSchema,
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

export type MarketplaceRegistry = Static<typeof MarketplaceRegistrySchema>;
export type MarketplaceChain = NonNullable<
  MarketplaceRegistry["chains"][keyof MarketplaceRegistry["chains"]]
>;
export type MarketplaceChainAlias = keyof MarketplaceRegistry["chains"];

export class MarketplaceRegistryError extends Error {
  constructor(readonly issues: string[]) {
    super(`Invalid marketplace registry:\n${issues.map((issue) => `- ${issue}`).join("\n")}`);
    this.name = "MarketplaceRegistryError";
  }
}

export function canonicalFelt(value: string): string {
  let parsed: bigint;
  try {
    parsed = BigInt(value);
  } catch {
    throw new MarketplaceRegistryError([`Felt ${value} is not valid hexadecimal.`]);
  }
  if (parsed === 0n) {
    throw new MarketplaceRegistryError([`Felt ${value} must not be zero.`]);
  }
  if (parsed >= STARK_FIELD_PRIME) {
    throw new MarketplaceRegistryError([
      `Felt ${value} is outside the Starknet field range.`,
    ]);
  }
  return `0x${parsed.toString(16).padStart(64, "0")}`;
}

function normalizeChain(chain: MarketplaceChain): MarketplaceChain {
  return {
    ...chain,
    world: {
      ...chain.world,
      address: canonicalFelt(chain.world.address),
      classHash: canonicalFelt(chain.world.classHash),
    },
    marketplace: {
      ...chain.marketplace,
      address: canonicalFelt(chain.marketplace.address),
      classHash: canonicalFelt(chain.marketplace.classHash),
    },
    currencies: chain.currencies.map((currency) => ({
      ...currency,
      address: canonicalFelt(currency.address),
    })),
    collections: chain.collections.map((collection) => ({
      ...collection,
      address: canonicalFelt(collection.address),
    })),
  };
}

function assertChainSemantics(
  alias: MarketplaceChainAlias,
  chain: MarketplaceChain,
): void {
  const collectionAddresses = new Set<string>();
  for (const collection of chain.collections) {
    const address = canonicalFelt(collection.address);
    if (collectionAddresses.has(address)) {
      throw new MarketplaceRegistryError([
        `${alias} has duplicate collection address ${address}.`,
      ]);
    }
    collectionAddresses.add(address);
  }

  const currencyAddresses = new Set<string>();
  const currencySymbols = new Set<string>();
  for (const currency of chain.currencies) {
    const address = canonicalFelt(currency.address);
    const symbol = currency.symbol.trim().toUpperCase();
    if (currencyAddresses.has(address) || currencySymbols.has(symbol)) {
      throw new MarketplaceRegistryError([
        `${alias} has duplicate currency ${currency.symbol} at ${address}.`,
      ]);
    }
    currencyAddresses.add(address);
    currencySymbols.add(symbol);
  }
}

export function parseMarketplaceRegistry(input: unknown): MarketplaceRegistry {
  if (!Value.Check(MarketplaceRegistrySchema, input)) {
    const issues = [...Value.Errors(MarketplaceRegistrySchema, input)].map(
      (error) => `${error.path || "/"}: ${error.message}`,
    );
    throw new MarketplaceRegistryError(issues);
  }

  const registry = structuredClone(input) as MarketplaceRegistry;
  const chainEntries = Object.entries(registry.chains) as Array<
    [MarketplaceChainAlias, MarketplaceChain]
  >;
  if (chainEntries.length === 0) {
    throw new MarketplaceRegistryError(["At least one chain is required."]);
  }

  for (const [alias, chain] of chainEntries) {
    assertChainSemantics(alias, chain);
  }

  return {
    ...registry,
    chains: Object.fromEntries(
      chainEntries.map(([alias, chain]) => [alias, normalizeChain(chain)]),
    ) as MarketplaceRegistry["chains"],
  };
}

export function generateToriiConfig(
  registry: MarketplaceRegistry,
  alias: MarketplaceChainAlias,
): string {
  const chain = registry.chains[alias];
  if (!chain) {
    throw new MarketplaceRegistryError([`Chain ${alias} is not configured.`]);
  }

  const contracts = chain.collections
    .map(
      (collection) =>
        `  "${collection.standard}:${collection.address}:${collection.startBlock}"`,
    )
    .join(",\n");
  const metadataCollections = chain.collections
    .filter((collection) => collection.metadata.enabled)
    .map((collection) => collection.address);
  const metadataConcurrency = alias === "SN_MAIN" ? 8 : 4;
  const orderAuditHook = [
    "model_updated:ARCADE-Order:INSERT OR IGNORE INTO marketplace_order_audit",
    "(entity_id, event_id, order_id, collection, token_id, royalties, category, status, expiration, quantity, price, currency, owner)",
    "SELECT internal_entity_id, internal_event_id, id, collection, token_id, royalties, category, status, expiration, quantity, price, currency, owner",
    "FROM [ARCADE-Order] WHERE internal_entity_id = ?",
  ].join(" ");
  const bookAuditHook = [
    "model_updated:ARCADE-Book:INSERT OR IGNORE INTO marketplace_book_audit",
    "(entity_id, event_id, book_id, version, paused, royalties, counter, fee_num, fee_receiver)",
    "SELECT internal_entity_id, internal_event_id, id, version, paused, royalties, counter, fee_num, fee_receiver",
    "FROM [ARCADE-Book] WHERE internal_entity_id = ?",
  ].join(" ");

  return [
    `world_address = "${chain.world.address}"`,
    'rpc = "${TORII_RPC_URL}"',
    'db_dir = "${TORII_DB_DIR}"',
    "",
    "[server]",
    'http_addr = "0.0.0.0"',
    "http_port = 8080",
    'http_cors_origins = []',
    "",
    "[indexing]",
    `world_block = ${chain.world.startBlock}`,
    "preconfirmed = false",
    "transactions = true",
    "transaction_receipts = true",
    "controllers = false",
    "strict_model_reader = true",
    "external_contracts = true",
    'namespaces = ["ARCADE"]',
    "contracts = [",
    contracts,
    "]",
    "",
    "[erc]",
    `max_metadata_tasks = ${metadataConcurrency}`,
    "token_attributes = true",
    "trait_counts = true",
    `metadata_updates = ${metadataCollections.length > 0}`,
    `metadata_update_whitelist = ${JSON.stringify(metadataCollections)}`,
    "metadata_updates_only_at_head = true",
    "async_metadata_updates = true",
    "",
    "[sql]",
    'historical = ["ARCADE-Order", "ARCADE-Book"]',
    'migrations = "/etc/torii/migrations"',
    "hooks = [",
    `  ${JSON.stringify(orderAuditHook)},`,
    `  ${JSON.stringify(bookAuditHook)}`,
    "]",
    "",
  ].join("\n");
}
