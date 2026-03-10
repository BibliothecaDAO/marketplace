"use client";

import { useState, type ReactNode } from "react";
import { MarketplaceClientProvider } from "@cartridge/arcade/marketplace/react";
import { StarknetConfig } from "@starknet-react/core";
import { getMarketplaceRuntimeConfig } from "@/lib/marketplace/config";
import { buildStarknetConfig } from "@/lib/marketplace/starknet-config";

type MarketplaceProviderProps = {
  children: ReactNode;
};

export function MarketplaceProvider({ children }: MarketplaceProviderProps) {
  const { chainLabel, sdkConfig } = getMarketplaceRuntimeConfig();
  const [starknetConfig] = useState(() => buildStarknetConfig(chainLabel));

  return (
    <StarknetConfig {...starknetConfig}>
      <MarketplaceClientProvider config={sdkConfig}>
        {children}
      </MarketplaceClientProvider>
    </StarknetConfig>
  );
}
