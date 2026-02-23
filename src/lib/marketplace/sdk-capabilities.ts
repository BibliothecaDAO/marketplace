export type DeferredMetadataCapabilityReason =
  | "enabled"
  | "feature_disabled"
  | "sdk_missing_methods";

export type DeferredMetadataCapability = {
  supported: boolean;
  reason: DeferredMetadataCapabilityReason;
};

type DeferredMetadataSdkSurface = {
  listCollectionTokenIds?: unknown;
  getTokensMetadata?: unknown;
};

function hasDeferredMetadataSdkMethods(client: unknown) {
  if (!client || typeof client !== "object") {
    return false;
  }

  const sdk = client as DeferredMetadataSdkSurface;
  return (
    typeof sdk.listCollectionTokenIds === "function" &&
    typeof sdk.getTokensMetadata === "function"
  );
}

export function resolveDeferredMetadataCapability(options: {
  featureEnabled: boolean;
  client: unknown;
}): DeferredMetadataCapability {
  if (!options.featureEnabled) {
    return { supported: false, reason: "feature_disabled" };
  }

  if (!hasDeferredMetadataSdkMethods(options.client)) {
    return { supported: false, reason: "sdk_missing_methods" };
  }

  return { supported: true, reason: "enabled" };
}
