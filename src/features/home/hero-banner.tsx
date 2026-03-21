"use client";

import { useRef, useEffect } from "react";
import Link from "next/link";
import { animate, stagger } from "animejs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
      <Card data-testid="hero-banner" className="overflow-hidden py-0">
        <div className="relative h-56 w-full">
          <Skeleton data-testid="hero-banner-skeleton" className="h-full w-full rounded-none" />
        </div>
        <CardContent className="space-y-3 px-4 py-4 sm:px-6">
          <Skeleton data-testid="hero-banner-skeleton" className="h-6 w-40" />
          <Skeleton data-testid="hero-banner-skeleton" className="h-4 w-64" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card ref={containerRef} data-testid="hero-banner" className="overflow-hidden border border-primary/20 py-0">
      <div className="hero-image relative h-56 w-full">
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
        <div className="hero-overlay absolute inset-0 bg-gradient-to-t from-background/85 via-background/25 to-transparent" />
      </div>

      <CardContent className="space-y-4 px-4 py-4 sm:px-6">
        <div className="hero-title flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight">{name}</h2>
          <Button asChild size="sm" className="hero-cta">
            <Link href={`/collections/${address}`}>View Collection</Link>
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs sm:text-sm">
          <div className="hero-stat rounded-md border border-border/70 backdrop-blur-sm bg-background/60 px-3 py-2">
            <p className="text-muted-foreground">Floor</p>
            <p className="font-medium">{floorPrice ?? "--"}</p>
          </div>
          <div className="hero-stat rounded-md border border-border/70 backdrop-blur-sm bg-background/60 px-3 py-2">
            <p className="text-muted-foreground">Supply</p>
            <p className="font-medium">{totalSupply ?? "--"}</p>
          </div>
          <div className="hero-stat rounded-md border border-border/70 backdrop-blur-sm bg-background/60 px-3 py-2">
            <p className="text-muted-foreground">Listed</p>
            <p className="font-medium">{listingCount ?? "--"}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
