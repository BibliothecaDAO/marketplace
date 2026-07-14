"use client";

import { getMarketplaceRuntimeConfig } from "@/lib/marketplace/config";
import { useIndexerStatusQuery } from "@/lib/marketplace/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function statusBadgeVariant(status: string) {
  if (status === "success") return "default" as const;
  if (status === "error") return "destructive" as const;
  return "outline" as const;
}

export function OpsStatusPanel() {
  const query = useIndexerStatusQuery();
  const config = getMarketplaceRuntimeConfig();
  const status = query.data?.data;

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <CardTitle className="text-sm font-medium tracking-widest uppercase">
          Owned Read Plane
        </CardTitle>
        <Badge variant={statusBadgeVariant(query.status)}>{query.status}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>API version: {status?.buildVersion ?? "unavailable"}</p>
          <p>Schema: {query.data?.meta.schemaVersion ?? config.schemaVersion}</p>
          <p>Chain: {config.chainLabel}</p>
          <p>World: {config.worldAddress}</p>
          <p>Marketplace: {config.marketplaceAddress}</p>
          <p>Indexed block: {status?.indexedBlock ?? "unavailable"}</p>
          <p>Chain head: {status?.chainHead ?? "unavailable"}</p>
          <p>
            Lag: {status ? `${status.lagBlocks} block${status.lagBlocks === 1 ? "" : "s"}` : "unavailable"}
          </p>
          <p>Finality: {status?.finality ?? "unavailable"}</p>
          <p>Metadata failures: {status?.metadataFailures ?? "unavailable"}</p>
          <p>Read rollout: {config.readRollout}</p>
        </div>
        {query.error ? (
          <p className="text-sm text-destructive">
            {query.error instanceof Error ? query.error.message : "Diagnostics failed."}
          </p>
        ) : null}
        <Button
          onClick={() => { void query.refetch(); }}
          disabled={query.isFetching}
        >
          {query.isFetching ? "Retrying..." : "Retry diagnostics"}
        </Button>
      </CardContent>
    </Card>
  );
}
