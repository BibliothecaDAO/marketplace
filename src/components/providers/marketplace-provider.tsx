"use client";

import { useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { MarketplaceClientProvider } from "@cartridge/arcade/marketplace/react";
import { StarknetConfig } from "@starknet-react/core";
import { getMarketplaceRuntimeConfig } from "@/lib/marketplace/config";
import { makeQueryClient } from "@/lib/marketplace/query-client";
import { buildStarknetConfig } from "@/lib/marketplace/starknet-config";

type MarketplaceProviderProps = {
  children: ReactNode;
};

export function MarketplaceProvider({ children }: MarketplaceProviderProps) {
  const { chainLabel, sdkConfig } = getMarketplaceRuntimeConfig();
  const [starknetConfig] = useState(() => buildStarknetConfig(chainLabel));
  const [queryClient] = useState(makeQueryClient);

  return (
    <StarknetConfig {...starknetConfig}>
      <QueryClientProvider client={queryClient}>
        <MarketplaceClientProvider config={sdkConfig}>
          {children}
        </MarketplaceClientProvider>
      </QueryClientProvider>
    </StarknetConfig>
  );
}
