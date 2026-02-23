import { describe, expect, it } from "vitest";
import { resolveDeferredMetadataCapability } from "@/lib/marketplace/sdk-capabilities";

describe("sdk capabilities", () => {
  it("reports_supported_when_flag_enabled_and_sdk_methods_exist", () => {
    const capability = resolveDeferredMetadataCapability({
      featureEnabled: true,
      client: {
        listCollectionTokenIds: async () => ({ page: { tokenIds: [] } }),
        getTokensMetadata: async () => ({ tokens: [] }),
      },
    });

    expect(capability).toEqual({
      supported: true,
      reason: "enabled",
    });
  });

  it("reports_unsupported_when_sdk_methods_are_missing", () => {
    const capability = resolveDeferredMetadataCapability({
      featureEnabled: true,
      client: {},
    });

    expect(capability).toEqual({
      supported: false,
      reason: "sdk_missing_methods",
    });
  });

  it("reports_disabled_when_feature_flag_is_off", () => {
    const capability = resolveDeferredMetadataCapability({
      featureEnabled: false,
      client: {
        listCollectionTokenIds: async () => ({ page: { tokenIds: [] } }),
        getTokensMetadata: async () => ({ tokens: [] }),
      },
    });

    expect(capability).toEqual({
      supported: false,
      reason: "feature_disabled",
    });
  });
});
