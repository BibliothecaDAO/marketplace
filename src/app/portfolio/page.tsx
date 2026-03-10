import { HydrationBoundary } from "@tanstack/react-query";
import { PortfolioView } from "@/features/portfolio/portfolio-view";
import { buildPortfolioPageHydrationState } from "@/lib/marketplace/server-prefetch";

type PortfolioPageProps = {
  searchParams?: Promise<{ address?: string }>;
};

export default async function PortfolioPage({ searchParams }: PortfolioPageProps) {
  const resolvedSearchParams = await searchParams;
  const initialAddress = resolvedSearchParams?.address?.trim();
  const { state } = await buildPortfolioPageHydrationState(initialAddress);

  return (
    <HydrationBoundary state={state}>
      <PortfolioView initialAddress={initialAddress} />
    </HydrationBoundary>
  );
}
