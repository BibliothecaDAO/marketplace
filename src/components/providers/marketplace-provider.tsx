"use client";

import { useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { MarketplaceClientProvider } from "@cartridge/arcade/marketplace/react";
import { getMarketplaceRuntimeConfig } from "@/lib/marketplace/config";
import { makeQueryClient } from "@/lib/marketplace/query-client";

type MarketplaceProviderProps = {
  children: ReactNode;
};

export function MarketplaceProvider({ children }: MarketplaceProviderProps) {
  const { sdkConfig } = getMarketplaceRuntimeConfig();
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <MarketplaceClientProvider config={sdkConfig}>
        {children}
      </MarketplaceClientProvider>
    </QueryClientProvider>
  );
}
