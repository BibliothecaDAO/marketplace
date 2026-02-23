"use client";

import { useState } from "react";
import type { MarketplaceClientStatus } from "@cartridge/arcade/marketplace";
import { useMarketplaceClient } from "@cartridge/arcade/marketplace/react";
import { getMarketplaceRuntimeConfig } from "@/lib/marketplace/config";
import { resolveDeferredMetadataCapability } from "@/lib/marketplace/sdk-capabilities";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function statusBadgeVariant(status: MarketplaceClientStatus) {
  switch (status) {
    case "ready":
      return "default" as const;
    case "error":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

export function OpsStatusPanel() {
  const [isRetrying, setIsRetrying] = useState(false);
  const { client, status, error, refresh } = useMarketplaceClient();
  const config = getMarketplaceRuntimeConfig();
  const runtimeMode = config.sdkConfig.runtime ?? "edge";
  const deferredMetadataCapability = resolveDeferredMetadataCapability({
    featureEnabled: config.featureFlags.enableDeferredMetadataHydration,
    client,
  });
  const deferredMetadataLabel = deferredMetadataCapability.supported
    ? "enabled"
    : deferredMetadataCapability.reason === "feature_disabled"
      ? "disabled (feature flag)"
      : "unsupported by SDK";

  async function onRetry() {
    setIsRetrying(true);
    try {
      await refresh();
    } finally {
      setIsRetrying(false);
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <CardTitle className="text-sm font-medium tracking-widest uppercase">Client Status</CardTitle>
        <Badge variant={statusBadgeVariant(status)}>{status}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>Runtime: {runtimeMode}</p>
          <p>Deferred metadata: {deferredMetadataLabel}</p>
        </div>
        {error && <p className="text-sm text-destructive">{error.message}</p>}
        <Button onClick={onRetry} disabled={isRetrying}>
          {isRetrying ? "Retrying..." : "Retry client init"}
        </Button>
      </CardContent>
    </Card>
  );
}
