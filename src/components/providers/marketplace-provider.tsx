"use client";

import type { ReactNode } from "react";
import { MarketplaceClientProvider } from "@cartridge/arcade/marketplace/react";
import { getMarketplaceRuntimeConfig } from "@/lib/marketplace/config";

type MarketplaceProviderProps = {
  children: ReactNode;
};

export function MarketplaceProvider({ children }: MarketplaceProviderProps) {
  const { sdkConfig } = getMarketplaceRuntimeConfig();

  return (
    <MarketplaceClientProvider config={sdkConfig}>
      {children}
    </MarketplaceClientProvider>
  );
}
