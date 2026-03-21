"use client";

import { MarketplaceTokenCard } from "@/components/marketplace/token-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { TrendingToken } from "@/features/home/types";
import { useEntrance } from "@/lib/animation";

type TrendingTokensSectionProps = {
  tokens: TrendingToken[];
  isLoading?: boolean;
};

export function TrendingTokensSection({
  tokens,
  isLoading = false,
}: TrendingTokensSectionProps) {
  const scrollRef = useEntrance<HTMLDivElement>({
    selector: "[data-trending-item]",
    staggerDelay: 60,
    translateX: -12,
    translateY: 0,
  });

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
        <div className="relative">
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 z-10 w-8 bg-gradient-to-r from-background to-transparent" />
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-10 w-8 bg-gradient-to-l from-background to-transparent" />
          <div data-testid="trending-tokens-scroll" className="overflow-x-auto">
            <div ref={scrollRef} className="flex gap-3 pb-2">
              {tokens.map((entry) => (
                <div key={entry.href} className="w-48 shrink-0" data-trending-item>
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
        </div>
      )}
    </section>
  );
}
