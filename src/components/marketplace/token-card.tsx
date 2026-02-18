"use client";

import Link from "next/link";
import type { NormalizedToken } from "@cartridge/arcade/marketplace";
import {
  displayTokenId,
  tokenImage,
  tokenName,
} from "@/lib/marketplace/token-display";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

type MarketplaceTokenCardProps = {
  token: NormalizedToken;
  href: string;
  price?: string | null;
  cardClassName?: string;
  contentClassName?: string;
  linkClassName?: string;
  linkAriaLabel?: string;
  cardContentAriaLabel?: string;
  cardContentRole?: "article";
};

export function MarketplaceTokenCard({
  token,
  href,
  price,
  cardClassName,
  contentClassName,
  linkClassName,
  linkAriaLabel,
  cardContentAriaLabel,
  cardContentRole,
}: MarketplaceTokenCardProps) {
  const image = tokenImage(token);

  return (
    <Link
      className={cn(
        "group block transition-transform duration-150 hover:-translate-y-0.5",
        linkClassName,
      )}
      href={href}
      aria-label={linkAriaLabel}
    >
      <Card
        className={cn(
          "overflow-hidden py-0 transition-colors duration-150 group-hover:border-primary/30",
          cardClassName,
        )}
      >
        <div className="flex aspect-square items-center justify-center bg-muted">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={tokenName(token)}
              className="h-full w-full object-cover"
              src={image}
            />
          ) : (
            <span className="text-xs text-muted-foreground">No Image</span>
          )}
        </div>
        <CardContent
          aria-label={cardContentAriaLabel}
          className={cn("space-y-1 px-3 pb-3 pt-2", contentClassName)}
          role={cardContentRole}
        >
          <p className="text-sm font-medium">{tokenName(token)}</p>
          <p className="text-xs text-muted-foreground">#{displayTokenId(token)}</p>
          <p className="text-xs text-muted-foreground">Price: {price ?? "—"}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
