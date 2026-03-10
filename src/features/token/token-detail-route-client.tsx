"use client";

import { MarketplaceProvider } from "@/components/providers/marketplace-provider";
import { TokenDetailView } from "@/features/token/token-detail-view";

type TokenDetailRouteClientProps = {
  address: string;
  tokenId: string;
};

export function TokenDetailRouteClient({
  address,
  tokenId,
}: TokenDetailRouteClientProps) {
  return (
    <MarketplaceProvider>
      <TokenDetailView address={address} tokenId={tokenId} />
    </MarketplaceProvider>
  );
}
