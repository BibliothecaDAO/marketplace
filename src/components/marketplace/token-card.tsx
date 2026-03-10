"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import type { NormalizedToken } from "@cartridge/arcade/marketplace";
import {
  displayTokenId,
  formatPriceForDisplay,
  tokenImage,
  tokenName,
} from "@/lib/marketplace/token-display";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TokenSymbol } from "@/components/ui/token-symbol";

type MarketplaceTokenCardProps = {
  token: NormalizedToken;
  href: string;
  price?: string | null;
  currency?: string | null;
  cardClassName?: string;
  contentClassName?: string;
  linkClassName?: string;
  linkAriaLabel?: string;
  cardContentAriaLabel?: string;
  cardContentRole?: "article";
  showActions?: boolean;
  onBuyNow?: () => void;
  onSelect?: () => void;
  buyNowLabel?: string;
  viewLabel?: string;
};

type TokenAttributeRow = {
  trait: string;
  value: string;
};

function normalizeAttributeValue(value: unknown) {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return null;
}

function tokenAttributes(token: NormalizedToken): TokenAttributeRow[] {
  const metadata = token.metadata;
  if (!metadata || typeof metadata !== "object") {
    return [];
  }

  const attributes = (metadata as { attributes?: unknown }).attributes;
  if (!Array.isArray(attributes)) {
    return [];
  }

  const grouped = new Map<string, string[]>();

  attributes.forEach((rawAttribute) => {
    if (!rawAttribute || typeof rawAttribute !== "object") {
      return;
    }

    const attribute = rawAttribute as Record<string, unknown>;
    const trait = normalizeAttributeValue(
      attribute.trait_type ?? attribute.traitName ?? attribute.name,
    );
    const value = normalizeAttributeValue(attribute.value ?? attribute.traitValue);

    if (!trait || !value) {
      return;
    }

    const values = grouped.get(trait) ?? [];
    if (!values.includes(value)) {
      values.push(value);
    }
    grouped.set(trait, values);
  });

  return Array.from(grouped.entries()).map(([trait, values]) => ({
    trait,
    value: values.join(", "),
  }));
}

export const MarketplaceTokenCard = React.memo(function MarketplaceTokenCard({
  token,
  href,
  price,
  currency,
  cardClassName,
  contentClassName,
  linkClassName,
  linkAriaLabel,
  cardContentAriaLabel,
  cardContentRole,
  showActions = false,
  onBuyNow,
  onSelect,
  buyNowLabel = "Buy Now",
  viewLabel = "View",
}: MarketplaceTokenCardProps) {
  const image = tokenImage(token);
  const displayPrice = formatPriceForDisplay(price);
  const attributes = useMemo(() => tokenAttributes(token), [token]);
  const interactiveContent = (
    <>
      <div className="flex aspect-[4/5] items-center justify-center bg-muted">
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
        {displayPrice ? (
          <p className="text-xs text-primary font-medium flex items-center gap-1">
            {displayPrice}
            {currency ? <TokenSymbol address={currency} className="text-muted-foreground" /> : null}
          </p>
        ) : null}
      </CardContent>
      <div
        className="pointer-events-none absolute inset-0 flex items-end bg-background/85 p-2 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-visible:pointer-events-auto group-focus-visible:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
        data-testid="token-attributes-overlay"
      >
        <div className="w-full rounded-md border bg-background/95 p-2 shadow-sm">
          <div
            className="max-h-44 overflow-y-auto pr-1"
            data-testid="token-attributes-scroll"
          >
            <table
              className="w-full table-fixed border-collapse text-[11px] leading-4"
              data-testid="token-attributes-table"
            >
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="w-1/2 pb-1 text-left font-medium">Trait</th>
                  <th className="w-1/2 pb-1 text-left font-medium">Value</th>
                </tr>
              </thead>
              <tbody>
                {attributes.length > 0 ? (
                  attributes.map((attribute) => (
                    <tr
                      className="border-b last:border-b-0"
                      key={`${attribute.trait}:${attribute.value}`}
                    >
                      <td className="truncate py-1 pr-2 text-foreground">
                        {attribute.trait}
                      </td>
                      <td className="break-words py-1 text-foreground">
                        {attribute.value}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="py-2 text-xs text-muted-foreground" colSpan={2}>
                      No attributes
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <Card
      className={cn(
        "relative overflow-hidden py-0 transition-colors duration-150",
        cardClassName,
      )}
    >
      {onSelect ? (
        <button
          type="button"
          className={cn(
            "group block w-full text-left transition-transform duration-150 hover:-translate-y-0.5 hover:border-primary/30",
            linkClassName,
          )}
          onClick={onSelect}
          aria-label={linkAriaLabel}
        >
          {interactiveContent}
        </button>
      ) : (
        <Link
          className={cn(
            "group block transition-transform duration-150 hover:-translate-y-0.5 hover:border-primary/30",
            linkClassName,
          )}
          href={href}
          aria-label={linkAriaLabel}
        >
          {interactiveContent}
        </Link>
      )}

      {showActions ? (
        <div className="grid grid-cols-2 gap-2 border-t border-border/60 px-3 py-3">
          {onBuyNow ? (
            <Button onClick={onBuyNow} type="button" size="sm">
              {buyNowLabel}
            </Button>
          ) : null}
          <Button
            asChild
            size="sm"
            type="button"
            variant={onBuyNow ? "outline" : "default"}
            className={cn(!onBuyNow && "col-span-2")}
          >
            <Link href={href}>{viewLabel}</Link>
          </Button>
        </div>
      ) : null}
    </Card>
  );
});
