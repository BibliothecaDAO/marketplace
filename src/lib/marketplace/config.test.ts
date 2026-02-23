import { describe, expect, it } from "vitest";
import { getMarketplaceRuntimeConfigFromEnv } from "@/lib/marketplace/config";

describe("marketplace config", () => {
  it("config.parses_valid_chain_alias_and_default_project", () => {
    const result = getMarketplaceRuntimeConfigFromEnv({
      NEXT_PUBLIC_MARKETPLACE_CHAIN_ID: "SN_MAIN",
      NEXT_PUBLIC_MARKETPLACE_DEFAULT_PROJECT: "project-alpha",
      NEXT_PUBLIC_MARKETPLACE_RUNTIME: "dojo",
      NEXT_PUBLIC_MARKETPLACE_ENABLE_DEFERRED_METADATA: "true",
      NEXT_PUBLIC_MARKETPLACE_COLLECTIONS:
        "0xabc|Genesis|project-alpha,0xdef|Artifacts|project-beta",
    });

    expect(result.chainLabel).toBe("SN_MAIN");
    expect(result.sdkConfig.chainId).toBe("0x534e5f4d41494e");
    expect(result.sdkConfig.defaultProject).toBe("project-alpha");
    expect(result.sdkConfig.runtime).toBe("dojo");
    expect(result.featureFlags.enableDeferredMetadataHydration).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(result.collections).toEqual([
      { address: "0xabc", name: "Genesis", projectId: "project-alpha" },
      { address: "0xdef", name: "Artifacts", projectId: "project-beta" },
    ]);
  });

  it("config_falls_back_on_invalid_chain_with_warning", () => {
    const result = getMarketplaceRuntimeConfigFromEnv({
      NEXT_PUBLIC_MARKETPLACE_CHAIN_ID: "invalid-chain",
      NEXT_PUBLIC_MARKETPLACE_RUNTIME: "broken",
      NEXT_PUBLIC_MARKETPLACE_COLLECTIONS: "broken-entry,0xabc|Genesis|",
    });

    expect(result.chainLabel).toBe("SN_SEPOLIA");
    expect(result.sdkConfig.chainId).toBe("0x534e5f5345504f4c4941");
    expect(result.sdkConfig.runtime).toBe("edge");
    expect(result.featureFlags.enableDeferredMetadataHydration).toBe(false);
    expect(result.collections).toEqual([
      { address: "0xabc", name: "Genesis", projectId: undefined },
    ]);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("NEXT_PUBLIC_MARKETPLACE_CHAIN_ID"),
        expect.stringContaining("NEXT_PUBLIC_MARKETPLACE_RUNTIME"),
        expect.stringContaining("Skipping malformed collection entry"),
      ]),
    );
  });

  it("config_defaults_runtime_to_edge", () => {
    const result = getMarketplaceRuntimeConfigFromEnv({});

    expect(result.sdkConfig.runtime).toBe("edge");
  });

  it("config_parses_runtime_override_values", () => {
    expect(
      getMarketplaceRuntimeConfigFromEnv({
        NEXT_PUBLIC_MARKETPLACE_RUNTIME: "edge",
      }).sdkConfig.runtime,
    ).toBe("edge");
    expect(
      getMarketplaceRuntimeConfigFromEnv({
        NEXT_PUBLIC_MARKETPLACE_RUNTIME: "dojo",
      }).sdkConfig.runtime,
    ).toBe("dojo");
  });
});
