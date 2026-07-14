"use client";

import { useMemo } from "react";
import type { OrderKey } from "@biblio/marketplace-api-contract";
import { orderFromApi } from "@/lib/marketplace/api-adapter";
import { getMarketplaceApiClient } from "@/lib/marketplace/api-client";

type ContractCaller = {
  callContract?(call: {
    contractAddress: string;
    entrypoint: string;
    calldata: string[];
  }): Promise<readonly unknown[]>;
};

const U128_MASK = (BigInt(1) << BigInt(128)) - BigInt(1);

function uint256(value: bigint): [string, string] {
  return [(value & U128_MASK).toString(), (value >> BigInt(128)).toString()];
}

export function useMarketplaceClient(contractCaller?: ContractCaller | null) {
  const client = useMemo(() => {
    const api = getMarketplaceApiClient();
    return {
      async listCollectionListings(options: {
        collection: string;
        tokenId?: string;
        limit?: number;
        currency?: string;
      }) {
        const response = await api.listings(options.collection, {
          tokenId: options.tokenId ? BigInt(options.tokenId).toString() : undefined,
          limit: options.limit,
          currency: options.currency,
        });
        return response.data.items.map(orderFromApi);
      },
      async getFees() {
        const response = await api.book();
        return {
          feeNum: Number(response.data.feeNumerator),
          feeDenominator: Number(response.data.feeDenominator),
          feeReceiver: response.data.feeReceiver,
        };
      },
      async getRoyaltyFee(options: {
        collection: string;
        tokenId: string;
        amount: bigint;
      }) {
        if (!contractCaller?.callContract) return null;
        const tokenId = uint256(BigInt(options.tokenId));
        const amount = uint256(options.amount);
        const result = await contractCaller.callContract({
          contractAddress: options.collection,
          entrypoint: "royalty_info",
          calldata: [...tokenId, ...amount],
        });
        if (result.length < 2) return null;
        return { receiver: String(result[0]), amount: BigInt(String(result[1])) };
      },
      book: () => api.book(),
      indexerStatus: () => api.indexerStatus(),
      lookupOrders: (orders: OrderKey[]) => api.lookupOrders(orders),
    };
  }, [contractCaller]);
  return { client, status: "ready" as const, error: null, refresh: async () => undefined };
}
