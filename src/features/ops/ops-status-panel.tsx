"use client";

import { useState } from "react";
import type { MarketplaceClientStatus } from "@cartridge/arcade/marketplace";
import { useMarketplaceClient } from "@cartridge/arcade/marketplace/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function statusBadgeVariant(status: MarketplaceClientStatus) {
  switch (status) {
    case "ready":
      return "secondary" as const;
    case "error":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

export function OpsStatusPanel() {
  const [isRetrying, setIsRetrying] = useState(false);
  const { status, error, refresh } = useMarketplaceClient();

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
        <CardTitle className="text-lg">Client Status</CardTitle>
        <Badge variant={statusBadgeVariant(status)}>{status}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-destructive">{error.message}</p>}
        <Button onClick={onRetry} disabled={isRetrying}>
          {isRetrying ? "Retrying..." : "Retry client init"}
        </Button>
      </CardContent>
    </Card>
  );
}
