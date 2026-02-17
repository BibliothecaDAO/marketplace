import { describe, expect, it } from "vitest";
import { getMarketplaceRuntimeConfigFromEnv } from "@/lib/marketplace/config";

describe("marketplace config", () => {
  it("config.parses_valid_chain_alias_and_default_project", () => {
    const result = getMarketplaceRuntimeConfigFromEnv({
      NEXT_PUBLIC_MARKETPLACE_CHAIN_ID: "SN_MAIN",
      NEXT_PUBLIC_MARKETPLACE_DEFAULT_PROJECT: "project-alpha",
      NEXT_PUBLIC_MARKETPLACE_COLLECTIONS:
        "0xabc|Genesis|project-alpha,0xdef|Artifacts|project-beta",
    });

    expect(result.chainLabel).toBe("SN_MAIN");
    expect(result.sdkConfig.chainId).toBe("0x534e5f4d41494e");
    expect(result.sdkConfig.defaultProject).toBe("project-alpha");
    expect(result.warnings).toEqual([]);
    expect(result.collections).toEqual([
      { address: "0xabc", name: "Genesis", projectId: "project-alpha" },
      { address: "0xdef", name: "Artifacts", projectId: "project-beta" },
    ]);
  });

  it("config_falls_back_on_invalid_chain_with_warning", () => {
    const result = getMarketplaceRuntimeConfigFromEnv({
      NEXT_PUBLIC_MARKETPLACE_CHAIN_ID: "invalid-chain",
      NEXT_PUBLIC_MARKETPLACE_COLLECTIONS: "broken-entry,0xabc|Genesis|",
    });

    expect(result.chainLabel).toBe("SN_SEPOLIA");
    expect(result.sdkConfig.chainId).toBe("0x534e5f5345504f4c4941");
    expect(result.collections).toEqual([
      { address: "0xabc", name: "Genesis", projectId: undefined },
    ]);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("NEXT_PUBLIC_MARKETPLACE_CHAIN_ID"),
        expect.stringContaining("Skipping malformed collection entry"),
      ]),
    );
  });
});
