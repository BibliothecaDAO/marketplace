"use client";

import { Header } from "@/components/layout/header";
import { MarketplaceProvider } from "@/components/providers/marketplace-provider";

export function HeaderShell() {
  return (
    <MarketplaceProvider>
      <Header />
    </MarketplaceProvider>
  );
}
