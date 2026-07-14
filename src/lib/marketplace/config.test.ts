import { beforeEach, describe, expect, it } from "vitest";
import {
  getMarketplaceRuntimeConfig,
  getMarketplaceRuntimeConfigFromEnv,
  _resetConfigCache,
} from "@/lib/marketplace/config";

describe("marketplace config", () => {
  beforeEach(() => {
    _resetConfigCache();
  });

  it("parses owned API, chain, and rollout configuration", () => {
    const result = getMarketplaceRuntimeConfigFromEnv({
      NEXT_PUBLIC_MARKETPLACE_CHAIN_ID: "SN_MAIN",
      NEXT_PUBLIC_MARKETPLACE_API_BASE_URL: "https://market.example/",
      NEXT_PUBLIC_MARKETPLACE_READ_ROLLOUT: "orders",
      NEXT_PUBLIC_MARKETPLACE_COLLECTIONS:
        "0xabc|Genesis|project-alpha,0xdef|Artifacts|project-beta",
    });

    expect(result.chainLabel).toBe("SN_MAIN");
    expect(result.chainId).toBe("0x534e5f4d41494e");
    expect(result.apiBaseUrl).toBe("https://market.example");
    expect(result.readRollout).toBe("orders");
    expect(result.warnings).toEqual([]);
    expect(result.collections).toEqual([
      { address: "0xabc", name: "Genesis", projectId: undefined },
      { address: "0xdef", name: "Artifacts", projectId: undefined },
    ]);
  });

  it("fails startup for invalid chain, rollout, or API URL", () => {
    expect(() => getMarketplaceRuntimeConfigFromEnv({
      NEXT_PUBLIC_MARKETPLACE_CHAIN_ID: "invalid-chain",
    })).toThrow(/MARKETPLACE_CHAIN_ID/);
    expect(() => getMarketplaceRuntimeConfigFromEnv({
      NEXT_PUBLIC_MARKETPLACE_READ_ROLLOUT: "everything",
    })).toThrow(/MARKETPLACE_READ_ROLLOUT/);
    expect(() => getMarketplaceRuntimeConfigFromEnv({
      NEXT_PUBLIC_MARKETPLACE_API_BASE_URL: "file:///tmp/api",
    })).toThrow(/API_BASE_URL/);
  });

  it("retains the rollout collection parser but ignores project ids", () => {
    const result = getMarketplaceRuntimeConfigFromEnv({
      NEXT_PUBLIC_MARKETPLACE_COLLECTIONS: "broken-entry,0xabc|Genesis|",
    });

    expect(result.chainLabel).toBe("SN_SEPOLIA");
    expect(result.collections).toEqual([
      { address: "0xabc", name: "Genesis", projectId: undefined },
    ]);
    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining("Skipping malformed collection entry"),
    ]));
  });

  it("defaults to the checked-in registry and an off rollout", () => {
    const result = getMarketplaceRuntimeConfigFromEnv({});

    expect(result.readRollout).toBe("off");
    expect(result.apiBaseUrl).toBe("http://localhost:3001");
    expect(result.collections).toEqual([]);
  });

  it("returns_same_reference_on_repeated_calls", () => {
    const first = getMarketplaceRuntimeConfig();
    const second = getMarketplaceRuntimeConfig();
    expect(first).toBe(second);
  });

  it("returns_same_collections_array_reference", () => {
    const first = getMarketplaceRuntimeConfig().collections;
    const second = getMarketplaceRuntimeConfig().collections;
    expect(first).toBe(second);
  });

  it("normalizes_legacy_beasts_collection_name", () => {
    const result = getMarketplaceRuntimeConfigFromEnv({
      NEXT_PUBLIC_MARKETPLACE_COLLECTIONS:
        "0xbeast|Beasts V2.1|project-beasts",
    });

    expect(result.collections).toEqual([
      { address: "0xbeast", name: "Beasts", projectId: undefined },
    ]);
  });
});
