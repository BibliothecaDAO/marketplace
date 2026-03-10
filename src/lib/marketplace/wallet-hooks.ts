"use client";

import { useMarketplaceTokenBalances } from "@cartridge/arcade/marketplace/react";
import { expandTokenIdVariants } from "@/lib/marketplace/token-id";

export function useTokenOwnershipQuery(options: {
  collection: string;
  tokenId: string;
  accountAddress?: string;
}) {
  const tokenIds = expandTokenIdVariants([options.tokenId]);
  return useMarketplaceTokenBalances(
    {
      contractAddresses: [options.collection],
      accountAddresses: options.accountAddress ? [options.accountAddress] : [],
      tokenIds,
      limit: 1,
    },
    {
      enabled: !!options.accountAddress && !!options.collection && !!options.tokenId,
    },
  );
}

export function useTokenHolderQuery(options: {
  collection: string;
  tokenId: string;
}) {
  const tokenIds = expandTokenIdVariants([options.tokenId]);
  return useMarketplaceTokenBalances(
    {
      contractAddresses: [options.collection],
      tokenIds,
      limit: 1,
    },
    {
      enabled: !!options.collection && !!options.tokenId,
    },
  );
}
