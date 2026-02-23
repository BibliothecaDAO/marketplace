"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  type ActiveFilters,
  type TraitNameSummary,
  type TraitValueRow,
  computePrecomputedFilters,
  flattenActiveFilters,
} from "@/lib/marketplace/traits";

type TraitFilterSidebarProps = {
  traitNames: TraitNameSummary[];
  activeFilters: ActiveFilters;
  onActiveFiltersChange?: (filters: ActiveFilters) => void;
  isLoading?: boolean;
  traitValues: TraitValueRow[] | null;
  isLoadingValues?: boolean;
  openTraitName: string | null;
  onOpenTraitNameChange: (traitName: string | null) => void;
};

function cloneFilters(activeFilters: ActiveFilters): ActiveFilters {
  return Object.fromEntries(
    Object.entries(activeFilters).map(([name, values]) => [name, new Set(values)]),
  );
}

export function TraitFilterSidebar({
  traitNames,
  activeFilters,
  onActiveFiltersChange,
  isLoading,
  traitValues,
  isLoadingValues,
  openTraitName,
  onOpenTraitNameChange,
}: TraitFilterSidebarProps) {
  const [searchByTraitName, setSearchByTraitName] = useState<Record<string, string>>({});

  const sortedTraitNames = useMemo(
    () => [...traitNames].sort((a, b) => a.traitName.localeCompare(b.traitName)),
    [traitNames],
  );

  const openGroupValues = useMemo(() => {
    if (!traitValues || traitValues.length === 0) return [];
    const available: Record<string, Record<string, number>> = {};
    const traitName = openTraitName ?? "";
    available[traitName] = {};
    for (const row of traitValues) {
      available[traitName][row.traitValue] = row.count;
    }
    return computePrecomputedFilters(available).properties[traitName] ?? [];
  }, [traitValues, openTraitName]);

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

  function toggleTraitGroup(traitName: string) {
    onOpenTraitNameChange(openTraitName === traitName ? null : traitName);
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
      ) : sortedTraitNames.length === 0 ? (
        <p className="text-xs text-muted-foreground">No trait data available.</p>
      ) : null}

      {/* Trait groups — single-open accordion with per-group search */}
      <div className="space-y-1">
        {sortedTraitNames.map((trait, index) => {
          const traitName = trait.traitName;
          const traitPanelId = `trait-panel-${index}`;
          const traitButtonId = `trait-toggle-${index}`;
          const isOpen = openTraitName === traitName;
          const activeInGroup = activeFilters[traitName]?.size ?? 0;
          const searchTerm = searchByTraitName[traitName] ?? "";
          const normalizedSearchTerm = searchTerm.trim().toLocaleLowerCase();
          const filteredValues = isOpen
            ? openGroupValues.filter((item) =>
                normalizedSearchTerm.length === 0
                  ? true
                  : item.property.toLocaleLowerCase().includes(normalizedSearchTerm),
              )
            : [];

          return (
            <div key={traitName} className="space-y-1">
              <button
                id={traitButtonId}
                type="button"
                aria-controls={traitPanelId}
                aria-expanded={isOpen}
                onClick={() => toggleTraitGroup(traitName)}
                className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              >
                <span className="flex items-center gap-1.5">
                  {traitName}
                  {activeInGroup > 0 && (
                    <span className="inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-0.5 text-[9px] font-medium text-primary-foreground">
                      {activeInGroup}
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    "text-muted-foreground/50 transition-transform duration-150",
                    isOpen ? "rotate-90" : "",
                  )}
                >
                  ›
                </span>
              </button>
              {isOpen ? (
                <div
                  id={traitPanelId}
                  role="region"
                  aria-labelledby={traitButtonId}
                  className="space-y-2 px-2 pb-2"
                >
                  <Input
                    type="search"
                    value={searchTerm}
                    onChange={(event) => {
                      setSearchByTraitName((current) => ({
                        ...current,
                        [traitName]: event.target.value,
                      }));
                    }}
                    aria-label={`Search ${traitName}`}
                    placeholder={`Search ${traitName}`}
                    className="h-7 text-xs"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {isLoadingValues ? (
                      <p className="text-xs text-muted-foreground">Loading values...</p>
                    ) : filteredValues.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No matches.</p>
                    ) : (
                      filteredValues.map((item) => {
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
                      })
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
