"use client";

import { useQuery } from "@tanstack/react-query";
import type { CollectionSortMode } from "@/features/collections/collection-query-params";
import {
  collectionFromApi,
  holdingBalanceFromApi,
  orderFromApi,
  tokenFromApi,
} from "@/lib/marketplace/api-adapter";
import { getMarketplaceApiClient } from "@/lib/marketplace/api-client";
import { getMarketplaceRuntimeConfig } from "@/lib/marketplace/config";
import type {
  CollectionListingsOptions,
  CollectionOrdersOptions,
  CollectionSummaryOptions,
  FetchCollectionTokensOptions,
  TokenDetailsOptions,
} from "@/lib/marketplace/types";
import type { TraitSelection } from "@/lib/marketplace/traits";

function decimalTokenId(value: string | number | bigint): string {
  return BigInt(value).toString();
}

function exactTraits(
  filters: FetchCollectionTokensOptions["attributeFilters"],
): Array<{ name: string; values: Array<string | number | boolean> }> {
  if (!filters) return [];
  if (Array.isArray(filters)) {
    const grouped = new Map<string, Array<string | number | boolean>>();
    for (const filter of filters) {
      const name = filter.traitName ?? filter.name;
      const value = filter.traitValue ?? filter.value;
      if (!name || value === undefined) continue;
      grouped.set(name, [...(grouped.get(name) ?? []), value]);
    }
    return [...grouped].map(([name, values]) => ({ name, values }));
  }
  return Object.entries(filters).map(([name, values]) => ({ name, values }));
}

function normalizedCategory(
  value: string | undefined,
): "buy" | "sell" | "buy_any" | undefined {
  const normalized = value?.toLowerCase();
  if (normalized === "buy" || normalized === "sell" || normalized === "buy_any") {
    return normalized;
  }
  return undefined;
}

function normalizedStatus(
  value: string | undefined,
): "none" | "placed" | "cancelled" | "executed" | undefined {
  const normalized = value?.toLowerCase();
  if (normalized === "canceled") return "cancelled" as const;
  if (
    normalized === "none" || normalized === "placed" ||
    normalized === "cancelled" || normalized === "executed"
  ) {
    return normalized;
  }
  return undefined;
}

export function useCollectionQuery(options: CollectionSummaryOptions) {
  return useQuery({
    queryKey: ["owned-marketplace", "collection", options.address] as const,
    queryFn: async () => collectionFromApi(
      (await getMarketplaceApiClient().collection(options.address)).data,
    ),
    enabled: !!options.address,
    staleTime: 60_000,
  });
}

export function useCollectionTokensQuery(
  options: FetchCollectionTokensOptions,
  queryOptions?: { enabled?: boolean; staleTime?: number },
) {
  const enabled = (queryOptions?.enabled ?? true) && !!options.address;
  return useQuery({
    queryKey: [
      "owned-marketplace", "collection-tokens", options.address, options.cursor,
      options.tokenIds, options.attributeFilters, options.limit, options.sort,
      options.currency,
      options.rangeFilters,
    ] as const,
    queryFn: async () => {
      const response = await getMarketplaceApiClient().tokens(options.address, {
        cursor: options.cursor,
        limit: Math.min(options.limit ?? 24, 100),
        sort: options.sort as CollectionSortMode | undefined,
        currency: options.currency,
        tokenIds: options.tokenIds,
        traits: exactTraits(options.attributeFilters),
        ranges: options.rangeFilters,
      });
      return {
        page: {
          tokens: response.data.items.map(tokenFromApi),
          nextCursor: response.data.nextCursor,
        },
        error: null,
        meta: response.meta,
      };
    },
    enabled,
    staleTime: queryOptions?.staleTime ?? 60_000,
  });
}

function orderQuery(options: CollectionOrdersOptions) {
  return {
    cursor: options.cursor,
    limit: Math.min(options.limit ?? 24, 100),
    currency: options.currency,
    tokenId: options.tokenId ? decimalTokenId(options.tokenId) : undefined,
    category: normalizedCategory(options.category),
    status: normalizedStatus(options.status),
  };
}

export function useCollectionOrdersQuery(options: CollectionOrdersOptions) {
  return useQuery({
    queryKey: ["owned-marketplace", "orders", options] as const,
    queryFn: async () => {
      const response = await getMarketplaceApiClient().orders(
        options.collection,
        orderQuery(options),
      );
      return response.data.items.map(orderFromApi);
    },
    enabled: !!options.collection,
    staleTime: 2_000,
  });
}

export function useCollectionListingsQuery(options: CollectionListingsOptions) {
  return useQuery({
    queryKey: ["owned-marketplace", "listings", options] as const,
    queryFn: async () => {
      const response = await getMarketplaceApiClient().listings(
        options.collection,
        orderQuery(options),
      );
      return response.data.items.map(orderFromApi);
    },
    enabled: !!options.collection,
    staleTime: 2_000,
  });
}

