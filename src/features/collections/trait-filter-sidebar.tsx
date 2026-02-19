"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  type ActiveFilters,
  type TraitMetadataRow,
  computeAvailableFilters,
  computePrecomputedFilters,
  flattenActiveFilters,
} from "@/lib/marketplace/traits";

type TraitFilterSidebarProps = {
  traitMetadata: TraitMetadataRow[];
  activeFilters: ActiveFilters;
  onActiveFiltersChange?: (filters: ActiveFilters) => void;
  isLoading?: boolean;
};

function cloneFilters(activeFilters: ActiveFilters): ActiveFilters {
  return Object.fromEntries(
    Object.entries(activeFilters).map(([name, values]) => [name, new Set(values)]),
  );
}

export function TraitFilterSidebar({
  traitMetadata,
  activeFilters,
  onActiveFiltersChange,
  isLoading,
}: TraitFilterSidebarProps) {
  const availableFilters = useMemo(
    () => computeAvailableFilters(traitMetadata, activeFilters),
    [traitMetadata, activeFilters],
  );
  const precomputed = useMemo(
    () => computePrecomputedFilters(availableFilters),
    [availableFilters],
  );
  const activeCount = flattenActiveFilters(activeFilters).length;

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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Filters
          </span>
          {activeCount > 0 && (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
              {activeCount}
            </span>
          )}
        </div>
        {activeCount > 0 && (
          <Button
            onClick={() => onActiveFiltersChange?.({})}
            size="sm"
            type="button"
            variant="ghost"
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </Button>
        )}
      </div>

      {/* Loading / empty states */}
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading traits...</p>
      ) : precomputed.attributes.length === 0 ? (
        <p className="text-xs text-muted-foreground">No trait data available.</p>
      ) : null}

      {/* Trait groups — collapsible via native details */}
      <div className="space-y-1">
        {precomputed.attributes.map((traitName) => {
          const activeInGroup = activeFilters[traitName]?.size ?? 0;
          return (
            <details key={traitName} open className="group">
              <summary className="flex cursor-pointer select-none list-none items-center justify-between rounded-sm px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors">
                <span className="flex items-center gap-1.5">
                  {traitName}
                  {activeInGroup > 0 && (
                    <span className="inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-0.5 text-[9px] font-medium text-primary-foreground">
                      {activeInGroup}
                    </span>
                  )}
                </span>
                <span className="text-muted-foreground/50 group-open:rotate-90 transition-transform duration-150">
                  ›
                </span>
              </summary>
              <div className="flex flex-wrap gap-1.5 px-2 pb-2 pt-1.5">
                {(precomputed.properties[traitName] ?? []).map((item) => {
                  const isActive = activeFilters[traitName]?.has(item.property) ?? false;
                  return (
                    <button
                      key={`${traitName}-${item.property}`}
                      onClick={() => toggleFilter(traitName, item.property)}
                      type="button"
                      className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs transition-colors",
                        isActive
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
                      )}
                    >
                      {item.property} ({item.count})
                    </button>
                  );
                })}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
