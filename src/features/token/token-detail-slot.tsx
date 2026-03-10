"use client";

import dynamic from "next/dynamic";

const TokenDetailRouteClient = dynamic(
  () =>
    import("@/features/token/token-detail-route-client").then((module) => ({
      default: module.TokenDetailRouteClient,
    })),
  { ssr: false },
);

type TokenDetailSlotProps = {
  address: string;
  tokenId: string;
};

export function TokenDetailSlot({ address, tokenId }: TokenDetailSlotProps) {
  return <TokenDetailRouteClient address={address} tokenId={tokenId} />;
}
