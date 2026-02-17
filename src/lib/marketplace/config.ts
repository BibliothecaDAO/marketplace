import type { MarketplaceClientConfig } from "@cartridge/arcade/marketplace";

const CHAIN_IDS = {
  SN_MAIN: "0x534e5f4d41494e",
  SN_SEPOLIA: "0x534e5f5345504f4c4941",
} as const;

const DEFAULT_CHAIN_ALIAS = "SN_SEPOLIA";

export type SeedCollection = {
  address: string;
  name: string;
  projectId?: string;
};

export type MarketplaceRuntimeConfig = {
  chainLabel: keyof typeof CHAIN_IDS | "custom";
  sdkConfig: MarketplaceClientConfig;
  collections: SeedCollection[];
  warnings: string[];
};

type MarketplaceEnv = Partial<
  Record<
    | "NEXT_PUBLIC_MARKETPLACE_CHAIN_ID"
    | "NEXT_PUBLIC_MARKETPLACE_DEFAULT_PROJECT"
    | "NEXT_PUBLIC_MARKETPLACE_COLLECTIONS",
    string | undefined
  >
>;

function resolveChainId(
  value: string | undefined,
  warnings: string[],
): { chainLabel: MarketplaceRuntimeConfig["chainLabel"]; chainId: string } {
  if (!value) {
    return {
      chainLabel: DEFAULT_CHAIN_ALIAS,
      chainId: CHAIN_IDS[DEFAULT_CHAIN_ALIAS],
    };
  }

  const normalized = value.trim();
  if (normalized in CHAIN_IDS) {
    const alias = normalized as keyof typeof CHAIN_IDS;
    return { chainLabel: alias, chainId: CHAIN_IDS[alias] };
  }

  if (normalized.startsWith("0x")) {
    return { chainLabel: "custom", chainId: normalized };
  }

  warnings.push(
    `NEXT_PUBLIC_MARKETPLACE_CHAIN_ID "${value}" is invalid. Falling back to ${DEFAULT_CHAIN_ALIAS}.`,
  );

  return {
    chainLabel: DEFAULT_CHAIN_ALIAS,
    chainId: CHAIN_IDS[DEFAULT_CHAIN_ALIAS],
  };
}

function parseCollections(value: string | undefined, warnings: string[]) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry) => {
      const [address, name, projectId] = entry.split("|").map((v) => v?.trim());

      if (!address || !name) {
        warnings.push(
          `Skipping malformed collection entry "${entry}". Expected address|name|projectId.`,
        );
        return [];
      }

      return [{ address, name, projectId: projectId || undefined }];
    });
}

export function getMarketplaceRuntimeConfigFromEnv(
  env: MarketplaceEnv,
): MarketplaceRuntimeConfig {
  const warnings: string[] = [];
  const { chainLabel, chainId } = resolveChainId(
    env.NEXT_PUBLIC_MARKETPLACE_CHAIN_ID,
    warnings,
  );
  const collections = parseCollections(
    env.NEXT_PUBLIC_MARKETPLACE_COLLECTIONS,
    warnings,
  );
  const defaultProject = env.NEXT_PUBLIC_MARKETPLACE_DEFAULT_PROJECT?.trim() || undefined;

  return {
    chainLabel,
    collections,
    warnings,
    sdkConfig: {
      chainId: chainId as MarketplaceClientConfig["chainId"],
      defaultProject,
    },
  };
}

export function getMarketplaceRuntimeConfig(): MarketplaceRuntimeConfig {
  return getMarketplaceRuntimeConfigFromEnv({
    NEXT_PUBLIC_MARKETPLACE_CHAIN_ID: process.env.NEXT_PUBLIC_MARKETPLACE_CHAIN_ID,
    NEXT_PUBLIC_MARKETPLACE_COLLECTIONS:
      process.env.NEXT_PUBLIC_MARKETPLACE_COLLECTIONS,
    NEXT_PUBLIC_MARKETPLACE_DEFAULT_PROJECT:
      process.env.NEXT_PUBLIC_MARKETPLACE_DEFAULT_PROJECT,
  });
}
