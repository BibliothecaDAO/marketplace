"use client";

import { useCallback, useEffect, useState } from "react";
import { getMarketplaceRuntimeConfig } from "@/lib/marketplace/config";
import { CollectionRow } from "@/components/marketplace/collection-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizeHomeSearchQuery } from "@/lib/marketplace/home-search";

const SEARCH_DEBOUNCE_MS = 200;

export function MarketplaceHome() {
  const { collections } = getMarketplaceRuntimeConfig();
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [rowMatches, setRowMatches] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearchQuery(searchInput);
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  const handleSearchMatchChange = useCallback((address: string, isMatch: boolean) => {
    setRowMatches((prev) => {
      if (prev[address] === isMatch) {
        return prev;
      }

      return {
        ...prev,
        [address]: isMatch,
      };
    });
  }, []);

  const resetSearch = useCallback(() => {
    setSearchInput("");
    setSearchQuery("");
    setRowMatches({});
  }, []);

  const isSearchActive = normalizeHomeSearchQuery(searchQuery).length > 0;
  const allRowsReported =
    collections.length > 0 &&
    collections.every((collection) => rowMatches[collection.address] !== undefined);
  const hasAnyMatch = collections.some((collection) => rowMatches[collection.address]);
  const showSearchEmptyState = isSearchActive && allRowsReported && !hasAnyMatch;

  return (
    <main
      data-testid="marketplace-home"
      className="w-full space-y-8 pt-6"
    >
      {collections.length === 0 ? (
        <p className="text-sm text-muted-foreground font-mono">
          <span className="text-primary mr-1">$</span>
          No collections configured
        </p>
      ) : <>
        <div className="flex flex-col gap-2 px-4 sm:px-6 lg:px-8">
          <label
            className="text-xs font-medium tracking-widest uppercase text-muted-foreground"
            htmlFor="home-search"
          >
            Search Marketplace
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              id="home-search"
              placeholder="Search collections or token IDs/names"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
            <Button
              disabled={normalizeHomeSearchQuery(searchInput).length === 0}
              onClick={resetSearch}
              type="button"
              variant="outline"
            >
              Reset search
            </Button>
          </div>
        </div>

        {showSearchEmptyState ? (
          <div className="px-4 sm:px-6 lg:px-8">
            <p className="text-sm text-muted-foreground font-mono">
              <span className="text-primary mr-1">$</span>
              No matches for &quot;{searchQuery.trim()}&quot;
            </p>
          </div>
        ) : null}

        {collections.map((collection) => (
          <CollectionRow
            key={collection.address}
            address={collection.address}
            name={collection.name}
            projectId={collection.projectId}
            searchQuery={searchQuery}
            onSearchMatchChange={handleSearchMatchChange}
          />
        ))}
      </>}
    </main>
  );
}
