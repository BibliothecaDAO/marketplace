import { Suspense } from "react";
import { HydrationBoundary } from "@tanstack/react-query";
import { MarketplaceHome } from "@/components/marketplace/marketplace-home";
import { buildHomePageHydrationState } from "@/lib/marketplace/server-prefetch";

export const runtime = "edge";

export default async function Home() {
  const { state } = await buildHomePageHydrationState();

  return (
    <HydrationBoundary state={state}>
      <Suspense fallback={null}>
        <MarketplaceHome />
      </Suspense>
    </HydrationBoundary>
  );
}
