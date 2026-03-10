import { Suspense } from "react";
import type { Metadata } from "next";
import { HydrationBoundary } from "@tanstack/react-query";
import { TokenDetailView } from "@/features/token/token-detail-view";
import { buildMarketplacePageMetadata } from "@/lib/seo/metadata";
import { buildTokenPageHydrationState } from "@/lib/marketplace/token-prefetch";

export const runtime = "edge";

type TokenPageProps = {
  params: Promise<{ address: string; tokenId: string }>;
};

export default async function TokenPage({ params }: TokenPageProps) {
  const { address, tokenId } = await params;
  const { state } = await buildTokenPageHydrationState({
    address,
    tokenId,
  });

  return (
    <HydrationBoundary state={state}>
      <main className="w-full px-4 py-6 sm:px-6 lg:px-8">
        <Suspense>
          <TokenDetailView address={address} tokenId={tokenId} />
        </Suspense>
      </main>
    </HydrationBoundary>
  );
}

export async function generateMetadata({
  params,
}: TokenPageProps): Promise<Metadata> {
  const { address, tokenId } = await params;
  const { getTokenSeoData } = await import("@/lib/marketplace/seo-data");
  const seoData = await getTokenSeoData(address, tokenId);

  return buildMarketplacePageMetadata({
    title: `${seoData.tokenName} | ${seoData.collectionName} | Realms.market`,
    description:
      seoData.description ??
      `View listings and activity for ${seoData.tokenName}.`,
    pathname: `/collections/${address}/${tokenId}`,
    image:
      seoData.image ??
      seoData.collectionImage ??
      `/collections/${address}/${tokenId}/opengraph-image`,
    noIndex: !seoData.exists,
  });
}
