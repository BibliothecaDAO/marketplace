"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { NormalizedToken } from "@/lib/marketplace/types";
import {
  useCollectionListingsQuery,
  useCollectionQuery,
  useTraitNamesSummaryQuery,
  useTraitValuesQuery,
} from "@/lib/marketplace/hooks";
import {
  displayTokenId,
  formatPriceForDisplay,
} from "@/lib/marketplace/token-display";
import { TokenSymbol } from "@/components/ui/token-symbol";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type SeedCollection,
  getMarketplaceRuntimeConfig,
} from "@/lib/marketplace/config";
import {
  flattenExactActiveFilters,
  type ActiveFilters,
  type TraitSelection,
} from "@/lib/marketplace/traits";
import { animate, stagger } from "animejs";
import dynamic from "next/dynamic";

const CollectionMarketPanel = dynamic(
  () =>
    import("@/features/collections/collection-market-panel").then((m) => ({
      default: m.CollectionMarketPanel,
    })),
  { ssr: false },
);
import { CollectionTokenGrid } from "@/features/collections/collection-token-grid";
import { TraitFilterSidebar } from "@/features/collections/trait-filter-sidebar";
import {
  getCollectionFilterConfig,
  type CollectionSortOption,
} from "@/lib/marketplace/collection-filter-config";
import { getCollectionBannerImage } from "@/lib/marketplace/collection-banners";
import {
  cartItemFromTokenListing,
  cheapestListingByTokenId,
} from "@/features/cart/listing-utils";
import { CART_MAX_ITEMS, useCartStore } from "@/features/cart/store/cart-store";
import {
  type CollectionSortMode,
  type MarketplaceCurrencySymbol,
} from "@/features/collections/collection-query-params";
import { SweepBar } from "@/features/collections/sweep-bar";
import { COLLECTION_LISTING_SAMPLE_LIMIT } from "@/lib/marketplace/query-limits";

const EMPTY_ACTIVE_FILTERS: ActiveFilters = {};
const EMPTY_VISIBLE_TOKENS: NormalizedToken[] = [];

type CollectionRouteViewProps = {
  address: string;
  cursor?: string | null;
  collections?: SeedCollection[];
  activeFilters?: ActiveFilters;
  sortMode?: CollectionSortMode;
  currency?: MarketplaceCurrencySymbol;
  onActiveFiltersChange?: (filters: ActiveFilters) => void;
  onSortModeChange?: (sortMode: CollectionSortMode) => void;
  onCurrencyChange?: (currency: MarketplaceCurrencySymbol) => void;
};

const DEFAULT_SORT_OPTIONS: CollectionSortOption[] = [
  {
    label: "Recent",
    values: { asc: "recent", desc: "recent" },
    defaultDirection: "asc",
  },
  {
    label: "Price",
    values: { asc: "price-asc", desc: "price-desc" },
    defaultDirection: "asc",
  },
];

function collectionName(metadata: unknown, fallbackAddress: string) {
  if (metadata && typeof metadata === "object") {
    const name = (metadata as Record<string, unknown>).name;
    if (typeof name === "string" && name.trim().length > 0) {
      return name;
    }
  }

  return fallbackAddress;
}

function collectionHeaderImage(metadata: unknown) {
  if (metadata && typeof metadata === "object") {
    const record = metadata as Record<string, unknown>;
    const image = record.banner_image ?? record.bannerImage ?? record.image ?? record.image_url;
    if (typeof image === "string" && image.trim().length > 0) {
      return image.trim();
    }
  }

  return null;
}

function floorFromListings(
  cheapestListings: Map<string, { price: string; currency: string }>,
): { price: string; currency: string } | null {
  let min: bigint | null = null;
  let currency = "";

  for (const listing of cheapestListings.values()) {
    try {
      const val = BigInt(listing.price);
      if (min === null || val < min) {
        min = val;
        currency = listing.currency;
      }
    } catch {
      // skip
    }
  }

  if (min === null) {
    return null;
  }

  const price = formatPriceForDisplay(min.toString());
  return price ? { price, currency } : null;
}

