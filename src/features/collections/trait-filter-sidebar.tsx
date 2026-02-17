"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ActiveFilters,
  type TraitMetadataRow,
  computeAvailableFilters,
  computePrecomputedFilters,
  flattenActiveFilters,
} from "@/lib/marketplace/traits";

type TokenLike = {
  metadata?: unknown;
};

type TraitFilterSidebarProps = {
  tokens: TokenLike[];
  activeFilters: ActiveFilters;
  onActiveFiltersChange?: (filters: ActiveFilters) => void;
};

function cloneFilters(activeFilters: ActiveFilters): ActiveFilters {
  return Object.fromEntries(
    Object.entries(activeFilters).map(([name, values]) => [name, new Set(values)]),
  );
}

function metadataRowsFromTokens(tokens: TokenLike[]): TraitMetadataRow[] {
  const rows = new Map<string, number>();

  tokens.forEach((token) => {
    const metadata = token.metadata;
    if (!metadata || typeof metadata !== "object") {
      return;
    }

    const attributes = (metadata as { attributes?: unknown }).attributes;
    if (!Array.isArray(attributes)) {
      return;
    }

    attributes.forEach((rawAttribute) => {
      if (!rawAttribute || typeof rawAttribute !== "object") {
        return;
      }

      const attribute = rawAttribute as Record<string, unknown>;
      const traitName = String(
        attribute.trait_type ?? attribute.traitName ?? attribute.name ?? "",
      ).trim();
      const traitValue = String(attribute.value ?? attribute.traitValue ?? "").trim();
      if (!traitName || !traitValue) {
        return;
      }

      const key = `${traitName}::${traitValue}`;
      rows.set(key, (rows.get(key) ?? 0) + 1);
    });
  });

  return Array.from(rows.entries()).map(([key, count]) => {
    const [traitName, traitValue] = key.split("::");
    return { traitName, traitValue, count };
  });
}

export function TraitFilterSidebar({
  tokens,
  activeFilters,
  onActiveFiltersChange,
}: TraitFilterSidebarProps) {
  const metadataRows = useMemo(() => metadataRowsFromTokens(tokens), [tokens]);
  const availableFilters = useMemo(
    () => computeAvailableFilters(metadataRows, activeFilters),
    [metadataRows, activeFilters],
  );
  const precomputed = useMemo(
    () => computePrecomputedFilters(availableFilters),
    [availableFilters],
  );
  const hasActiveFilters = flattenActiveFilters(activeFilters).length > 0;

  function toggleFilter(traitName: string, traitValue: string) {
    const next = cloneFilters(activeFilters);
    if (!next[traitName]) {
      next[traitName] = new Set();
    }

    if (next[traitName].has(traitValue)) {
      next[traitName].delete(traitValue);
      if (next[traitName].size === 0) {
        delete next[traitName];
      }
    } else {
      next[traitName].add(traitValue);
    }

    onActiveFiltersChange?.(next);
  }

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium tracking-widest uppercase">Traits</CardTitle>
          {hasActiveFilters ? (
            <Button
              onClick={() => onActiveFiltersChange?.({})}
              size="sm"
              type="button"
              variant="ghost"
            >
              Clear
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {precomputed.attributes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No trait data yet. Load tokens to populate filters.
          </p>
        ) : null}

        {precomputed.attributes.map((traitName) => (
          <section className="space-y-2" key={traitName}>
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{traitName}</h3>
            <div className="flex flex-wrap gap-2">
              {(precomputed.properties[traitName] ?? []).map((item) => {
                const isActive = activeFilters[traitName]?.has(item.property) ?? false;
                return (
                  <Button
                    key={`${traitName}-${item.property}`}
                    onClick={() => toggleFilter(traitName, item.property)}
                    size="xs"
                    type="button"
                    variant={isActive ? "secondary" : "outline"}
                  >
                    {item.property} ({item.count})
                  </Button>
                );
              })}
            </div>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