export function useTokenDetailQuery(options: TokenDetailsOptions) {
  const tokenId = decimalTokenId(options.tokenId);
  return useQuery({
    queryKey: [
      "owned-marketplace", "token-detail", options.collection, tokenId, options.currency,
    ] as const,
    queryFn: async () => {
      const client = getMarketplaceApiClient();
      const token = await client.token(options.collection, tokenId, options.currency);
      const ordersEnabled = getMarketplaceRuntimeConfig().isReadSurfaceEnabled("orders");
      const [orders, listings, activity] = ordersEnabled
        ? await Promise.all([
            client.orders(options.collection, { tokenId, currency: options.currency, limit: 100 }),
            client.listings(options.collection, { tokenId, currency: options.currency, limit: 100 }),
            client.activity(options.collection, tokenId, { limit: 100 }),
          ])
        : [null, null, null];
      return {
        token: tokenFromApi(token.data),
        orders: orders?.data.items.map(orderFromApi) ?? [],
        listings: listings?.data.items.map(orderFromApi) ?? [],
        activity: activity?.data.items ?? [],
        meta: token.meta,
      };
    },
    enabled: !!options.collection && !!tokenId,
    staleTime: 10_000,
  });
}

async function allHoldings(account: string, collection?: string) {
  const balances = [];
  let cursor: string | null = null;
  do {
    const response = await getMarketplaceApiClient().holdings(account, {
      cursor,
      limit: 200,
      collection,
    });
    balances.push(...response.data.items.map(holdingBalanceFromApi));
    cursor = response.data.nextCursor;
  } while (cursor);
  return balances;
}

export function useTokenOwnershipQuery(options: {
  collection: string;
  tokenId: string;
  accountAddress?: string;
}) {
  return useQuery({
    queryKey: [
      "owned-marketplace", "token-ownership", options.collection,
      options.tokenId, options.accountAddress,
    ] as const,
    queryFn: async () => {
      const balances = (await allHoldings(options.accountAddress!, options.collection))
        .filter((balance) => balance.token_id === decimalTokenId(options.tokenId));
      return { page: { balances, nextCursor: null }, error: null };
    },
    enabled: !!options.accountAddress && !!options.collection && !!options.tokenId,
    staleTime: 10_000,
  });
}

export function useTokenHolderQuery(options: { collection: string; tokenId: string }) {
  return useQuery({
    queryKey: ["owned-marketplace", "token-holder", options.collection, options.tokenId] as const,
    queryFn: async () => {
      const token = (await getMarketplaceApiClient().token(
        options.collection,
        decimalTokenId(options.tokenId),
      )).data;
      const balances = token.owner
        ? [{
            account_address: token.owner,
            contract_address: token.collection,
            token_id: token.tokenId,
            balance: token.balance,
          }]
        : [];
      return { page: { balances, nextCursor: null }, error: null };
    },
    enabled: !!options.collection && !!options.tokenId,
    staleTime: 10_000,
  });
}

export function useWalletPortfolioQuery(walletAddress: string | undefined) {
  return useQuery({
    queryKey: ["owned-marketplace", "wallet-portfolio", walletAddress] as const,
    queryFn: async () => ({
      page: { balances: await allHoldings(walletAddress!), nextCursor: null },
      error: null,
    }),
    enabled: !!walletAddress,
    retry: false,
    staleTime: 60_000,
  });
}

export function useTraitNamesSummaryQuery(options: { address: string; projectId?: string }) {
  return useQuery({
    queryKey: ["owned-marketplace", "trait-names", options.address] as const,
    queryFn: async () => {
      const response = await getMarketplaceApiClient().traits(options.address);
      return response.data.map((facet) => ({
        traitName: facet.name,
        valueCount: facet.values.length,
      }));
    },
    enabled: !!options.address,
    staleTime: 60_000,
  });
}

function groupTraitSelections(filters: TraitSelection[] | undefined) {
  const grouped = new Map<string, Array<string | number | boolean>>();
  for (const filter of filters ?? []) {
    grouped.set(filter.name, [...(grouped.get(filter.name) ?? []), filter.value]);
  }
  return [...grouped].map(([name, values]) => ({ name, values }));
}

export function useTraitValuesQuery(options: {
  address: string;
  traitName: string | null;
  otherTraitFilters?: TraitSelection[];
  projectId?: string;
}) {
  return useQuery({
    queryKey: [
      "owned-marketplace", "trait-values", options.address,
      options.traitName, options.otherTraitFilters,
    ] as const,
    queryFn: async () => {
      const response = await getMarketplaceApiClient().traits(options.address, {
        traitName: options.traitName!,
        otherTraits: groupTraitSelections(options.otherTraitFilters),
      });
      const facet = response.data.find((candidate) => candidate.name === options.traitName);
      return (facet?.values ?? []).map((value) => ({
        traitValue: String(value.value),
        count: Number(value.count),
      }));
    },
    enabled: !!options.address && !!options.traitName,
    staleTime: 60_000,
  });
}

export function useIndexerStatusQuery() {
  return useQuery({
    queryKey: ["owned-marketplace", "indexer-status"] as const,
    queryFn: () => getMarketplaceApiClient().indexerStatus(),
    refetchInterval: 15_000,
    staleTime: 5_000,
  });
}
