import generatedRegistry from "@/lib/marketplace/generated-registry.json";
import {
  isOwnedReadEnabled,
  parseMarketplaceReadRollout,
  type MarketplaceReadRollout,
  type MarketplaceReadSurface,
} from "@/lib/marketplace/rollout";

const CHAIN_ALIASES = ["SN_MAIN", "SN_SEPOLIA"] as const;
const DEFAULT_CHAIN_ALIAS = "SN_SEPOLIA";
const DEFAULT_API_BASE_URL = "http://localhost:3001";

export type MarketplaceChainAlias = (typeof CHAIN_ALIASES)[number];

export type SeedCollection = {
  address: string;
  name: string;
  /** Temporary compatibility field. Project routing is intentionally ignored. */
  projectId?: string;
};

export type MarketplaceCurrency = {
  address: string;
  symbol: string;
  decimals: number;
  icon: string;
};

export type MarketplaceRuntimeConfig = {
  chainLabel: MarketplaceChainAlias;
  chainId: string;
  apiBaseUrl: string;
  readRollout: MarketplaceReadRollout;
  worldAddress: string;
  marketplaceAddress: string;
  schemaVersion: string;
  currencies: MarketplaceCurrency[];
  collections: SeedCollection[];
  warnings: string[];
  isReadSurfaceEnabled(surface: MarketplaceReadSurface): boolean;
};

type MarketplaceEnv = Partial<
  Record<
    | "NEXT_PUBLIC_MARKETPLACE_CHAIN_ID"
    | "NEXT_PUBLIC_MARKETPLACE_COLLECTIONS"
    | "NEXT_PUBLIC_MARKETPLACE_API_BASE_URL"
    | "NEXT_PUBLIC_MARKETPLACE_READ_ROLLOUT"
    | "MARKETPLACE_READ_ROLLOUT",
    string | undefined
  >
>;

type GeneratedChain = (typeof generatedRegistry.chains)[MarketplaceChainAlias];

function resolveChain(value: string | undefined): {
  chainLabel: MarketplaceChainAlias;
  chain: GeneratedChain;
} {
  const normalized = value?.trim() || DEFAULT_CHAIN_ALIAS;
  const alias = CHAIN_ALIASES.find(
    (candidate) =>
      candidate === normalized ||
      generatedRegistry.chains[candidate].chainId.toLowerCase() === normalized.toLowerCase(),
  );
  if (!alias) {
    throw new Error(
      `NEXT_PUBLIC_MARKETPLACE_CHAIN_ID must be SN_MAIN, SN_SEPOLIA, or a matching checked-in chain felt; received ${JSON.stringify(value)}.`,
    );
  }
  return { chainLabel: alias, chain: generatedRegistry.chains[alias] };
}

function parseCollections(value: string | undefined, chain: GeneratedChain, warnings: string[]) {
  if (value === undefined) {
    return chain.collections.map((collection) => ({
      address: collection.address,
      name: collection.name,
      projectId: undefined,
    }));
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry) => {
      const [address, name] = entry.split("|").map((part) => part?.trim());
      if (!address || !name) {
        warnings.push(
          `Skipping malformed collection entry ${JSON.stringify(entry)}. Expected address|name|projectId.`,
        );
        return [];
      }
      return [{
        address,
        name: name === "Beasts V2.1" ? "Beasts" : name,
        projectId: undefined,
      }];
    });
}

function parseApiBaseUrl(value: string | undefined): string {
  const raw = value?.trim() || DEFAULT_API_BASE_URL;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("NEXT_PUBLIC_MARKETPLACE_API_BASE_URL must be an absolute HTTP(S) URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_MARKETPLACE_API_BASE_URL must use HTTP or HTTPS.");
  }
  return parsed.toString().replace(/\/$/, "");
}

export function getMarketplaceRuntimeConfigFromEnv(
  env: MarketplaceEnv,
): MarketplaceRuntimeConfig {
  const warnings: string[] = [];
  const { chainLabel, chain } = resolveChain(env.NEXT_PUBLIC_MARKETPLACE_CHAIN_ID);
  const readRollout = parseMarketplaceReadRollout(
    env.MARKETPLACE_READ_ROLLOUT ?? env.NEXT_PUBLIC_MARKETPLACE_READ_ROLLOUT,
  );
  return {
    chainLabel,
    chainId: chain.chainId,
    apiBaseUrl: parseApiBaseUrl(env.NEXT_PUBLIC_MARKETPLACE_API_BASE_URL),
    readRollout,
    worldAddress: chain.world.address,
    marketplaceAddress: chain.marketplace.address,
    schemaVersion: generatedRegistry.schemaVersion,
    currencies: chain.currencies,
    collections: parseCollections(
      env.NEXT_PUBLIC_MARKETPLACE_COLLECTIONS,
      chain,
      warnings,
    ),
    warnings,
    isReadSurfaceEnabled: (surface) => isOwnedReadEnabled(readRollout, surface),
  };
}

let cachedConfig: MarketplaceRuntimeConfig | null = null;

export function getMarketplaceRuntimeConfig(): MarketplaceRuntimeConfig {
  if (!cachedConfig) {
    cachedConfig = getMarketplaceRuntimeConfigFromEnv({
      NEXT_PUBLIC_MARKETPLACE_CHAIN_ID: process.env.NEXT_PUBLIC_MARKETPLACE_CHAIN_ID,
      NEXT_PUBLIC_MARKETPLACE_COLLECTIONS:
        process.env.NEXT_PUBLIC_MARKETPLACE_COLLECTIONS,
      NEXT_PUBLIC_MARKETPLACE_API_BASE_URL:
        process.env.NEXT_PUBLIC_MARKETPLACE_API_BASE_URL,
      NEXT_PUBLIC_MARKETPLACE_READ_ROLLOUT:
        process.env.NEXT_PUBLIC_MARKETPLACE_READ_ROLLOUT,
    });
  }
  return cachedConfig;
}

/** @internal — exposed for tests only. */
export function _resetConfigCache() {
  cachedConfig = null;
}
