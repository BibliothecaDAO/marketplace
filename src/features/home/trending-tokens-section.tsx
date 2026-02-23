import { MarketplaceTokenCard } from "@/components/marketplace/token-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { TrendingToken } from "@/features/home/types";

type TrendingTokensSectionProps = {
  tokens: TrendingToken[];
  isLoading?: boolean;
};

export function TrendingTokensSection({
  tokens,
  isLoading = false,
}: TrendingTokensSectionProps) {
  return (
    <section data-testid="trending-tokens" className="space-y-3">
      <h2 className="text-sm font-medium tracking-widest uppercase text-muted-foreground">
        Trending Tokens
      </h2>

      {isLoading ? (
        <div data-testid="trending-tokens-scroll" className="overflow-x-auto">
          <div className="flex gap-3 pb-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="w-48 shrink-0">
                <Skeleton data-testid="trending-token-skeleton" className="aspect-square w-full" />
              </div>
            ))}
          </div>
        </div>
      ) : tokens.length === 0 ? (
        <p className="text-sm text-muted-foreground">No trending tokens</p>
      ) : (
        <div data-testid="trending-tokens-scroll" className="overflow-x-auto">
          <div className="flex gap-3 pb-2">
            {tokens.map((entry) => (
              <div key={entry.href} className="w-48 shrink-0">
                <MarketplaceTokenCard
                  token={entry.token}
                  href={entry.href}
                  price={entry.price}
                  currency={entry.currency}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