function compareBigIntStrings(left: string, right: string) {
  try {
    const leftValue = BigInt(left);
    const rightValue = BigInt(right);
    if (leftValue === rightValue) {
      return 0;
    }

    return leftValue < rightValue ? -1 : 1;
  } catch {
    return left.localeCompare(right);
  }
}

function isSortOptionActive(
  option: CollectionSortOption,
  sortMode: CollectionSortMode,
) {
  return option.values.asc === sortMode || option.values.desc === sortMode;
}

function sortButtonLabel(
  option: CollectionSortOption,
  sortMode: CollectionSortMode,
) {
  if (option.values.asc === option.values.desc) {
    return option.label;
  }

  if (sortMode === option.values.asc) {
    return `${option.label} ↑`;
  }

  if (sortMode === option.values.desc) {
    return `${option.label} ↓`;
  }

  return option.label;
}

export function CollectionRouteView({
  address,
  collections,
  activeFilters,
  sortMode = "recent",
  currency = "STRK",
  onActiveFiltersChange,
  onSortModeChange,
  onCurrencyChange,
}: CollectionRouteViewProps) {
  const cartItems = useCartStore((state) => state.items);
  const cartOrderIds = useMemo(
    () => new Set(cartItems.map((item) => item.orderId)),
    [cartItems],
  );
  const addCandidates = useCartStore((state) => state.addCandidates);
  const setCartOpen = useCartStore((state) => state.setOpen);
  const runtimeConfig = getMarketplaceRuntimeConfig();
  const runtimeCollections = useMemo(
    () => collections ?? runtimeConfig.collections,
    [collections, runtimeConfig.collections],
  );
  const currencyOptions = runtimeConfig.currencies;
  const currencyAddress = currencyOptions.find(
    (candidate) => candidate.symbol === currency,
  )?.address ?? currencyOptions.find((candidate) => candidate.symbol === "STRK")?.address;
  const resolvedActiveFilters = activeFilters ?? EMPTY_ACTIVE_FILTERS;
  const selectedCollection = useMemo(
    () =>
      runtimeCollections.find(
        (collectionEntry) => collectionEntry.address === address,
      ),
    [address, runtimeCollections],
  );
  const projectId = selectedCollection?.projectId;
  const sweepScopeKey = `${address}-${currency}`;
  const [sweepCount, setSweepCount] = useState(0);
  const [visibleTokensByScope, setVisibleTokensByScope] = useState<
    Record<string, NormalizedToken[]>
  >({});
  const collection = useCollectionQuery({ address, projectId, fetchImages: true });
  const traitNamesQuery = useTraitNamesSummaryQuery({ address, projectId });
  const [openTraitName, setOpenTraitName] = useState<string | null>(null);

  const otherTraitFilters = useMemo(() => {
    if (!openTraitName) return undefined;
    const result: TraitSelection[] = flattenExactActiveFilters(resolvedActiveFilters)
      .filter((entry) => entry.name !== openTraitName);
    return result.length > 0 ? result : undefined;
  }, [openTraitName, resolvedActiveFilters]);

  const traitValuesQuery = useTraitValuesQuery({
    address,
    traitName: openTraitName,
    otherTraitFilters,
    projectId,
  });

  const listingQuery = useCollectionListingsQuery({
    collection: address,
    projectId,
    limit: COLLECTION_LISTING_SAMPLE_LIMIT,
    currency: currencyAddress,
    verifyOwnership: false,
  });

  const cheapestListings = cheapestListingByTokenId(listingQuery.data);
  const floor = floorFromListings(cheapestListings);
  const seedName = selectedCollection?.name?.trim() || null;
  const displayName = seedName
    ?? (collection.isSuccess && collection.data
      ? collectionName(collection.data.metadata, address)
      : null);
  const headerImage = collection.isSuccess && collection.data
    ? collectionHeaderImage(collection.data.metadata) ?? getCollectionBannerImage(displayName ?? seedName)
    : getCollectionBannerImage(seedName);
  const collectionFilterConfig = useMemo(
    () => getCollectionFilterConfig(address, runtimeCollections),
    [address, runtimeCollections],
  );
  const sortOptions = collectionFilterConfig.sortOptions ?? DEFAULT_SORT_OPTIONS;

  // Hero entrance animation
  const heroRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState("tokens");

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      hero.querySelectorAll<HTMLElement>(".hero-image, .hero-content > *").forEach((el) => {
        el.style.opacity = "1";
        el.style.transform = "none";
      });
      return;
    }

    const img = hero.querySelector<HTMLElement>(".hero-image");
    if (img) {
      animate(img, { opacity: [0, 1], duration: 600, ease: "easeOutCubic" });
    }

    const contentChildren = hero.querySelectorAll<HTMLElement>(".hero-content > *");
    if (contentChildren.length > 0) {
      animate(contentChildren, {
        opacity: [0, 1],
        translateY: [12, 0],
        delay: stagger(60, { start: 300 }),
        duration: 500,
        ease: "spring(1, 120, 20, 0)",
      });
    }
  }, [address]);

  // Tab content entrance animation
  const tabContentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = tabContentRef.current;
    if (!el) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;
    animate(el, {
      opacity: [0, 1],
      translateY: [4, 0],
      duration: 300,
      ease: "easeOutCubic",
    });
  }, [activeTab]);

  const visibleTokens = visibleTokensByScope[sweepScopeKey] ?? EMPTY_VISIBLE_TOKENS;
  const hasVisibleTokenSnapshot = Object.prototype.hasOwnProperty.call(
    visibleTokensByScope,
    sweepScopeKey,
  );
  const visibleListedTokenCount = useMemo(() => {
    const visibleTokenIds = new Set(visibleTokens.map((token) => displayTokenId(token)));
    let count = 0;

    for (const listedTokenId of cheapestListings.keys()) {
      if (visibleTokenIds.has(listedTokenId)) {
        count += 1;
      }
    }

    return count;
  }, [cheapestListings, visibleTokens]);
  const listingCount = hasVisibleTokenSnapshot
    ? visibleListedTokenCount
    : cheapestListings.size;
  const listingCountLabel =
    listingCount >= COLLECTION_LISTING_SAMPLE_LIMIT
      ? `${COLLECTION_LISTING_SAMPLE_LIMIT}+`
      : String(listingCount);

  const sweepCandidates = useMemo(() => {
    if (!visibleTokens.length) return [];

    const tokenByDisplayId = new Map(
      visibleTokens.map((token) => [displayTokenId(token), token] as const),
    );

    const candidates = Array.from(cheapestListings.values())
      .filter((listing) => !cartOrderIds.has(listing.orderId))
      .map((listing) => {
        const token = tokenByDisplayId.get(listing.tokenId);
        if (!token) return null;
        return cartItemFromTokenListing(token, address, listing, projectId);
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((left, right) => compareBigIntStrings(left.price, right.price));

    return candidates.slice(0, CART_MAX_ITEMS);
  }, [address, cartOrderIds, cheapestListings, projectId, visibleTokens]);

  // Build the preview set directly from cheapestListings (same key format
  // the grid uses for lookup) so highlighting doesn't depend on listedTokensQuery.
  const cheapestByPrice = useMemo(() => {
    return Array.from(cheapestListings.entries())
      .filter(([, listing]) => !cartOrderIds.has(listing.orderId))
      .sort(([, a], [, b]) => compareBigIntStrings(a.price, b.price));
  }, [cartOrderIds, cheapestListings]);

  const sweepMaxCount = Math.min(
    cheapestByPrice.length,
    Math.max(CART_MAX_ITEMS - cartItems.length, 0),
  );
  const clampedSweepCount = Math.min(sweepCount, sweepMaxCount);
  const sweepPreviewTokenIds = useMemo(
    () => new Set(cheapestByPrice.slice(0, clampedSweepCount).map(([tokenId]) => tokenId)),
    [cheapestByPrice, clampedSweepCount],
  );
  const handleTokensChange = useCallback((tokens: NormalizedToken[]) => {
    setVisibleTokensByScope((current) => {
      if (current[sweepScopeKey] === tokens) {
        return current;
      }

      return {
        ...current,
        [sweepScopeKey]: tokens,
      };
    });
  }, [sweepScopeKey]);

  const handleSweepCountChange = useCallback(
    (nextCount: number) => {
      setSweepCount(Math.min(Math.max(nextCount, 0), sweepMaxCount));
    },
    [sweepMaxCount],
  );

  const handleSweep = useCallback(() => {
    const selected = sweepCandidates.slice(0, clampedSweepCount);
    if (selected.length === 0) return;
    addCandidates(selected);
    setCartOpen(true);
    setSweepCount(0);
  }, [sweepCandidates, clampedSweepCount, addCandidates, setCartOpen]);

  const handleSortOptionClick = useCallback(
    (option: CollectionSortOption) => {
      if (!onSortModeChange) {
        return;
      }

      const defaultDirection = option.defaultDirection ?? "asc";
      const nextSortMode =
        sortMode === option.values.asc
          ? option.values.desc
          : sortMode === option.values.desc
            ? option.values.asc
            : defaultDirection === "desc"
              ? option.values.desc
              : option.values.asc;

      onSortModeChange(nextSortMode as CollectionSortMode);
    },
    [onSortModeChange, sortMode],
  );

  const sortControls = useMemo<ReactNode>(
    () => (
      <>
      <div
        className="flex flex-wrap items-center gap-2"
        data-testid="collection-sort-controls"
      >
        {sortOptions.map((option) => {
          const isActive = isSortOptionActive(option, sortMode);

          return (
            <button
              key={option.label}
              type="button"
              aria-pressed={isActive}
              onClick={() => handleSortOptionClick(option)}
              className={
                isActive
                  ? "inline-flex h-7 items-center rounded-[6px] border border-[color:var(--realm-border-strong)] bg-primary px-3 text-xs font-medium text-primary-foreground"
                  : "inline-flex h-7 items-center rounded-[6px] border border-[color:var(--realm-border-etched)] bg-[color:var(--realm-surface-iron)]/70 px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-[color:var(--realm-border-strong)] hover:text-foreground"
              }
            >
              {sortButtonLabel(option, sortMode)}
            </button>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Select
          value={currency}
          onValueChange={(value) => onCurrencyChange?.(value as MarketplaceCurrencySymbol)}
        >
          <SelectTrigger aria-label="Marketplace currency" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {currencyOptions.map((option) => (
              <SelectItem key={option.address} value={option.symbol}>
                {option.symbol}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      </>
    ),
    [currency, currencyOptions, handleSortOptionClick, onCurrencyChange, sortMode, sortOptions],
  );

  return (
    <section className="w-full space-y-6 pb-20">
      {/* Collection hero banner — breaks out of parent padding for full-bleed */}
      <div
        ref={heroRef}
        className="relative -mx-4 overflow-hidden border-y border-[color:var(--realm-border-etched)] bg-[color:var(--realm-surface-iron)] sm:-mx-6 lg:-mx-8"
        data-testid="collection-header-image"
      >
        {headerImage ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={`${displayName ?? selectedCollection?.name ?? address} banner`}
              className="hero-image h-56 w-full object-cover object-center"
              src={headerImage}
            />
            {/* Gradient overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--realm-bg-void)] via-[color:var(--realm-bg-void)]/50 to-transparent" />
          </>
        ) : (
          <div className="h-56 w-full bg-[radial-gradient(circle_at_30%_20%,rgba(231,207,136,0.18),transparent_20rem),linear-gradient(145deg,#161b20,#070b0d)]" />
        )}

        {/* Overlay content */}
        <div className="hero-content absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 px-4 pb-5 sm:px-6 lg:px-8">
          {/* Collection name */}
          <h1 className="realm-title text-4xl text-[color:var(--realm-title)] drop-shadow-[0_2px_12px_rgba(0,0,0,0.7)]">
            {displayName ?? selectedCollection?.name ?? address}
          </h1>

          {/* Stats */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {listingCount > 0 && (
              <span className="realm-stat-pill px-3 py-1.5 text-[color:var(--realm-text-muted)]">
                <span className="font-semibold text-[color:var(--realm-title)]">{listingCountLabel}</span>
                {" "}listed
              </span>
            )}
            {floor && (
              <span className="realm-stat-pill flex items-center gap-1 px-3 py-1.5 text-[color:var(--realm-text-muted)]">
                Floor{" "}
                <span className="font-semibold text-[color:var(--realm-title)]">{floor.price}</span>
                <TokenSymbol address={floor.currency} className="font-semibold text-[color:var(--realm-title)]" />
              </span>
            )}
          </div>
        </div>
      </div>

      {collection.isSuccess && !collection.data ? (
        <p className="text-sm text-muted-foreground font-mono">
          <span className="text-primary mr-1">$</span>
          find collection -- not found
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
        <div
          className="sticky top-24 self-start max-h-[calc(100vh-7rem)] overflow-y-auto"
          data-testid="trait-sidebar-container"
        >
          <TraitFilterSidebar
            collectionAddress={address}
            traitNames={traitNamesQuery.data ?? []}
            activeFilters={resolvedActiveFilters}
            onActiveFiltersChange={onActiveFiltersChange}
            isLoading={traitNamesQuery.isLoading}
            traitValues={traitValuesQuery.data ?? null}
            isLoadingValues={traitValuesQuery.isLoading}
            openTraitName={openTraitName}
            onOpenTraitNameChange={setOpenTraitName}
          />
        </div>

        <div className="w-full space-y-4" data-testid="collection-content-container">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex items-center justify-between gap-3">
              <TabsList>
                <TabsTrigger value="tokens">Tokens</TabsTrigger>
                <TabsTrigger value="market-activity">Market Activity</TabsTrigger>
              </TabsList>
              {activeTab === "tokens" && visibleTokens.length > 0 && (
                <span className="text-xs text-muted-foreground">{visibleTokens.length} items</span>
              )}
            </div>
            <TabsContent value="tokens">
              <div ref={activeTab === "tokens" ? tabContentRef : undefined} key={`tab-tokens-${activeTab}`}>
                <CollectionTokenGrid
                  key={sweepScopeKey}
                  activeFilters={resolvedActiveFilters}
                  address={address}
                  currency={currencyAddress}
                  onTokensChange={handleTokensChange}
                  projectId={projectId}
                  sortControls={sortControls}
                  sortMode={sortMode}
                  sweepPreviewTokenIds={sweepPreviewTokenIds}
                />
              </div>
            </TabsContent>
            <TabsContent value="market-activity">
              <div ref={activeTab === "market-activity" ? tabContentRef : undefined} key={`tab-market-${activeTab}`}>
                <CollectionMarketPanel
                  address={address}
                  currency={currencyAddress}
                  projectId={projectId}
                />
              </div>
            </TabsContent>
          </Tabs>
          <SweepBar
            candidates={sweepCandidates}
            count={sweepCount}
            maxCount={sweepMaxCount}
            onCountChange={handleSweepCountChange}
            onSweep={handleSweep}
          />
        </div>
      </div>
    </section>
  );
}
