import { Suspense } from "react";
import type { Metadata } from "next";
import { HydrationBoundary } from "@tanstack/react-query";
import { CollectionRouteSlot } from "@/features/collections/collection-route-slot";
import { buildMarketplacePageMetadata } from "@/lib/seo/metadata";
import { buildCollectionPageHydrationState } from "@/lib/marketplace/collection-prefetch";
import { collectionDiscoveryStateFromSearchParams } from "@/features/collections/collection-query-params";

export const runtime = "edge";

type CollectionPageProps = {
  params: Promise<{ address: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CollectionPage({
  params,
  searchParams,
}: CollectionPageProps) {
  const { address } = await params;
  const rawSearchParams = await searchParams;
  const resolvedSearchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(rawSearchParams)) {
    if (Array.isArray(value)) {
      value.forEach((entry) => resolvedSearchParams.append(key, entry));
      continue;
    }
    if (value) {
      resolvedSearchParams.set(key, value);
    }
  }
  const { activeFilters } = collectionDiscoveryStateFromSearchParams(resolvedSearchParams);
  const { state } = await buildCollectionPageHydrationState({
    address,
    cursor: resolvedSearchParams.get("cursor"),
    activeFilters,
  });

  return (
    <main className="flex min-h-screen w-full items-start px-4 py-6 sm:px-6 lg:px-8">
      <HydrationBoundary state={state}>
        <Suspense>
          <CollectionRouteSlot address={address} cursor={resolvedSearchParams.get("cursor")} />
        </Suspense>
      </HydrationBoundary>
    </main>
  );
}

export async function generateMetadata({
  params,
}: CollectionPageProps): Promise<Metadata> {
  const { address } = await params;
  const { getCollectionSeoData } = await import("@/lib/marketplace/seo-data");
  const seoData = await getCollectionSeoData(address);

  return buildMarketplacePageMetadata({
    title: seoData.exists
      ? `${seoData.name} | Realms.market`
      : `Collection ${seoData.name} | Realms.market`,
    description:
      seoData.description ??
      (seoData.exists
        ? `Explore listings and activity for ${seoData.name}.`
        : `Collection ${seoData.name} is unavailable on Realms.market.`),
    pathname: `/collections/${address}`,
    image: seoData.image ?? `/collections/${address}/opengraph-image`,
    noIndex: !seoData.exists,
  });
}
