"use client";

import { useRef, useEffect } from "react";
import Link from "next/link";
import { animate, stagger } from "animejs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type HeroBannerProps = {
  name: string;
  address: string;
  imageUrl?: string | null;
  floorPrice?: string | null;
  totalSupply?: string | null;
  listingCount?: string | null;
  isLoading?: boolean;
};

export function HeroBanner({
  name,
  address,
  imageUrl,
  floorPrice,
  totalSupply,
  listingCount,
  isLoading = false,
}: HeroBannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || isLoading) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    animate(el.querySelectorAll(".hero-image"), { opacity: [0, 1], duration: 600, ease: "easeOutCubic" });
    animate(el.querySelectorAll(".hero-overlay"), { opacity: [0, 1], translateY: [20, 0], duration: 400, delay: 200, ease: "easeOutCubic" });
    animate(el.querySelectorAll(".hero-title"), { opacity: [0, 1], translateY: [16, 0], duration: 500, delay: 300, ease: "easeOutCubic" });
    animate(el.querySelectorAll(".hero-stat"), { opacity: [0, 1], translateY: [12, 0], delay: stagger(80, { start: 400 }), duration: 500, ease: "easeOutCubic" });
    animate(el.querySelectorAll(".hero-cta"), { opacity: [0, 1], duration: 400, delay: 600, ease: "easeOutCubic" });
  }, [isLoading]);

  if (isLoading) {
    return (
      <div data-testid="hero-banner" className="relative h-56 sm:h-72 lg:h-80 w-full overflow-hidden rounded-lg">
        <Skeleton data-testid="hero-banner-skeleton" className="h-full w-full rounded-none" />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      data-testid="hero-banner"
      className="relative h-56 sm:h-72 lg:h-80 w-full overflow-hidden rounded-lg border border-primary/20"
    >
      {/* Background image */}
      <div className="hero-image absolute inset-0">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={`${name} banner`}
            src={imageUrl}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            data-testid="hero-banner-gradient-fallback"
            className="h-full w-full bg-gradient-to-br from-primary/35 via-accent to-muted"
          />
        )}
      </div>

      {/* Gradient overlay — stronger at bottom for text readability */}
      <div className="hero-overlay absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />

      {/* Content overlay — positioned at bottom */}
      <div className="absolute inset-x-0 bottom-0 px-4 pb-4 sm:px-6 sm:pb-6">
        {/* Title row */}
        <div className="hero-title flex flex-wrap items-end justify-between gap-3 mb-3">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground drop-shadow-sm">
              {name}
            </h2>
          </div>
          <Button asChild size="sm" className="hero-cta shrink-0">
            <Link href={`/collections/${address}`}>View Collection</Link>
          </Button>
        </div>

        {/* Stats row — glass pills */}
        <div className="flex flex-wrap gap-2">
          <div className="hero-stat rounded-md border border-border/50 backdrop-blur-md bg-background/50 px-3 py-1.5 text-xs sm:text-sm">
            <span className="text-muted-foreground mr-1.5">Floor</span>
            <span className="font-medium text-foreground">{floorPrice ?? "--"}</span>
          </div>
          <div className="hero-stat rounded-md border border-border/50 backdrop-blur-md bg-background/50 px-3 py-1.5 text-xs sm:text-sm">
            <span className="text-muted-foreground mr-1.5">Supply</span>
            <span className="font-medium text-foreground">{totalSupply ?? "--"}</span>
          </div>
          <div className="hero-stat rounded-md border border-border/50 backdrop-blur-md bg-background/50 px-3 py-1.5 text-xs sm:text-sm">
            <span className="text-muted-foreground mr-1.5">Listed</span>
            <span className="font-medium text-foreground">{listingCount ?? "--"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
